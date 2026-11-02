import { CareCardView, ContactList } from "@/components/care-card-view";
import { Card, PageHeader } from "@/components/ui";
import { requireNanny } from "@/lib/auth";
import { loadCareCards } from "@/lib/care-data";

export default async function NannyKidsPage() {
  const { supabase } = await requireNanny();
  const [{ data: kids }, { card, contacts }] = await Promise.all([
    supabase.from("children").select("id, name, color, class_name").order("sort"),
    loadCareCards(supabase),
  ]);

  return (
    <>
      <PageHeader title="Care cards" subtitle="Allergies, medicines and who to call." />
      <Card className="mb-4">
        <h2 className="mb-1 font-display text-lg font-semibold">Emergency contacts</h2>
        <ContactList contacts={contacts} />
      </Card>
      <div className="space-y-4">
        {(kids ?? []).map((k) => (
          <CareCardView key={k.id} child={k} card={card(k.id)} />
        ))}
      </div>
    </>
  );
}
