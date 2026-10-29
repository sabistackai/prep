"use server";

import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type BrowserSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };

// Saves this device for the signed-in member. Upserts on the endpoint, so a
// phone handed from one person to another moves to its new owner.
export async function savePushSubscription(sub: BrowserSubscription, userAgent: string) {
  const { member } = await getSession();
  if (!member) throw new Error("Not signed in");
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) {
    throw new Error("Invalid subscription");
  }

  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .upsert(
      {
        member_id: member.id,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        user_agent: userAgent.slice(0, 300),
      },
      { onConflict: "endpoint" },
    );
  if (error) throw new Error(error.message);
}

export async function removePushSubscription(endpoint: string) {
  const { supabase, member } = await getSession();
  if (!member) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

// Now, or a few minutes later so it can be checked with PREP closed and the phone locked.
export async function sendTestNotification(delayMinutes = 0) {
  const { supabase, member } = await getSession();
  if (!member) throw new Error("Not signed in");
  const { error } = await supabase.rpc("send_test_notification", { p_delay_minutes: delayMinutes });
  if (error) throw new Error(error.message);
}
