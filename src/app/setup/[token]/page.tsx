import { completeNannySetup } from "@/app/auth/actions";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm, SubmitButton } from "@/components/form";
import { Field, inputClass } from "@/components/ui";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function NannySetupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data: member } = await createAdminClient()
    .from("members")
    .select("display_name, setup_token_expires_at")
    .eq("setup_token", token)
    .eq("role", "nanny")
    .maybeSingle();

  const expired = member?.setup_token_expires_at && new Date(member.setup_token_expires_at) < new Date();
  if (!member || expired) {
    return (
      <AuthShell
        title="This link doesn't work"
        subtitle="It may have expired or already been used. Ask Madam or Oga to send you a new setup link."
      >
        {null}
      </AuthShell>
    );
  }

  const pinInput = `${inputClass} tabular-nums tracking-[0.5em]`;
  return (
    <AuthShell
      title={`Welcome, ${member.display_name}`}
      subtitle="Choose a 6-digit PIN. You'll use it with your phone number to sign in."
    >
      <ActionForm action={completeNannySetup} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <Field label="New PIN">
          <input name="pin" type="password" inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="new-password" required className={pinInput} />
        </Field>
        <Field label="Type the PIN again">
          <input name="confirm" type="password" inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="new-password" required className={pinInput} />
        </Field>
        <SubmitButton className="w-full">Save PIN</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
