"use client";

import { useRef, useState, useTransition } from "react";
import { setRoutineDay } from "@/app/parent/actions";
import { OUTFIT_COLORS, WEEKDAYS } from "@/lib/format";

type Outfit = { id: string; name: string };

const LONG_PRESS_MS = 450;

export function RoutineGrid({
  child,
  outfits,
  initial,
}: {
  child: { id: string; name: string; class_name: string | null; color: string };
  outfits: Outfit[];
  initial: Record<number, string>;
}) {
  const [days, setDays] = useState(initial);
  const [picking, setPicking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const longPressed = useRef(false);

  const colorOf = (id?: string) => OUTFIT_COLORS[outfits.findIndex((o) => o.id === id) % OUTFIT_COLORS.length];
  const nameOf = (id?: string) => outfits.find((o) => o.id === id)?.name ?? "None";

  function choose(weekday: number, outfitId: string) {
    const previous = days;
    setDays({ ...days, [weekday]: outfitId });
    setPicking(null);
    setError(null);
    startTransition(async () => {
      try {
        await setRoutineDay(child.id, weekday, outfitId);
      } catch {
        setDays(previous);
        setError("Couldn't save that change. Check your connection and try again.");
      }
    });
  }

  function cycle(weekday: number) {
    const i = outfits.findIndex((o) => o.id === days[weekday]);
    choose(weekday, outfits[(i + 1) % outfits.length].id);
  }

  function pressStart(weekday: number) {
    longPressed.current = false;
    timer.current = setTimeout(() => {
      longPressed.current = true;
      setPicking(weekday);
    }, LONG_PRESS_MS);
  }

  function pressEnd() {
    clearTimeout(timer.current);
  }

  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <span className="size-3 rounded-full" style={{ background: child.color }} />
        <h2 className="font-semibold">{child.name}</h2>
        {child.class_name && <span className="text-sm text-muted">{child.class_name}</span>}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d) => {
          const outfitId = days[d.n];
          return (
            <button
              key={d.n}
              type="button"
              aria-label={`${d.long}: ${nameOf(outfitId)}. Tap to change, hold to choose.`}
              onPointerDown={() => pressStart(d.n)}
              onPointerUp={pressEnd}
              onPointerLeave={pressEnd}
              onContextMenu={(e) => {
                e.preventDefault();
                setPicking(d.n);
              }}
              onClick={() => {
                if (longPressed.current) return;
                cycle(d.n);
              }}
              className={`flex min-h-16 select-none flex-col items-center justify-center gap-1 rounded-xl border bg-raised px-0.5 text-center ${
                picking === d.n ? "border-lime" : "border-line"
              }`}
            >
              <span className="text-[11px] font-semibold uppercase text-muted">{d.short}</span>
              <span className="h-1.5 w-6 rounded-full" style={{ background: colorOf(outfitId) }} />
              <span className="w-full truncate text-[11px] leading-tight">{nameOf(outfitId)}</span>
            </button>
          );
        })}
      </div>

      {picking !== null && (
        <div className="mt-3 rounded-xl border border-line bg-raised p-2">
          <p className="px-2 pb-2 text-sm text-muted">
            {WEEKDAYS[picking - 1].long} for {child.name}
          </p>
          <div className="flex flex-wrap gap-2">
            {outfits.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => choose(picking, o.id)}
                className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm ${
                  days[picking] === o.id ? "border-lime text-lime" : "border-line"
                }`}
              >
                <span className="size-2.5 rounded-full" style={{ background: colorOf(o.id) }} />
                {o.name}
              </button>
            ))}
            <button type="button" onClick={() => setPicking(null)} className="min-h-11 px-3 text-sm text-muted">
              Close
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
