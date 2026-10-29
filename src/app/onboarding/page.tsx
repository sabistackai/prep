import { redirect } from "next/navigation";
import { createHousehold } from "@/app/auth/actions";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm, SubmitButton } from "@/components/form";
import { Field, inputClass } from "@/components/ui";
import { getSession } from "@/lib/auth";

export default async function OnboardingPage() {
  const { user, member } = await getSession();
  if (!user) redirect("/login");
  if (member) redirect("/");

  return (
    <AuthShell title="Set up your home" subtitle="You can add the children and the nanny next.">
      <ActionForm action={createHousehold} className="space-y-4">
        <Field label="Household name">
          <input name="household" placeholder="The Okafors" required className={inputClass} />
        </Field>
        <Field label="Your name" hint="The nanny sees this on tasks, e.g. “New task from Mrs Okafor”.">
          <input name="display_name" placeholder="Mrs Okafor" required className={inputClass} />
        </Field>
        <SubmitButton className="w-full">Continue</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
