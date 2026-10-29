import Link from "next/link";
import { PushSetup } from "@/components/push-setup";
import { Card, PageHeader } from "@/components/ui";
import { requireNanny } from "@/lib/auth";

export default async function NannyNotificationsPage() {
  await requireNanny();
  return (
    <>
      <PageHeader title="Notifications" subtitle="Do this once on your phone." />
      <Card>
        <PushSetup audience="nanny" />
      </Card>
      <Link href="/nanny" className="mt-6 flex min-h-12 items-center justify-center rounded-xl border border-line text-sm">
        Go to tonight&apos;s prep
      </Link>
    </>
  );
}
