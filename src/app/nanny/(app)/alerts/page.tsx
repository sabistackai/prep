import Link from "next/link";
import { Card, Mono, PageHeader } from "@/components/ui";
import { requireNanny } from "@/lib/auth";
import { formatTime, weekdayName } from "@/lib/format";

// Week 3 adds notification history.
export default async function NannyAlertsPage() {
  const { supabase } = await requireNanny();
  const [{ data: activities }, { data: kids }] = await Promise.all([
    supabase.from("activities").select("*").eq("active", true).order("weekday").order("start_time"),
    supabase.from("children").select("id, name"),
  ]);

  return (
    <>
      <PageHeader title="Alerts" />
      <Link
        href="/nanny/notifications"
        className="mb-5 flex min-h-12 items-center justify-between rounded-[10px] border border-border bg-surface px-4 text-sm font-bold"
      >
        Notifications and appearance <span className="text-muted">›</span>
      </Link>
      <h2 className="mb-2 text-xs font-extrabold uppercase tracking-[0.12em] text-muted">Weekly activities</h2>
      <div className="space-y-2">
        {(activities ?? []).map((a) => (
          <Card key={a.id}>
            <p>
              <Mono>
                <span className="text-primary">
                  {weekdayName(a.weekday).slice(0, 3)} {formatTime(a.start_time)}
                </span>
              </Mono>{" "}
              <span className="font-semibold">{kids?.find((c) => c.id === a.child_id)?.name}</span>: {a.title}
            </p>
            {a.bring.length > 0 && <p className="mt-1 text-sm text-muted">Bring: {a.bring.join(", ")}</p>}
          </Card>
        ))}
        {!activities?.length && (
          <Card>
            <p className="text-muted">No activities yet.</p>
          </Card>
        )}
      </div>
    </>
  );
}
