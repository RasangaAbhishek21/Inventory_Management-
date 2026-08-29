import type { ReactNode } from "react";

/** White surface with a hairline + faint shadow — the Shopify-admin card. */
export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.06)] ${
        padded ? "p-4" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
