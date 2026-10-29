import type { ReactNode } from "react";
import {
  addHoliday,
  addNanny,
  deleteChild,
  deleteHoliday,
  deleteOutfit,
  removeNanny,
  resetNannyLink,
  saveChild,
  saveOutfit,
  saveProfile,
  saveSettings,
} from "@/app/parent/actions";
import { ActionForm, SubmitButton } from "@/components/form";
import { ShareLink } from "@/components/share-link";
import { Card, Field, inputClass, PageHeader } from "@/components/ui";
import { requireParent } from "@/lib/auth";
import { timeInput } from "@/lib/format";
import type { Tables } from "@/lib/database.types";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4">
      <h2 className="text-lg font-bold">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

// "Remove" behind a second tap, so nothing is deleted by accident.
function ConfirmDelete({ action, id, label }: { action: (fd: FormData) => Promise<void>; id: string; label: string }) {
  return (
    <details className="text-sm">
      <summary className="flex min-h-11 cursor-pointer list-none items-center text-danger">Remove</summary>
      <form action={action} className="flex items-center gap-3 pb-1">
        <input type="hidden" name="id" value={id} />
        <span className="text-muted">{label}</span>
        <SubmitButton variant="danger">Yes, remove</SubmitButton>
      </form>
    </details>
  );
}

function ChildFields({ child }: { child?: Tables<"children"> }) {
  return (
    <>
      {child && <input type="hidden" name="id" value={child.id} />}
      <div className="grid grid-cols-[1fr_7rem_3.5rem] gap-2">
        <Field label="Name">
          <input name="name" defaultValue={child?.name} placeholder="Ada" required className={inputClass} />
        </Field>
        <Field label="Class">
          <input name="class_name" defaultValue={child?.class_name ?? ""} placeholder="JSS 2" className={inputClass} />
        </Field>
        <Field label="Colour">
          <input
            name="color"
            type="color"
            defaultValue={child?.color ?? "#84CC16"}
            className="h-11 w-full cursor-pointer rounded-xl border border-line bg-canvas p-1"
          />
        </Field>
      </div>
    </>
  );
}

function OutfitFields({ outfit }: { outfit?: Tables<"outfits"> }) {
  return (
    <>
      {outfit && <input type="hidden" name="id" value={outfit.id} />}
      <Field label="Name">
        <input name="name" defaultValue={outfit?.name} placeholder="Cultural day" required className={inputClass} />
      </Field>
      <Field label="Checklist items" hint="One per line. These go on the nanny's list whenever this outfit is worn.">
        <textarea name="items" rows={4} defaultValue={outfit?.items.join("\n")} className={`${inputClass} py-2`} />
      </Field>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="is_school" defaultChecked={outfit?.is_school} className="size-5 accent-lime" />
        School outfit (switches to Casual on holidays)
      </label>
    </>
  );
}

function Toggle({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
      {label}
      <input type="checkbox" name={name} defaultChecked={checked} className="size-5 accent-lime" />
    </label>
  );
}

