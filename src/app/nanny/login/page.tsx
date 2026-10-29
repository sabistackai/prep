import Link from "next/link";
import { nannySignIn } from "@/app/auth/actions";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm, SubmitButton } from "@/components/form";
import { Field, inputClass } from "@/components/ui";

export default function NannyLoginPage() {
  return (
    <AuthShell title="Sign in" subtitle="Use your phone number and the 6-digit PIN you chose.">
      <ActionForm action={nannySignIn} className="space-y-4">
        <Field label="Phone number">
          <input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0803 000 0000" required className={inputClass} />
        </Field>
        <Field label="PIN">
          <input
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoComplete="current-password"
            required
            className={`${inputClass} tabular-nums tracking-[0.5em]`}
          />
        </Field>
        <SubmitButton className="w-full">Sign in</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-sm text-muted">
        Forgot your PIN? Ask Madam or Oga to send you a new setup link.{" "}
        <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
          Parent sign in
        </Link>
      </p>
    </AuthShell>
  );
}
