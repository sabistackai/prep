import type { ReactNode } from "react";
import { formatDue } from "@/lib/format";
import type { Tables } from "@/lib/database.types";

export type Task = Pick<Tables<"tasks">, "id" | "title" | "due_at" | "done_at" | "created_by" | "assigned_to" | "done_by">;

// One task: title, who it's from or for, and when it's due. Overdue shows "!" as well as red.
export function TaskCard({ task, meta, children }: { task: Task; meta: string; children?: ReactNode }) {
  const overdue = !task.done_at && task.due_at && new Date(task.due_at).getTime() < Date.now();
  return (
    <section className="rounded-[16px] border border-border bg-surface p-4 shadow-sm shadow-text/5 dark:shadow-none">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`font-semibold ${task.done_at ? "text-muted line-through" : ""}`}>{task.title}</p>
          <p className="mt-0.5 text-sm text-muted">{meta}</p>
        </div>
        {task.due_at && !task.done_at && (
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-extrabold tabular-nums ${
              overdue ? "bg-danger-soft text-danger" : "bg-surface-2 text-text"
            }`}
          >
            {overdue ? "! Was due " : "Due "}
            {formatDue(task.due_at)}
          </span>
        )}
      </div>
      {children && <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">{children}</div>}
    </section>
  );
}
