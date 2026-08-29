import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/strings";

interface Tile {
  href: string;
  label: string;
  show: boolean;
}

export default async function HomePage() {
  const user = await requireUser();
  const supabase = await createClient();

  // Does this user's location originate stock?
  let canOriginateHere = false;
  if (user.homeLocationId) {
    const { data: loc } = await supabase
      .from("locations")
      .select("can_originate")
      .eq("id", user.homeLocationId)
      .maybeSingle();
    canOriginateHere = Boolean(loc?.can_originate);
  }

  const isOps = user.role === "ops_manager" || user.role === "admin";
  const canCapture = user.role !== "finance";

  // Inbound transfers waiting to be received at this user's location (brief §8.1).
  let inboundCount = 0;
  if (canCapture) {
    let q = supabase.from("v_in_transit").select("id", { count: "exact", head: true });
    if (user.role === "staff" && user.homeLocationId) {
      q = q.eq("to_location_id", user.homeLocationId);
    }
    const { count } = await q;
    inboundCount = count ?? 0;
  }

  const tiles: Tile[] = [
    { href: "/transfers/receive", label: t.nav.confirmReceipt, show: canCapture },
    { href: "/counts", label: t.nav.counts, show: true },
    {
      href: "/originate",
      label: t.nav.originate,
      show: canCapture && (canOriginateHere || isOps),
    },
    { href: "/transfers/new", label: t.nav.sendTransfer, show: canCapture },
    { href: "/deliver", label: t.nav.deliver, show: canCapture },
    { href: "/returns", label: t.nav.returns, show: canCapture },
    { href: "/stock", label: t.nav.checkStock, show: true },
    { href: "/adjustments", label: t.nav.adjustments, show: isOps },
    { href: "/reports", label: t.nav.reports, show: user.role !== "staff" },
    { href: "/admin", label: t.nav.admin, show: isOps },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{t.home.greeting(user.fullName)}</h1>
        <p className="text-ink-60">
          {user.homeLocationName
            ? t.home.atLocation(user.homeLocationName)
            : t.home.noLocation}
        </p>
      </div>

      {inboundCount > 0 ? (
        <Link
          href="/transfers/receive"
          className="tap flex items-center justify-between rounded-lg bg-yellow px-4 py-4 text-ink"
        >
          <span className="font-semibold">{t.nav.confirmReceipt}</span>
          <span className="num rounded-full bg-ink px-3 py-0.5 text-page">
            {inboundCount}
          </span>
        </Link>
      ) : null}

      <nav className="grid grid-cols-2 gap-3">
        {tiles
          .filter((tile) => tile.show)
          .map((tile) => (
            <Link
              key={tile.href}
              href={tile.href}
              className="tap flex min-h-24 items-center rounded-lg border border-sand bg-surface px-4 py-4 text-base font-medium"
            >
              {tile.label}
            </Link>
          ))}
      </nav>
    </div>
  );
}
