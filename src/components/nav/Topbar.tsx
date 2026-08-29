"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { t } from "@/strings";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function Topbar({
  fullName,
  onMenu,
}: {
  fullName: string;
  onMenu?: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-topbar px-3 text-topbar-fg md:px-4">
      {onMenu ? (
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open menu"
          className="rounded-md p-2 hover:bg-white/10 md:hidden"
        >
          <span className="block h-0.5 w-5 bg-current shadow-[0_6px_0_currentColor,0_-6px_0_currentColor]" />
        </button>
      ) : null}

      <Link href="/" className="flex items-center gap-2 font-semibold text-white">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-white text-sm font-bold text-topbar">
          47
        </span>
        <span className="hidden sm:inline">{t.appName}</span>
      </Link>

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : "/");
        }}
        className="mx-auto w-full max-w-xl"
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products"
          className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-white placeholder:text-white/60 focus:border-white/40 focus:bg-white/15 focus:outline-none"
        />
      </form>

      <span
        title={fullName}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15 text-xs font-semibold text-white"
      >
        {initials(fullName)}
      </span>
    </header>
  );
}
