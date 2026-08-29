import type { ComponentProps } from "react";

/**
 * The ONE primary action per screen (brief §9). This is the only component permitted to
 * paint Home Yellow (#F7C517) — always as a fill behind near-black text, never as a
 * foreground colour. Do not reach for `bg-yellow` anywhere else.
 */
export function PrimaryAction({
  className = "",
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      {...props}
      className={
        "w-full rounded-lg bg-yellow px-5 py-3 text-center text-base font-semibold text-ink " +
        "transition-[filter] active:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed " +
        className
      }
    />
  );
}
