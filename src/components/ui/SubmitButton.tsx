"use client";

import { useFormStatus } from "react-dom";
import { PrimaryAction } from "./PrimaryAction";

/** Primary submit button that disables and relabels itself while the form action runs. */
export function SubmitButton({
  children,
  pendingLabel,
  disabled,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <PrimaryAction type="submit" disabled={pending || disabled}>
      {pending ? (pendingLabel ?? children) : children}
    </PrimaryAction>
  );
}
