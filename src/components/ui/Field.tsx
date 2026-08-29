import type { ReactNode } from "react";
import { t } from "@/strings";

/** Labeled form control. Pass the input/select/textarea as children. */
export function Field({
  label,
  hint,
  error,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">
        {label}
        {optional ? <span className="text-ink-60"> ({t.common.optional})</span> : null}
      </span>
      {children}
      {hint && !error ? <span className="text-sm text-ink-60">{hint}</span> : null}
      {error ? (
        <span role="alert" className="text-sm text-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export const fieldInputClass =
  "w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm shadow-sm " +
  "focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10";