export default async function SettingsPage() {
  const { supabase, member: me } = await requireParent();
  const [{ data: household }, { data: kids }, { data: outfits }, { data: holidays }, { data: members }] =
    await Promise.all([
      supabase.from("households").select("*").single(),
      supabase.from("children").select("*").order("sort"),
      supabase.from("outfits").select("*").order("sort").order("name"),
      supabase.from("holidays").select("*").order("starts_on", { ascending: false }),
      supabase.from("members").select("*").order("created_at"),
    ]);
  const nannies = (members ?? []).filter((m) => m.role === "nanny");
  const parents = (members ?? []).filter((m) => m.role === "parent");

  return (
    <>
      <PageHeader title="Settings" />
      <nav className="mb-6 flex flex-wrap gap-2 text-sm">
        {[
          ["children", "Children"],
          ["outfits", "Outfits"],
          ["holidays", "Holidays"],
          ["timings", "Timings & alerts"],
          ["nannies", "Nannies"],
          ["you", "Your details"],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="rounded-full border border-line px-3 py-1.5 text-muted hover:text-ink">
            {label}
          </a>
        ))}
      </nav>

      <div className="space-y-10">
        <Section id="children" title="Children" hint="The class is used to match school notices.">
          {(kids ?? []).map((c) => (
            <Card key={c.id}>
              <ActionForm action={saveChild} className="space-y-3">
                <ChildFields child={c} />
                <SubmitButton variant="secondary">Save</SubmitButton>
              </ActionForm>
              <ConfirmDelete action={deleteChild} id={c.id} label={`Remove ${c.name} and their routine?`} />
            </Card>
          ))}
          <Card>
            <h3 className="mb-3 font-semibold">Add a child</h3>
            <ActionForm action={saveChild} className="space-y-3">
              <ChildFields />
              <SubmitButton>Add child</SubmitButton>
            </ActionForm>
          </Card>
        </Section>

        <Section id="outfits" title="Outfits" hint="Each outfit has its own checklist for the nanny.">
          {(outfits ?? []).map((o) => (
            <Card key={o.id}>
              <details>
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3">
                  <span>
                    <span className="font-semibold">{o.name}</span>
                    {o.is_school && <span className="ml-2 text-xs text-muted">School</span>}
                    <span className="block text-sm text-muted">{o.items.join(", ") || "No items"}</span>
                  </span>
                  <span className="text-sm text-muted">Edit</span>
                </summary>
                <ActionForm action={saveOutfit} className="mt-3 space-y-3 border-t border-line pt-3">
                  <OutfitFields outfit={o} />
                  <SubmitButton variant="secondary">Save</SubmitButton>
                </ActionForm>
                <ConfirmDelete
                  action={deleteOutfit}
                  id={o.id}
                  label={`Remove ${o.name}? Days using it will be cleared.`}
                />
              </details>
            </Card>
          ))}
          <Card>
            <details>
              <summary className="flex min-h-11 cursor-pointer list-none items-center font-semibold">
                Add an outfit
              </summary>
              <ActionForm action={saveOutfit} className="mt-3 space-y-3">
                <OutfitFields />
                <SubmitButton>Add outfit</SubmitButton>
              </ActionForm>
            </details>
          </Card>
        </Section>

        <Section
          id="holidays"
          title="Holidays"
          hint="Term breaks and public holidays. School outfits switch to Casual; activities still happen unless paused."
        >
          {(holidays ?? []).map((h) => (
            <Card key={h.id} className="flex items-center justify-between gap-3">
              <span>
                <span className="font-semibold">{h.label || "Holiday"}</span>
                <span className="block font-mono text-sm text-muted">
                  {h.starts_on === h.ends_on ? h.starts_on : `${h.starts_on} → ${h.ends_on}`}
                </span>
              </span>
              <ConfirmDelete action={deleteHoliday} id={h.id} label="Sure?" />
            </Card>
          ))}
          <Card>
            <ActionForm action={addHoliday} className="space-y-3">
              <Field label="Name">
                <input name="label" placeholder="Mid-term break" className={inputClass} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="First day">
                  <input name="starts_on" type="date" required className={`${inputClass} font-mono`} />
                </Field>
                <Field label="Last day">
                  <input name="ends_on" type="date" className={`${inputClass} font-mono`} />
                </Field>
              </div>
              <SubmitButton>Add holiday</SubmitButton>
            </ActionForm>
          </Card>
        </Section>

        {household && (
          <Section id="timings" title="Timings & alerts" hint="All times are Lagos time.">
            <Card>
              <ActionForm action={saveSettings} className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <Field label="List sent">
                    <input
                      name="prep_release_time"
                      type="time"
                      defaultValue={timeInput(household.prep_release_time)}
                      required
                      className={`${inputClass} font-mono`}
                    />
                  </Field>
                  <Field label="Reminder" hint="Optional">
                    <input
                      name="prep_nudge_time"
                      type="time"
                      defaultValue={timeInput(household.prep_nudge_time)}
                      className={`${inputClass} font-mono`}
                    />
                  </Field>
                  <Field label="Deadline">
                    <input
                      name="prep_deadline_time"
                      type="time"
                      defaultValue={timeInput(household.prep_deadline_time)}
                      required
                      className={`${inputClass} font-mono`}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Activity reminder" hint="Minutes before it starts">
                    <input
                      name="activity_lead_minutes"
                      type="number"
                      min={0}
                      max={720}
                      defaultValue={household.activity_lead_minutes}
                      className={`${inputClass} font-mono`}
                    />
                  </Field>
                  <Field label="Travel time" hint="Minutes, for the leave-by time">
                    <input
                      name="leave_buffer_minutes"
                      type="number"
                      min={0}
                      max={240}
                      defaultValue={household.leave_buffer_minutes}
                      className={`${inputClass} font-mono`}
                    />
                  </Field>
                </div>
                <div className="divide-y divide-line border-y border-line">
                  <Toggle
                    name="notify_parents_all_ready"
                    label="Tell me when everyone is ready"
                    checked={household.notify_parents_all_ready}
                  />
                  <Toggle
                    name="notify_parents_activities"
                    label="Send me activity reminders too"
                    checked={household.notify_parents_activities}
                  />
                  <Toggle
                    name="sms_backup"
                    label="SMS me if prep misses the deadline"
                    checked={household.sms_backup}
                  />
                </div>
                <SubmitButton>Save settings</SubmitButton>
              </ActionForm>
            </Card>
            {household.sms_backup && parents.some((p) => !p.phone) && (
              <p className="text-sm text-warn">
                {parents
                  .filter((p) => !p.phone)
                  .map((p) => p.display_name)
                  .join(" and ")}{" "}
                {parents.filter((p) => !p.phone).length > 1 ? "have" : "has"} no phone number, so SMS alerts
                can&apos;t reach them.
              </p>
            )}
          </Section>
        )}

        <Section id="nannies" title="Nannies" hint="Each nanny signs in with their phone number and a PIN they choose.">
          {nannies.map((n) => (
            <Card key={n.id} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span>
                  <span className="font-semibold">{n.display_name}</span>
                  <span className="block font-mono text-sm text-muted">{n.phone}</span>
                </span>
                <span className={`text-xs font-semibold ${n.user_id && !n.setup_token ? "text-lime" : "text-warn"}`}>
                  {n.setup_token ? (n.user_id ? "New link sent" : "Waiting for setup") : "Set up"}
                </span>
              </div>
              {n.setup_token && (
                <ShareLink
                  url={`${siteUrl}/setup/${n.setup_token}`}
                  text={`Hi ${n.display_name}, open this link on your phone to set up PREP:`}
                />
              )}
              <div className="flex flex-wrap items-start gap-x-4">
                <form action={resetNannyLink}>
                  <input type="hidden" name="id" value={n.id} />
                  <SubmitButton variant="ghost" className="px-0">
                    {n.setup_token ? "Make a new link" : "New phone or forgot PIN"}
                  </SubmitButton>
                </form>
                <ConfirmDelete action={removeNanny} id={n.id} label={`Remove ${n.display_name}? They'll be signed out.`} />
              </div>
            </Card>
          ))}
          <Card>
            <h3 className="mb-3 font-semibold">Add a nanny</h3>
            <ActionForm action={addNanny} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name">
                  <input name="display_name" placeholder="Blessing" required className={inputClass} />
                </Field>
                <Field label="Phone number">
                  <input name="phone" type="tel" inputMode="tel" placeholder="0803 000 0000" required className={inputClass} />
                </Field>
              </div>
              <SubmitButton>Add nanny</SubmitButton>
            </ActionForm>
          </Card>
        </Section>

        <Section id="you" title="Your details">
          <Card>
            <ActionForm action={saveProfile} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Your name">
                  <input name="display_name" defaultValue={me.display_name} required className={inputClass} />
                </Field>
                <Field label="Phone for SMS alerts">
                  <input name="phone" type="tel" inputMode="tel" defaultValue={me.phone ?? ""} className={inputClass} />
                </Field>
              </div>
              <SubmitButton variant="secondary">Save</SubmitButton>
            </ActionForm>
          </Card>
        </Section>
      </div>
    </>
  );
}
