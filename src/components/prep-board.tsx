"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dequeueTick, enqueueTick, isNetworkError, readQueue } from "@/lib/offline-ticks";
import type { Tables } from "@/lib/database.types";

type Item = Pick<Tables<"prep_items">, "id" | "child_id" | "label" | "group_label" | "sort" | "checked_at">;
type Child = Pick<Tables<"children">, "id" | "name" | "color">;
type Session = Pick<Tables<"prep_sessions">, "id" | "for_date" | "status" | "deadline_at" | "completed_at">;

const clock = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "Africa/Lagos",
});
export const formatClock = (iso: string) => clock.format(new Date(iso));

const DUE_SOON_MS = 30 * 60 * 1000;
const RETRY_MS = 20_000;

// Show ticks still waiting in the offline queue over what the server last said.
function withQueued<T extends Pick<Item, "id" | "checked_at">>(item: T): T {
  const q = readQueue()[item.id];
  if (!q) return item;
  return { ...item, checked_at: q.checked ? (item.checked_at ?? q.at) : null };
}

// One card per child, items grouped by outfit / activity, live via Supabase Realtime.
// The nanny ticks (canTick); parents watch. Status colours follow the theme spec's mapping.
export function PrepBoard({
  session: initialSession,
  items: initialItems,
  kids,
  canTick,
}: {
  session: Session;
  items: Item[];
  kids: Child[];
  canTick: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [session, setSession] = useState(initialSession);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [offline, setOffline] = useState(false);
  const [waiting, setWaiting] = useState(0);
  const syncing = useRef(false);
  const supabase = useMemo(() => createClient(), []);

  // Send queued offline ticks, oldest first; stop at the first network failure.
  const sync = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      const queued = Object.entries(readQueue()).sort(([, a], [, b]) => a.at.localeCompare(b.at));
      for (const [id, tick] of queued) {
        const { error } = await supabase.rpc("tick_item", { p_item_id: id, p_checked: tick.checked, p_at: tick.at });
        if (isNetworkError(error)) break;
        dequeueTick(id, tick); // sent, or the item no longer exists (list rebuilt)
      }
    } finally {
      syncing.current = false;
      setWaiting(Object.keys(readQueue()).length);
    }
  }, [supabase]);

  useEffect(() => setItems(initialItems.map(withQueued)), [initialItems]);
  useEffect(() => setSession(initialSession), [initialSession]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`prep:${initialSession.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prep_items", filter: `session_id=eq.${initialSession.id}` },
        (change) => {
          if (change.eventType === "DELETE") {
            setItems((prev) => prev.filter((i) => i.id !== (change.old as Item).id));
          } else {
            const row = withQueued(change.new as Item);
            setItems((prev) => (prev.some((i) => i.id === row.id) ? prev.map((i) => (i.id === row.id ? row : i)) : [...prev, row]));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "prep_sessions", filter: `id=eq.${initialSession.id}` },
        (change) => setSession(change.new as Session),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, initialSession.id]);

  useEffect(() => {
    if (!canTick) return;
    const update = () => {
      setOffline(!navigator.onLine);
      if (navigator.onLine) sync();
    };
    const onVisible = () => document.visibilityState === "visible" && update();
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    document.addEventListener("visibilitychange", onVisible);
    // navigator.onLine can say "online" with no real signal, so keep retrying while ticks wait.
    const retry = setInterval(() => Object.keys(readQueue()).length && sync(), RETRY_MS);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(retry);
    };
  }, [canTick, sync]);

  async function toggle(item: Item) {
    const tick = { checked: !item.checked_at, at: new Date().toISOString() };
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, checked_at: tick.checked ? tick.at : null } : i)));
    setError(null);

    const queue = () => {
      enqueueTick(item.id, tick);
      setWaiting(Object.keys(readQueue()).length);
    };
    // Send queued ticks first so an older offline tap can't land after this one.
    if (!navigator.onLine || Object.keys(readQueue()).length) {
      queue();
      if (navigator.onLine) sync();
      return;
    }

    const { error } = await supabase.rpc("tick_item", { p_item_id: item.id, p_checked: tick.checked, p_at: tick.at });
    if (isNetworkError(error)) {
      queue();
    } else if (error) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, checked_at: item.checked_at } : i)));
      setError("That didn't save. Please tap it again.");
    }
  }

  const byChild = kids
    .map((child) => {
      const mine = items.filter((i) => i.child_id === child.id).sort((a, b) => a.sort - b.sort);
      const groups = [...new Set(mine.map((i) => i.group_label))].map((label) => ({
        label,
        items: mine.filter((i) => i.group_label === label),
      }));
      const done = mine.filter((i) => i.checked_at).length;
      const readyAt =
        mine.length > 0 && done === mine.length
          ? mine.reduce((max, i) => (i.checked_at! > max ? i.checked_at! : max), mine[0].checked_at!)
          : null;
      return { child, groups, done, total: mine.length, readyAt };
    })
    .filter((c) => c.total > 0);

  const ready = byChild.filter((c) => c.readyAt).length;
  const overdue = session.status === "overdue";
  const dueSoon =
    session.status === "pending" && new Date(session.deadline_at).getTime() - now < DUE_SOON_MS;

  return (
    <div className="space-y-4">
      <StatusBanner session={session} ready={ready} total={byChild.length} dueSoon={dueSoon} />
      {canTick && (offline || waiting > 0) && (
        // Pinned above the tab bar so the list never moves under the nanny's thumb.
        <p
          role="status"
          className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 mx-auto max-w-2xl bg-primary-soft px-4 py-3 text-sm font-semibold text-primary"
        >
          {offline
            ? "You're offline. Keep ticking: ticks are saved on this phone and send when you're back online."
            : `Sending ${waiting} saved ${waiting === 1 ? "tick" : "ticks"}…`}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-[10px] bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      {byChild.map(({ child, groups, done, total, readyAt }) => (
        <section key={child.id} className="rounded-[16px] border border-border bg-surface shadow-sm shadow-text/5 dark:shadow-none">
          <header className="space-y-3 border-b border-border px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-3">
                <Avatar name={child.name} color={child.color} />
                <span className="font-display text-xl font-semibold">{child.name}</span>
              </h2>
              <ChildBadge done={done} total={total} readyAt={readyAt} overdue={overdue} />
            </div>
            <Progress done={done} total={total} overdue={overdue} />
          </header>

          <div className="divide-y divide-border">
            {groups.map((group) => (
              <div key={group.label} className="px-4 py-3">
                <h3 className="mb-1 text-xs font-extrabold uppercase tracking-[0.12em] text-muted">{group.label}</h3>
                <ul>
                  {group.items.map((item) =>
                    canTick ? (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => toggle(item)}
                          aria-pressed={!!item.checked_at}
                          className="flex min-h-14 w-full items-center gap-4 text-left"
                        >
                          <TickBox checked={!!item.checked_at} size="lg" />
                          <span className={`text-base font-semibold ${item.checked_at ? "text-muted line-through" : ""}`}>
                            {item.label}
                          </span>
                        </button>
                      </li>
                    ) : (
                      <li key={item.id} className="flex min-h-9 items-center gap-3 text-sm">
                        <TickBox checked={!!item.checked_at} size="sm" />
                        <span className={item.checked_at ? "text-muted" : ""}>{item.label}</span>
                        {item.checked_at && (
                          <span className="ml-auto text-xs tabular-nums text-muted">{formatClock(item.checked_at)}</span>
                        )}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
      {canTick && (offline || waiting > 0) && <div aria-hidden className="h-14" />}
    </div>
  );
}

// Child colours are light enough for ink text in both themes.
function Avatar({ name, color }: { name: string; color: string }) {
  return (
    <span
      aria-hidden
      className="grid size-9 place-items-center rounded-full font-display text-base font-semibold text-on-accent"
      style={{ background: color }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

// Unticked: border outline. Ticked: marigold fill with an ink tick, like the logo's bowl.
function TickBox({ checked, size }: { checked: boolean; size: "sm" | "lg" }) {
  const box = size === "lg" ? "size-[26px] rounded-lg text-base" : "size-5 rounded-md text-xs";
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center border-2 font-extrabold transition ${box} ${
        checked ? "border-accent bg-accent text-on-accent" : "border-border"
      }`}
    >
      {checked ? "✓" : ""}
    </span>
  );
}

