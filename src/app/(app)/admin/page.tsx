import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { t } from "@/strings";

export default async function AdminIndex() {
  const user = await requireRole("ops_manager", "admin", "finance");
  const isOps = user.role === "ops_manager" || user.role === "admin";
  const isAdmin = user.role === "admin";

  const tiles = [
    { href: "/admin/products", label: isOps ? t.admin.products : t.admin.productCosts, show: true },
    { href: "/admin/finishes", label: t.admin.finishes, show: isOps },
    { href: "/admin/categories", label: t.admin.categories, show: isOps },
    { href: "/admin/locations", label: t.admin.locations, show: isOps },
    { href: "/admin/users", label: t.admin.users, show: isAdmin },
    { href: "/admin/opening-balances", label: t.opening.title, show: isAdmin },
  ].filter((x) => x.show);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t.admin.title}</h1>
      <nav className="grid grid-cols-2 gap-3">
        {tiles.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="tap flex min-h-20 items-center rounded-lg border border-sand bg-surface px-4 py-4 font-medium"
          >
            {tile.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
