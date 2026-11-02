"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SubmitButton } from "@/components/form";
import { careKind, careState, careTotals, sortCare, type CareRow, type CareState } from "@/lib/care";
import { formatClock } from "@/lib/format";
import { careQueue, isNetworkError } from "@/lib/offline-ticks";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/database.types";

type Child = Pick<Tables<"children">, "id" | "name" | "color">;

const RETRY_MS = 20_000;

// Show ticks still waiting in the offline queue over what the server last said.
function withQueued(row: CareRow): CareRow {
  const q = careQueue.read()[row.id];
  if (!q) return row;
  return { ...row, done_at: q.checked ? (row.done_at ?? q.at) : null };
}

// One day's schedule in time order, live via Supabase Realtime. The nanny ticks
// (canTick, with offline queueing like the prep list); parents watch and can skip an item.
export function CareBoard({
  date,
  rows: initialRows,
  kids,
  canTick,
  leadMinutes,
  skipAction,
  emptyText,
}: {
  date: string;
  rows: CareRow[];
  kids: Child[];
  canTick: boolean;
  leadMinutes: number;
  skipAction?: (formData: FormData) => Promise<void>;
  emptyText: string;
}) {
  const [rows, setRows] = useState(initialRows);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [waiting, setWaiting] = useState(0);
  const syncing = useRef(false);
  const supabase = useMemo(() => createClient(), []);

  const sync = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      const queued = Object.entries(careQueue.read()).sort(([, a], [, b]) => a.at.localeCompare(b.at));
      for (const [id, tick] of queued) {
        const { error } = await supabase.rpc("tick_care", { p_id: id, p_done: tick.checked, p_at: tick.at });
        if (isNetworkError(error)) break;
        careQueue.dequeue(id, tick); // sent, or the item is gone (schedule changed)
      }
    } finally {
      syncing.current = false;
      setWaiting(Object.keys(careQueue.read()).length);
    }
  }, [supabase]);

  useEffect(() => setRows(initialRows.map(withQueued)), [initialRows]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`care:${date}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "care_log", filter: `for_date=eq.${date}` }, (change) => {
        if (change.eventType === "DELETE") {
          setRows((prev) => prev.filter((r) => r.id !== (change.old as CareRow).id));
        } else {
          const row = withQueued(change.new as CareRow);
          setRows((prev) => (prev.some((r) => r.id === row.id) ? prev.map((r) => (r.id === row.id ? row : r)) : [...prev, row]));
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, date]);

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
    const retry = setInterval(() => Object.keys(careQueue.read()).length && sync(), RETRY_MS);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(retry);
    };
  }, [canTick, sync]);

  async function toggle(row: CareRow) {
    const tick = { checked: !row.done_at, at: new Date().toISOString() };
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, done_at: tick.checked ? tick.at : null } : r)));
    setError(null);

    const queue = () => {
      careQueue.enqueue(row.id, tick);
      setWaiting(Object.keys(careQueue.read()).length);
    };
    if (!navigator.onLine || Object.keys(careQueue.read()).length) {
      queue();
      if (navigator.onLine) sync();
      return;
    }
    const { error } = await supabase.rpc("tick_care", { p_id: row.id, p_done: tick.checked, p_at: tick.at });
    if (isNetworkError(error)) {
      queue();
    } else if (error) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, done_at: row.done_at } : r)));
      setError("That didn't save. Please tap it again.");
    }
  }

  const order = kids.map((k) => k.id);
  const sorted = sortCare(rows, order);
  const child = (id: string) => kids.find((k) => k.id === id);
  const totals = careTotals(rows, now);
  const slots = [...new Set(sorted.map((r) => r.due_at))].map((due) => ({ due, rows: sorted.filter((r) => r.due_at === due) }));

  if (!rows.length) {
    return (
      <p className="rounded-[16px] border border-border bg-surface p-4 text-sm text-muted">{emptyText}</p>
    );
  }

  return (
    <div className="space-y-3">
      <p
        className={`rounded-[10px] px-4 py-3 text-sm font-bold ${
          totals.late ? "bg-danger-soft text-danger" : totals.done === totals.total ? "bg-success-soft text-success" : "bg-surface-2 text-text"
        }`}
      >
        {totals.done === totals.total && totals.total > 0
          ? `✓ All ${totals.total} done`
          : `${totals.done} of ${totals.total} done`}
        {totals.late > 0 && ` · ! ${totals.late} late`}
      </p>

      {canTick && (offline || waiting > 0) && (
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

      <ol className="space-y-3">
        {slots.map((slot) => (
          <li key={slot.due} className="rounded-[16px] border border-border bg-surface shadow-sm shadow-text/5 dark:shadow-none">
            <h3 className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
              <span className="font-display text-lg font-semibold">{formatClock(slot.due)}</span>
              <SlotBadge states={slot.rows.map((r) => careState(r, now, leadMinutes))} />
            </h3>
            <ul className="divide-y divide-border">
              {slot.rows.map((row) => {
                const kid = child(row.child_id);
                const state = careState(row, now, leadMinutes);
                const kind = careKind(row.kind);
                const body = (
                  <span className="min-w-0 flex-1">
                    <span className={`flex items-center gap-2 font-semibold ${row.done_at || row.skipped_at ? "text-muted" : ""}`}>
                      <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: kid?.color }} />
                      <span className={row.done_at ? "line-through" : ""}>
                        {kid?.name}: {row.title}
                      </span>
                    </span>
                    {row.details && <span className="mt-0.5 block text-sm text-muted">{row.details}</span>}
                    <StateLine state={state} row={row} />
                  </span>
                );
                return (
                  <li key={row.id} className="px-4 py-2">
                    {canTick && !row.skipped_at ? (
                      <button
                        type="button"
                        onClick={() => toggle(row)}
                        aria-pressed={!!row.done_at}
                        className="flex min-h-14 w-full items-center gap-4 text-left"
                      >
                        <TickBox checked={!!row.done_at} />
                        <span aria-hidden className="text-xl">{kind.icon}</span>
                        {body}
                      </button>
                    ) : (
                      <div className="flex min-h-12 items-center gap-3">
                        <span aria-hidden className="w-6 text-center text-lg">{kind.icon}</span>
                        {body}
                        {skipAction && !row.done_at && (
                          <form action={skipAction}>
                            <input type="hidden" name="id" value={row.id} />
                            <input type="hidden" name="skip" value={row.skipped_at ? "false" : "true"} />
                            <SubmitButton variant="ghost" className="px-1 text-xs">
                              {row.skipped_at ? "Put back" : "Skip today"}
                            </SubmitButton>
                          </form>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
      {canTick && (offline || waiting > 0) && <div aria-hidden className="h-14" />}
    </div>
  );
}

function StateLine({ state, row }: { state: CareState; row: CareRow }) {
  const base = "mt-1 inline-flex items-center gap-1 text-xs font-extrabold";
  switch (state) {
    case "done":
      return <span className={`${base} text-success`}>✓ Done {formatClock(row.done_at!)}</span>;
    case "done_late":
      return <span className={`${base} text-accent-text`}>✓ Done late, {formatClock(row.done_at!)}</span>;
    case "skipped":
      return <span className={`${base} text-muted`}>Skipped today</span>;
    case "late":
      return <span className={`${base} text-danger`}>! Late: not ticked yet</span>;
    default:
      return null;
  }
}

// The time slot's headline state, with a symbol as well as colour.
function SlotBadge({ states }: { states: CareState[] }) {
  const base = "rounded-full px-3 py-1 text-xs font-extrabold";
  const open = states.filter((s) => s !== "done" && s !== "done_late" && s !== "skipped");
  if (!open.length) return <span className={`${base} bg-success-soft text-success`}>✓ Done</span>;
  if (open.includes("late")) return <span className={`${base} bg-danger-soft text-danger`}>! Late</span>;
  if (open.includes("soon")) return <span className={`${base} bg-accent-soft text-accent-text`}>◷ Coming up</span>;
  return null;
}

function TickBox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid size-[26px] shrink-0 place-items-center rounded-lg border-2 text-base font-extrabold transition ${
        checked ? "border-accent bg-accent text-on-accent" : "border-border"
      }`}
    >
      {checked ? "✓" : ""}
    </span>
  );
}
