import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
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
    <div className="flex flex-col gap-5">
      <PageHeader title={t.admin.title} />
      <nav className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="flex min-h-16 items-center rounded-xl border border-border bg-surface px-4 py-4 text-sm font-medium shadow-sm transition-colors hover:bg-surface-subtle"
          >
            {tile.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
