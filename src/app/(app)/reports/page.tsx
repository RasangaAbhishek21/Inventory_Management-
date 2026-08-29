import Link from "next/link";
import { requireRole } from "@/lib/auth";
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
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t.reports.title}</h1>
      <nav className="grid grid-cols-2 gap-3">
        {reports.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="tap flex min-h-20 items-center rounded-lg border border-sand bg-surface px-4 py-4 font-medium"
          >
            {r.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
