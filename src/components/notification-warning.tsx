import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { formatDue } from "@/lib/format";

export type NannyHealth = { member_id: string; name: string; status: "off" | "failing"; last_ok_at: string | null };

// Nannies whose phones notifications can't reach (see notification_health()).
export async function loadNotificationHealth(supabase: SupabaseClient<Database>) {
  const { data } = await supabase.rpc("notification_health");
  return (data ?? []) as NannyHealth[];
}

const fix = "Ask them to open PREP, go to Alerts → Notifications";

// One warning per nanny. Status shown with "!" as well as colour.
export function NotificationWarning({ health }: { health: NannyHealth }) {
  const off = health.status === "off";
  return (
    <div role="alert" className="rounded-[10px] bg-warning-soft px-4 py-3 text-sm text-warning">
      <p className="font-bold">
        ! {off ? `${health.name} hasn't turned on notifications` : `${health.name}'s notifications may be off`}
      </p>
      <p className="mt-1">
        {off
          ? `They won't get tonight's checklist or new tasks. ${fix} and tap Turn on notifications.`
          : `The last reminder didn't reach their phone${
              health.last_ok_at ? ` (the last one that did was ${formatDue(health.last_ok_at)})` : ""
            }. ${fix}, follow the steps for their phone, then tap Test with the phone locked.`}
      </p>
    </div>
  );
}
