import Link from "next/link";
import { PushSetup } from "@/components/push-setup";
import { ThemeSelect } from "@/components/theme";
import { Card, labelClass, PageHeader } from "@/components/ui";
import { requireNanny } from "@/lib/auth";

export default async function NannyNotificationsPage() {
  await requireNanny();
  return (
    <>
      <PageHeader title="Notifications" subtitle="Do this once on your phone." />
      <Card>
        <PushSetup audience="nanny" />
      </Card>

      <h2 className={`mt-8 mb-2 ${labelClass}`}>Appearance</h2>
      <ThemeSelect />

      <Link
        href="/nanny"
        className="mt-8 flex min-h-12 items-center justify-center rounded-[10px] border border-border bg-surface-2 text-sm font-bold"
      >
        Go to tonight&apos;s prep
      </Link>
    </>
  );
}
