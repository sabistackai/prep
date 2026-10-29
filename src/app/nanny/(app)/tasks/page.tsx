import { Card, PageHeader } from "@/components/ui";

// Week 3: open tasks with a Done button, then completed ones.
export default function NannyTasksPage() {
  return (
    <>
      <PageHeader title="Tasks" />
      <Card>
        <p className="text-muted">No tasks yet. New tasks from Madam or Oga will show up here.</p>
      </Card>
    </>
  );
}
