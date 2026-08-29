"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, type SignInState } from "./actions";
import { PrimaryAction } from "@/components/ui/PrimaryAction";
import { t } from "@/strings";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <PrimaryAction type="submit" disabled={pending}>
      {pending ? t.auth.signingIn : t.auth.signInAction}
    </PrimaryAction>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<SignInState, FormData>(signIn, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <label className="flex flex-col gap-1 text-sm">
        {t.auth.email}
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="rounded-lg border border-sand bg-surface px-3 py-2 text-base"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {t.auth.password}
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-lg border border-sand bg-surface px-3 py-2 text-base"
        />
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />

      <p className="text-sm text-ink-60">{t.auth.noAccount}</p>
    </form>
  );
}
