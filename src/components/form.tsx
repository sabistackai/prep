"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

export type FormState = { error?: string; ok?: string } | null;
export type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

// A form bound to a server action that shows the action's error or success message.
export function ActionForm({
  action,
  children,
  className,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-sm font-semibold text-success">
          {state.ok}
        </p>
      )}
    </form>
  );
}

const variants = {
  primary: "bg-primary text-on-primary hover:opacity-90",
  secondary: "border border-border bg-surface-2 text-text hover:border-primary",
  danger: "border border-danger text-danger hover:bg-danger-soft",
  ghost: "text-muted hover:text-text",
};

export function SubmitButton({
  children,
  variant = "primary",
  className = "",
  name,
  value,
}: {
  children: ReactNode;
  variant?: keyof typeof variants;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={`min-h-11 rounded-[10px] px-4 text-sm font-bold transition disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {pending ? "Saving…" : children}
    </button>
  );
}
