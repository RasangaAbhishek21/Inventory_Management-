import type { ComponentProps } from "react";

/**
 * Primary button — near-black fill, white text (like the Shopify admin's primary
 * action). Full width by default for form submits; pass `inline` for a compact button
 * (page-header actions, toolbars).
 */
export function PrimaryAction({
  className = "",
  inline = false,
  ...props
}: ComponentProps<"button"> & { inline?: boolean }) {
  return (
    <button
      {...props}
      className={
        "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg " +
        "shadow-sm transition-[filter] hover:brightness-110 active:brightness-95 " +
        "disabled:cursor-not-allowed disabled:opacity-50 " +
        (inline ? "" : "w-full ") +
        className
      }
    />
  );
}

/** Secondary button — white with a hairline border. */
export function SecondaryButton({
  className = "",
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      {...props}
      className={
        "inline-flex items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-ink " +
        "transition-colors hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-50 " +
        className
      }
    />
  );
}
