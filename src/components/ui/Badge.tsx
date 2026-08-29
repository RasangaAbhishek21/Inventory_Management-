import type { ReactNode } from "react";

type Tone = "neutral" | "success" | "danger" | "amber";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-subtle text-ink-60 ring-1 ring-inset ring-border",
  success: "bg-success-bg text-success",
  danger: "bg-danger-bg text-danger",
  amber: "bg-amber-bg text-amber",
};

/** Rounded status pill — Shopify-style. */
export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
