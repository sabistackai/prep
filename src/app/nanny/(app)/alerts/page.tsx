import { Card, Mono, PageHeader } from "@/components/ui";
import { requireNanny } from "@/lib/auth";
import { formatTime, weekdayName } from "@/lib/format";

// Week 3 adds notification history and leave-by times.
export default async function NannyAlertsPage() {
  const { supabase } = await requireNanny();
  const [{ data: activities }, { data: kids }] = await Promise.all([
    supabase.from("activities").select("*").eq("active", true).order("weekday").order("start_time"),
    supabase.from("children").select("id, name"),
  ]);

  return (
    <>
      <PageHeader title="Alerts" />
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Weekly activities</h2>
      <div className="space-y-2">
        {(activities ?? []).map((a) => (
          <Card key={a.id}>
            <p>
              <Mono>
                <span className="text-lime">
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
