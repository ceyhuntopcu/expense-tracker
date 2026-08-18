"use client";

import { useActionState } from "react";
import type { AuthFormState } from "@/lib/auth-actions";

export function Field({
  label,
  name,
  type = "text",
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="label-caps">{label}</span>
      <input
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        className="mt-1.5 w-full bg-transparent border-0 border-b border-rule-strong rounded-none px-0 py-1.5 font-[family-name:var(--font-mono)] text-[15px] focus:outline-none focus:border-moss focus:border-b-2 transition-colors"
      />
    </label>
  );
}

export function AuthForm({
  action,
  submitLabel,
  children,
}: {
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  submitLabel: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-6">
      {children}
      {state?.error && (
        <p className="text-oxblood italic text-[15px]">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-ink text-cream py-2.5 label-caps !text-cream tracking-[0.2em] hover:bg-moss-deep transition-colors disabled:opacity-50 cursor-pointer"
      >
        {pending ? "One moment…" : submitLabel}
      </button>
    </form>
  );
}
