import { config as loadEnv } from "dotenv";
import { Client } from "pg";
import { randomUUID } from "node:crypto";

loadEnv({ path: ".env.local" });

const DB_URL = process.env.SUPABASE_DB_URL;
if (!DB_URL) throw new Error("SUPABASE_DB_URL must be set in .env.local");

export type Role = "admin" | "ops_manager" | "finance" | "staff";

/**
 * Run a test body inside a transaction that is ALWAYS rolled back, so the hosted
 * database is never mutated. Reference data (locations, finishes, adjustment reasons)
 * is assumed already seeded; everything else is created inside the transaction.
 */
export async function withRollback<T>(
  fn: (t: Tx) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  await client.query("begin");
  try {
    return await fn(new Tx(client));
  } finally {
    await client.query("rollback").catch(() => {});
    await client.end().catch(() => {});
  }
}

export class Tx {
  constructor(private client: Client) {}

  q(text: string, params: unknown[] = []) {
    return this.client.query(text, params);
  }

  /**
   * Run a statement expected to fail, inside a savepoint so the surrounding
   * transaction stays usable afterwards. Returns the error message; throws if the
   * statement unexpectedly succeeded.
   */
  async expectError(text: string, params: unknown[] = []): Promise<string> {
    await this.client.query("savepoint sp_expect");
    try {
      await this.client.query(text, params);
    } catch (err) {
      await this.client.query("rollback to savepoint sp_expect");
      return (err as Error).message;
    }
    await this.client.query("rollback to savepoint sp_expect");
    throw new Error(`expected statement to fail but it succeeded: ${text}`);
  }

  async one<R = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<R> {
    const r = await this.client.query(text, params);
    return r.rows[0] as R;
  }

  async val<V = unknown>(text: string, params: unknown[] = []): Promise<V> {
    const r = await this.client.query(text, params);
    return Object.values(r.rows[0])[0] as V;
  }

  /** Reset to the privileged (table owner) role — bypasses RLS, still fires triggers. */
  async asOwner() {
    await this.client.query("reset role");
    await this.client.query(`select set_config('request.jwt.claims', '', true)`);
  }

  /** Act as a given signed-in user: sets the JWT sub claim and drops to `authenticated`. */
  async asUser(userId: string) {
    await this.client.query("reset role");
    await this.client.query(
      `select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: userId, role: "authenticated" })],
    );
    await this.client.query("set local role authenticated");
  }

  async locationId(code: string): Promise<string> {
    return this.val<string>("select id from locations where code = $1", [code]);
  }

  async reasonId(label: string): Promise<string> {
    return this.val<string>("select id from adjustment_reasons where label = $1", [label]);
  }

  /** Create an auth user + profile inside the transaction. Returns the user id. */
  async makeActor(role: Role, opts: { locationCode?: string } = {}): Promise<string> {
    const id = randomUUID();
    const email = `test-${id}@home47.test`;
    await this.client.query(
      `insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                               email_confirmed_at, created_at, updated_at)
       values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
               $2, '', now(), now(), now())`,
      [id, email],
    );
    const homeId = opts.locationCode ? await this.locationId(opts.locationCode) : null;
    await this.client.query(
      `insert into profiles (id, full_name, role, home_location_id, is_active)
       values ($1, $2, $3, $4, true)`,
      [id, `Test ${role}`, role, homeId],
    );
    return id;
  }

  /** Create a product; returns its id. */
  async makeProduct(
    name: string,
    sellingPrice: number,
    standardCost: number | null = null,
  ): Promise<string> {
    return this.val<string>(
      `insert into products (name, selling_price, standard_cost) values ($1, $2, $3) returning id`,
      [name, sellingPrice, standardCost],
    );
  }

  /** Sum the ledger for a (location, product[, finish]). */
  async balance(locationId: string, productId: string, finishId: string | null = null): Promise<number> {
    const r = await this.client.query(
      `select coalesce(sum(quantity), 0)::int as bal
         from stock_movements
        where location_id = $1 and product_id = $2 and finish_id is not distinct from $3`,
      [locationId, productId, finishId],
    );
    return r.rows[0].bal as number;
  }
}
