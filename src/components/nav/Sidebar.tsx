"use client";

import { useState } from "react";
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
    {
      items: [{ href: "/", label: t.nav.spotInventory, show: true }],
    },
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

function NavList({ ctx, onNavigate }: { ctx: NavContext; onNavigate?: () => void }) {
  const pathname = usePathname();
  const sections = buildSections(ctx);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <nav className="flex flex-col gap-4">
      {sections.map((section, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          {section.heading ? (
            <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ink-60">
              {section.heading}
            </div>
          ) : null}
          {section.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium ${
                isActive(item.href) ? "bg-ink text-page" : "hover:bg-sand/40"
              }`}
            >
              <span>{item.label}</span>
              {item.badge ? (
                <span className="num rounded-full bg-yellow px-2 text-xs text-ink">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

function Footer({ ctx }: { ctx: NavContext }) {
  return (
    <div className="mt-auto flex flex-col gap-2 border-t border-sand px-3 pt-3 text-sm">
      <div className="text-ink-60">
        {ctx.fullName}
        {ctx.locationName ? ` · ${ctx.locationName}` : ""}
      </div>
      <form action={signOut}>
        <button type="submit" className="text-sm text-ink-60 underline">
          {t.auth.signOut}
        </button>
      </form>
    </div>
  );
}

export function Sidebar({ ctx }: { ctx: NavContext }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-4 border-r border-sand bg-surface px-3 py-4 md:flex">
        <Link href="/" className="px-3 text-lg font-semibold">
          {t.appName}
        </Link>
        <NavList ctx={ctx} />
        <Footer ctx={ctx} />
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-sand bg-surface px-4 py-3 md:hidden">
        <Link href="/" className="text-lg font-semibold">
          {t.appName}
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-lg border border-ink px-3 py-1.5 text-sm"
        >
          Menu
        </button>
      </header>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/40"
          />
          <div className="absolute left-0 top-0 flex h-full w-72 flex-col gap-4 bg-surface px-3 py-4">
            <div className="flex items-center justify-between px-3">
              <span className="text-lg font-semibold">{t.appName}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="text-sm text-ink-60"
              >
                Close
              </button>
            </div>
            <NavList ctx={ctx} onNavigate={() => setOpen(false)} />
            <Footer ctx={ctx} />
          </div>
        </div>
      ) : null}
    </>
  );
}
