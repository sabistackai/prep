import Link from "next/link";
import { parentSignIn, parentSignUp } from "@/app/auth/actions";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm, SubmitButton } from "@/components/form";
import { Field, inputClass } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string }>;
}) {
  const { mode, error } = await searchParams;
  const signingUp = mode === "signup";

  return (
    <AuthShell
      title={signingUp ? "Create a parent account" : "Parent sign in"}
      subtitle="Set the week once. PREP reminds the nanny every evening."
    >
      {error === "link" && (
        <p className="mb-4 text-sm text-danger">That link has expired or was already used. Sign in instead.</p>
      )}
      <ActionForm action={signingUp ? parentSignUp : parentSignIn} className="space-y-4">
        <Field label="Email">
          <input name="email" type="email" autoComplete="email" required className={inputClass} />
        </Field>
        <Field label="Password" hint={signingUp ? "At least 8 characters." : undefined}>
          <input
            name="password"
            type="password"
            autoComplete={signingUp ? "new-password" : "current-password"}
            required
            className={inputClass}
          />
        </Field>
        <SubmitButton className="w-full">{signingUp ? "Create account" : "Sign in"}</SubmitButton>
      </ActionForm>

      <div className="mt-6 space-y-3 text-sm text-muted">
        <p>
          {signingUp ? "Already have an account? " : "New to PREP? "}
          <Link href={signingUp ? "/login" : "/login?mode=signup"} className="font-semibold text-primary underline-offset-4 hover:underline">
            {signingUp ? "Sign in" : "Create an account"}
          </Link>
        </p>
        <p>
          Nanny?{" "}
          <Link href="/nanny/login" className="font-semibold text-primary underline-offset-4 hover:underline">
            Sign in with your phone
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