function ChildBadge({ done, total, readyAt, overdue }: { done: number; total: number; readyAt: string | null; overdue: boolean }) {
  const base = "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold tabular-nums";
  if (readyAt) {
    return (
      <span className={`${base} bg-success-soft text-success`}>
        ✓ Ready {formatClock(readyAt)}
      </span>
    );
  }
  if (overdue) {
    return (
      <span className={`${base} bg-danger-soft text-danger`}>
        ! {done} of {total}
      </span>
    );
  }
  if (done === 0) return <span className={`${base} bg-surface-2 text-muted`}>Not started</span>;
  return (
    <span className={`${base} bg-accent-soft text-accent-text`}>
      {done} of {total}
    </span>
  );
}

function Progress({ done, total, overdue }: { done: number; total: number; overdue: boolean }) {
  const complete = done === total;
  const fill = complete ? "bg-success" : overdue ? "bg-danger" : "bg-accent";
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      className="h-2 overflow-hidden rounded-full bg-surface-2"
    >
      <div className={`h-full rounded-full transition-all ${fill}`} style={{ width: `${(done / total) * 100}%` }} />
    </div>
  );
}

function StatusBanner({ session, ready, total, dueSoon }: { session: Session; ready: number; total: number; dueSoon: boolean }) {
  const base = "rounded-[10px] px-4 py-3 text-sm font-bold tabular-nums";
  if (session.status === "complete") {
    return (
      <p className={`${base} bg-success-soft text-success`}>
        ✓ Everyone is ready{session.completed_at && ` · ${formatClock(session.completed_at)}`}
      </p>
    );
  }
  if (session.status === "overdue") {
    return (
      <p className={`${base} bg-danger-soft text-danger`}>
        {`! Overdue: ${ready} of ${total} ready. The deadline was ${formatClock(session.deadline_at)}.`}
      </p>
    );
  }
  if (dueSoon) {
    return (
      <p className={`${base} bg-warning-soft text-warning`}>
        {`◷ Due soon: ${ready} of ${total} ready, due by ${formatClock(session.deadline_at)}`}
      </p>
    );
  }
  return (
    <p className={`${base} bg-surface-2 text-text`}>
      <span className="font-display text-base font-semibold">{`${ready} of ${total} ready`}</span>
      <span className="font-semibold text-muted">{` · due by ${formatClock(session.deadline_at)}`}</span>
    </p>
  );
}
