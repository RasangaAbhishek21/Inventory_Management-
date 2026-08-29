import Link from "next/link";
import { t } from "@/strings";

const REPORTS = [
  { href: "/reports/stock-on-hand", label: t.reports.stockOnHand },
  { href: "/reports/movement", label: t.reports.stockMovement },
  { href: "/reports/in-transit", label: t.reports.inTransit },
  { href: "/reports/close-pack", label: t.reports.closePack },
  { href: "/adjustments/variances", label: t.reports.openVariances },
];

export default function ReportsIndex() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t.reports.title}</h1>
      <nav className="grid grid-cols-2 gap-3">
        {REPORTS.map((r) => (
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
