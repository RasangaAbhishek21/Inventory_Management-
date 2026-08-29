"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(auth)/login/actions";
import { t } from "@/strings";

export interface NavContext {
  fullName: string;
  locationName: string | null;
  canCapture: boolean;
  canOriginate: boolean;
  isOps: boolean;
  isAdmin: boolean;
  isReportViewer: boolean;
  inboundCount: number;
}

interface Item {
  href: string;
  label: string;
  show: boolean;
  badge?: number;
}
interface Section {
  heading?: string;
  items: Item[];
}

function buildSections(c: NavContext): Section[] {
  return [
    { items: [{ href: "/", label: t.nav.spotInventory, show: true }] },
    {
      heading: t.nav.groupRecord,
      items: [
        { href: "/originate", label: t.nav.originate, show: c.canCapture && c.canOriginate },
        { href: "/transfers/new", label: t.nav.sendTransfer, show: c.canCapture },
        {
          href: "/transfers/receive",
          label: t.nav.confirmReceipt,
          show: c.canCapture,
          badge: c.inboundCount || undefined,
        },
        { href: "/deliver", label: t.nav.deliver, show: c.canCapture },
        { href: "/returns", label: t.nav.returns, show: c.canCapture },
      ],
    },
    {
      heading: t.nav.groupControl,
      items: [
        { href: "/counts", label: t.nav.counts, show: true },
        { href: "/adjustments", label: t.nav.adjustments, show: c.isOps },
        { href: "/adjustments/variances", label: t.nav.openVariances, show: c.isOps },
      ],
    },
    {
      items: [
        { href: "/reports", label: t.nav.reports, show: c.isReportViewer },
        { href: "/admin", label: t.nav.admin, show: c.isOps },
      ],
    },
  ]
    .map((s) => ({ ...s, items: s.items.filter((i) => i.show) }))
    .filter((s) => s.items.length > 0);
}

function NavBody({ ctx, onNavigate }: { ctx: NavContext; onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="flex h-full flex-col">
      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto p-3">
        {buildSections(ctx).map((section, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            {section.heading ? (
              <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-60">
                {section.heading}
              </div>
            ) : null}
            {section.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                    active ? "bg-page font-semibold text-ink" : "text-ink-60 hover:bg-page hover:text-ink"
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge ? (
                    <span className="num rounded-full bg-ink px-1.5 text-xs font-semibold text-surface">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-2 border-t border-border p-3 text-sm">
        <div className="px-1 text-ink-60">
          {ctx.fullName}
          {ctx.locationName ? ` · ${ctx.locationName}` : ""}
        </div>
        <form action={signOut}>
          <button type="submit" className="px-1 text-sm text-ink-60 underline hover:text-ink">
            {t.auth.signOut}
          </button>
        </form>
      </div>
    </div>
  );
}

export function Sidebar({
  ctx,
  open,
  onClose,
}: {
  ctx: NavContext;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      <aside className="hidden w-60 shrink-0 border-r border-border bg-surface md:block">
        <div className="sticky top-14 h-[calc(100dvh-3.5rem)]">
          <NavBody ctx={ctx} />
        </div>
      </aside>

      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="absolute inset-0 bg-ink/40"
          />
          <div className="absolute left-0 top-0 h-full w-72 bg-surface">
            <NavBody ctx={ctx} onNavigate={onClose} />
          </div>
        </div>
      ) : null}
    </>
  );
}
