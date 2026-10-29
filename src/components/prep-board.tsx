"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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

// One card per child, items grouped by outfit / activity, live via Supabase Realtime.
// The nanny ticks (canTick); parents watch.
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
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => setItems(initialItems), [initialItems]);
  useEffect(() => setSession(initialSession), [initialSession]);

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
            const row = change.new as Item;
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

  async function toggle(item: Item) {
    const checked = !item.checked_at;
    const optimistic = checked ? new Date().toISOString() : null;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, checked_at: optimistic } : i)));
    setError(null);

    const { error } = await supabase.rpc("tick_item", { p_item_id: item.id, p_checked: checked });
    if (error) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, checked_at: item.checked_at } : i)));
      setError("That didn't save. Check your internet connection and tap again.");
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

  return (
    <div className="space-y-4">
      <StatusBanner session={session} ready={ready} total={byChild.length} />
      {error && (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {byChild.map(({ child, groups, done, total, readyAt }) => (
        <section key={child.id} className="rounded-2xl border border-line bg-surface">
          <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <span className="size-3 rounded-full" style={{ background: child.color }} />
              {child.name}
            </h2>
            {readyAt ? (
              <span className="rounded-full bg-lime px-3 py-1 text-xs font-bold text-lime-ink">
                Ready <span className="font-mono">{formatClock(readyAt)}</span>
              </span>
            ) : (
              <span className="font-mono text-sm text-muted">
                {done} of {total}
              </span>
            )}
          </header>

          <div className="divide-y divide-line">
            {groups.map((group) => (
              <div key={group.label} className="px-4 py-3">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{group.label}</h3>
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
                          <span
                            className={`grid size-8 shrink-0 place-items-center rounded-lg border-2 text-lg font-bold transition ${
                              item.checked_at ? "border-lime bg-lime text-lime-ink" : "border-line"
                            }`}
                          >
                            {item.checked_at ? "✓" : ""}
                          </span>
                          <span className={`text-base ${item.checked_at ? "text-muted line-through" : ""}`}>
                            {item.label}
                          </span>
                        </button>
                      </li>
                    ) : (
                      <li key={item.id} className="flex min-h-9 items-center gap-3 text-sm">
                        <span
                          className={`grid size-5 shrink-0 place-items-center rounded border text-xs ${
                            item.checked_at ? "border-lime bg-lime text-lime-ink" : "border-line"
                          }`}
                        >
                          {item.checked_at ? "✓" : ""}
                        </span>
                        <span className={item.checked_at ? "text-muted" : ""}>{item.label}</span>
                        {item.checked_at && (
                          <span className="ml-auto font-mono text-xs text-muted">{formatClock(item.checked_at)}</span>
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
    </div>
  );
}

function StatusBanner({ session, ready, total }: { session: Session; ready: number; total: number }) {
  if (session.status === "complete") {
    return (
      <p className="rounded-xl border border-lime/40 bg-lime/10 px-4 py-3 font-semibold text-lime">
        Everyone is ready
        {session.completed_at && (
          <>
            {" "}
            · <span className="font-mono">{formatClock(session.completed_at)}</span>
          </>
        )}
      </p>
    );
  }
  if (session.status === "overdue") {
    return (
      <p className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 font-semibold text-danger">
        Overdue: {ready} of {total} ready. The deadline was <span className="font-mono">{formatClock(session.deadline_at)}</span>.
      </p>
    );
  }
  return (
    <p className="rounded-xl border border-line bg-raised px-4 py-3 text-sm">
      <span className="font-semibold">
        {ready} of {total} ready
      </span>{" "}
      · due by <span className="font-mono">{formatClock(session.deadline_at)}</span>
    </p>
  );
}
