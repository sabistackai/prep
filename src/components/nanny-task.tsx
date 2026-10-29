import { completeTask } from "@/app/nanny/actions";
import { SubmitButton } from "@/components/form";
import { TaskCard, type Task } from "@/components/task-card";

// An open task on the nanny's phone, with a big Done button.
export function NannyTask({ task, from }: { task: Task; from: string }) {
  return (
    <TaskCard task={task} meta={`From ${from}`}>
      <form action={completeTask} className="w-full">
        <input type="hidden" name="id" value={task.id} />
        <SubmitButton className="min-h-12 w-full text-base">✓ Done</SubmitButton>
      </form>
    </TaskCard>
  );
}
