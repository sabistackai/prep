import { Card, PageHeader } from "@/components/ui";
import { requireNanny } from "@/lib/auth";

// Week 2: tonight's checklist cards with tick boxes.
export default async function NannyPrepPage() {
  const { supabase } = await requireNanny();
  const { data: kids } = await supabase.from("children").select("id, name, color").order("sort");

  return (
    <>
      <PageHeader title="Tonight's prep" />
      <Card>
        <p className="text-muted">Tomorrow&apos;s checklist will appear here every evening.</p>
        {kids && kids.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-3 text-sm">
            {kids.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                {c.name}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
