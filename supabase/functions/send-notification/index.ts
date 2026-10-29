// Delivers queued rows from public.notifications as Web Push to every device the
// member has subscribed.
//
// Called by the database (pg_net): {"id": "<notification id>"} right after an
// insert, or {"sweep": true} every 5 minutes to retry anything undelivered.
// Authenticated with the x-prep-secret header, not a user JWT.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import webpush from "npm:web-push@3.6.7";

type Notification = {
  id: string;
  member_id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  attempts: number;
};

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT")!,
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

const MAX_ATTEMPTS = 5;

Deno.serve(async (req) => {
  if (req.headers.get("x-prep-secret") !== Deno.env.get("PREP_FUNCTIONS_SECRET")) {
    return new Response("unauthorized", { status: 401 });
  }
  const input = await req.json().catch(() => ({}));

  let query = supabase.from("notifications").select("*").is("delivered_at", null).lt("attempts", MAX_ATTEMPTS);
  if (input.id) {
    query = query.eq("id", input.id);
  } else if (input.sweep) {
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
    const minuteAgo = new Date(Date.now() - 60_000).toISOString();
    query = query.gte("sent_at", dayAgo).lte("sent_at", minuteAgo).order("sent_at").limit(50);
  } else {
    return new Response("expected id or sweep", { status: 400 });
  }

  const { data: rows, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

  const results = [];
  for (const row of (rows ?? []) as Notification[]) {
    results.push({ id: row.id, ...(await deliver(row)) });
  }
  return Response.json({ delivered: results });
});

async function deliver(n: Notification) {
  // Claim the row so a concurrent sweep doesn't send it twice.
  const { data: claimed } = await supabase
    .from("notifications")
    .update({ delivered_at: new Date().toISOString(), attempts: n.attempts + 1 })
    .eq("id", n.id)
    .is("delivered_at", null)
    .select("id");
  if (!claimed?.length) return { skipped: "already claimed" };

  const push = await sendPush(n);

  // Retry later only if nothing got through and a retry could help.
  const retry = push.sent === 0 && push.transient > 0 && n.attempts + 1 < MAX_ATTEMPTS;

  await supabase
    .from("notifications")
    .update({ delivery: { push }, ...(retry ? { delivered_at: null } : {}) })
    .eq("id", n.id);

  return { push, retry };
}

async function sendPush(n: Notification) {
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("member_id", n.member_id);

  const payload = JSON.stringify({ title: n.title, body: n.body, link: n.link ?? "/", tag: `${n.kind}:${n.id}` });
  let sent = 0;
  let removed = 0;
  let transient = 0;

  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 4 * 3600, urgency: "high" },
      );
      sent++;
      await supabase.from("push_subscriptions").update({ last_ok_at: new Date().toISOString() }).eq("id", sub.id);
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        // The browser unsubscribed or the app was uninstalled.
        removed++;
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      } else {
        transient++;
        console.error("push failed", status, (err as Error).message);
      }
    }
  }
  return { devices: subs?.length ?? 0, sent, removed, transient };
}
