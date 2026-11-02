import Link from "next/link";
import { deleteContact, saveCareCard, saveContact } from "@/app/parent/actions";
import { CareCardView } from "@/components/care-card-view";
import { ActionForm, SubmitButton } from "@/components/form";
import { Card, Field, inputClass, PageHeader } from "@/components/ui";
import { requireParent } from "@/lib/auth";
import { loadCareCards, type CareCard, type Contact } from "@/lib/care-data";
import { formatDue } from "@/lib/format";

const textarea = `${inputClass} py-2`;

function CardForm({ childId, card }: { childId: string; card: CareCard | null }) {
  return (
    <ActionForm action={saveCareCard} className="mt-3 space-y-3 border-t border-border pt-3">
      <input type="hidden" name="child_id" value={childId} />
      <Field label="Allergies" hint="Food, medicine, insects. Shown in red at the top of the nanny's day.">
        <textarea name="allergies" rows={2} maxLength={500} defaultValue={card?.allergies ?? ""} placeholder="Peanuts, penicillin" className={textarea} />
      </Field>
      <Field label="Foods to avoid" hint="Not allergies, but not allowed.">
        <textarea name="avoid_foods" rows={2} maxLength={500} defaultValue={card?.avoid_foods ?? ""} placeholder="Fizzy drinks, too much sugar" className={textarea} />
      </Field>
      <Field label="Health conditions">
        <textarea name="conditions" rows={2} maxLength={500} defaultValue={card?.conditions ?? ""} placeholder="Asthma" className={textarea} />
      </Field>
      <Field label="Medicines" hint="Regular doses also go on the Schedule, so the nanny is reminded.">
        <textarea name="medicines" rows={2} maxLength={500} defaultValue={card?.medicines ?? ""} placeholder="Inhaler (blue) when wheezy, 2 puffs" className={textarea} />
      </Field>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <Field label="Doctor">
          <input name="doctor_name" maxLength={100} defaultValue={card?.doctor_name ?? ""} placeholder="Dr Eze" className={inputClass} />
        </Field>
        <Field label="Doctor's phone">
          <input name="doctor_phone" type="tel" maxLength={30} defaultValue={card?.doctor_phone ?? ""} placeholder="0803 000 0000" className={inputClass} />
        </Field>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
        <Field label="Hospital or clinic">
          <input name="hospital" maxLength={150} defaultValue={card?.hospital ?? ""} className={inputClass} />
        </Field>
        <Field label="Blood group">
          <input name="blood_group" maxLength={10} defaultValue={card?.blood_group ?? ""} placeholder="O+" className={inputClass} />
        </Field>
      </div>
      <Field label="Other notes" hint="Comfort toy, fears, things that calm them down.">
        <textarea name="notes" rows={3} maxLength={1000} defaultValue={card?.notes ?? ""} className={textarea} />
      </Field>
      <SubmitButton>Save care card</SubmitButton>
    </ActionForm>
  );
}

function ContactFields({ contact }: { contact?: Contact }) {
  return (
    <>
      {contact && <input type="hidden" name="id" value={contact.id} />}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <Field label="Name">
          <input name="name" required maxLength={80} defaultValue={contact?.name} placeholder="Mama Ngozi" className={inputClass} />
        </Field>
        <Field label="Who they are">
          <input name="relation" maxLength={60} defaultValue={contact?.relation ?? ""} placeholder="Grandmother" className={inputClass} />
        </Field>
      </div>
      <Field label="Phone number">
        <input name="phone" type="tel" required maxLength={30} defaultValue={contact?.phone} placeholder="0803 000 0000" className={inputClass} />
      </Field>
    </>
  );
}

export default async function CareCardsPage() {
  const { supabase } = await requireParent();
  const [{ data: kids }, { card, contacts }] = await Promise.all([
    supabase.from("children").select("id, name, color, class_name").order("sort"),
    loadCareCards(supabase),
  ]);

  return (
    <>
      <PageHeader title="Care cards" subtitle="What the nanny needs to know about each child. They can read these but not change them." />

      {!kids?.length && (
        <Card className="mb-4">
          <p className="text-sm text-muted">
            Add the children first.{" "}
            <Link href="/parent/settings#children" className="font-semibold text-primary hover:underline">Add children</Link>
          </p>
        </Card>
      )}

      <div className="space-y-4">
        {(kids ?? []).map((k) => {
          const c = card(k.id);
          return (
            <div key={k.id}>
              <CareCardView child={k} card={c} />
              <details className="-mt-2 rounded-b-[16px] border border-t-0 border-border bg-surface px-4 pb-3 pt-4">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-bold text-primary">
                  {c ? "Edit care card" : "Fill in care card"}
                  {c && <span className="font-normal text-muted">Updated {formatDue(c.updated_at)}</span>}
                </summary>
                <CardForm childId={k.id} card={c} />
              </details>
            </div>
          );
        })}
      </div>

      <section id="contacts" className="mt-8 scroll-mt-4">
        <h2 className="font-display text-xl font-semibold">Emergency contacts</h2>
        <p className="mt-0.5 text-sm text-muted">Who the nanny calls if they can&apos;t reach you. Shown on every child&apos;s card.</p>
        <div className="mt-3 space-y-3">
          {contacts.map((c) => (
            <Card key={c.id}>
              <details>
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3">
                  <span>
                    <span className="font-semibold">{c.name}</span>
                    <span className="block text-sm tabular-nums text-muted">
                      {[c.relation, c.phone].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="text-sm text-muted">Edit</span>
                </summary>
                <ActionForm action={saveContact} className="mt-3 space-y-3 border-t border-border pt-3">
                  <ContactFields contact={c} />
                  <SubmitButton variant="secondary">Save</SubmitButton>
                </ActionForm>
                <form action={deleteContact} className="mt-2">
                  <input type="hidden" name="id" value={c.id} />
                  <SubmitButton variant="danger">Remove</SubmitButton>
                </form>
              </details>
            </Card>
          ))}
          <Card>
            <h3 className="mb-3 font-display text-lg font-semibold">Add a contact</h3>
            <ActionForm action={saveContact} className="space-y-3">
              <ContactFields />
              <SubmitButton>Add contact</SubmitButton>
            </ActionForm>
          </Card>
        </div>
      </section>
    </>
  );
}
