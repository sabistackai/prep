import Link from "next/link";
import { CareBoard } from "@/components/care-board";
import { PageHeader } from "@/components/ui";
import { requireNanny } from "@/lib/auth";
import { careAlert, loadCareCards, loadCareToday } from "@/lib/care-data";
import { formatDay } from "@/lib/format";

// The day's schedule: meals, bath, medicine and so on, ticked off as they happen.
export default async function NannyTodayPage() {
  const { supabase } = await requireNanny();
  const [{ date, rows, kids }, { card }] = await Promise.all([loadCareToday(supabase), loadCareCards(supabase)]);
  const alerts = kids.map((k) => ({ kid: k, alert: careAlert(card(k.id)) })).filter((a) => a.alert);

  return (
    <>
      <PageHeader title="Today" subtitle={formatDay(date)} />

      {alerts.length > 0 && (
        <Link
          href="/nanny/kids"
          className="mb-4 block space-y-1 rounded-[10px] bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          {alerts.map(({ kid, alert }) => (
            <p key={kid.id}>
              <span className="font-extrabold">! {kid.name}:</span> {alert}
            </p>
          ))}
          <p className="font-bold underline">See care cards</p>
        </Link>
      )}

      <CareBoard
        date={date}
        rows={rows}
        kids={kids}
        canTick
        leadMinutes={30}
        emptyText="Nothing on the schedule today."
      />

      <Link
        href="/nanny/kids"
        className="mt-5 flex min-h-12 items-center justify-between rounded-[10px] border border-border bg-surface px-4 text-sm font-bold"
      >
        Care cards and emergency contacts <span className="text-muted">›</span>
      </Link>
    </>
  );
}
