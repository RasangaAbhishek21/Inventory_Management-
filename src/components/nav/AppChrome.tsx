"use client";

import { useState } from "react";
import { Topbar } from "./Topbar";
import { Sidebar, type NavContext } from "./Sidebar";

/** Dark top bar + light sidebar + content column (Shopify-admin chrome). */
export function AppChrome({
  ctx,
  children,
}: {
  ctx: NavContext;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col">
      <Topbar fullName={ctx.fullName} onMenu={() => setOpen(true)} />
      <div className="flex flex-1">
        <Sidebar ctx={ctx} open={open} onClose={() => setOpen(false)} />
        <main id="content" className="min-w-0 flex-1">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
