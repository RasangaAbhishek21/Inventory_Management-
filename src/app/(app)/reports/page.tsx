import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { t } from "@/strings";

export default async function ReportsIndex() {
  const user = await requireRole("ops_manager", "finance", "admin");
  const financeOrAdmin = user.role === "finance" || user.role === "admin";

  const reports = [
    { href: "/reports/stock-accuracy", label: t.reports.stockAccuracy, show: true },
    { href: "/reports/stock-on-hand", label: t.reports.stockOnHand, show: true },
    { href: "/reports/movement", label: t.reports.stockMovement, show: true },
    { href: "/reports/in-transit", label: t.reports.inTransit, show: true },
    { href: "/reports/close-pack", label: t.reports.closePack, show: true },
    { href: "/adjustments/variances", label: t.reports.openVariances, show: true },
    {
      href: "/reports/adjustment-exceptions",
      label: t.reports.adjustmentExceptions,
      show: financeOrAdmin,
    },
  ].filter((r) => r.show);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t.reports.title} />
      <nav className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="flex min-h-16 items-center rounded-xl border border-border bg-surface px-4 py-4 text-sm font-medium shadow-sm transition-colors hover:bg-surface-subtle"
          >
            {r.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
