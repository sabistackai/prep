import type { ReactNode } from "react";
import { labelClass } from "@/components/ui";
import type { CareCard, Contact } from "@/lib/care-data";
import type { Tables } from "@/lib/database.types";

type Child = Pick<Tables<"children">, "id" | "name" | "color" | "class_name">;

function Row({ label, children, alert }: { label: string; children: ReactNode; alert?: boolean }) {
  return (
    <div className={alert ? "rounded-[10px] bg-danger-soft px-3 py-2 text-danger" : ""}>
      <dt className={alert ? "text-xs font-extrabold uppercase tracking-[0.12em]" : labelClass}>
        {alert && "! "}
        {label}
      </dt>
      <dd className="mt-0.5 whitespace-pre-line font-semibold">{children}</dd>
    </div>
  );
}

// "0803 111 2222" -> "tel:08031112222"
export function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

// A child's care card, read-only. Allergies and foods to avoid stand out.
export function CareCardView({ child, card, children }: { child: Child; card: CareCard | null; children?: ReactNode }) {
  const filled = card && Object.entries(card).some(([k, v]) => !["child_id", "updated_at", "updated_by"].includes(k) && v);
  return (
    <section className="rounded-[16px] border border-border bg-surface p-4 shadow-sm shadow-text/5 dark:shadow-none">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid size-9 place-items-center rounded-full font-display text-base font-semibold text-on-accent"
            style={{ background: child.color }}
          >
            {child.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="font-display text-xl font-semibold">{child.name}</span>
          {child.class_name && <span className="text-sm text-muted">{child.class_name}</span>}
        </h2>
        {children}
      </header>
      {!filled ? (
        <p className="text-sm text-muted">Nothing on this care card yet.</p>
      ) : (
        <dl className="space-y-3 text-sm">
          {card.allergies && <Row label="Allergies" alert>{card.allergies}</Row>}
          {card.avoid_foods && <Row label="Foods to avoid" alert>{card.avoid_foods}</Row>}
          {card.conditions && <Row label="Health conditions">{card.conditions}</Row>}
          {card.medicines && <Row label="Medicines">{card.medicines}</Row>}
          {card.blood_group && <Row label="Blood group">{card.blood_group}</Row>}
          {(card.doctor_name || card.doctor_phone || card.hospital) && (
            <Row label="Doctor">
              {[card.doctor_name, card.hospital].filter(Boolean).join(", ")}
              {card.doctor_phone && (
                <a href={telHref(card.doctor_phone)} className="mt-1 flex min-h-11 items-center font-bold text-primary underline">
                  Call {card.doctor_phone}
                </a>
              )}
            </Row>
          )}
          {card.notes && <Row label="Other notes">{card.notes}</Row>}
        </dl>
      )}
    </section>
  );
}

export function ContactList({ contacts }: { contacts: Contact[] }) {
  if (!contacts.length) return <p className="text-sm text-muted">No emergency contacts yet.</p>;
  return (
    <ul className="divide-y divide-border">
      {contacts.map((c) => (
        <li key={c.id} className="flex items-center justify-between gap-3 py-2">
          <span>
            <span className="font-semibold">{c.name}</span>
            {c.relation && <span className="block text-sm text-muted">{c.relation}</span>}
          </span>
          <a
            href={telHref(c.phone)}
            className="flex min-h-11 items-center rounded-[10px] border border-border bg-surface-2 px-4 text-sm font-bold tabular-nums"
          >
            Call {c.phone}
          </a>
        </li>
      ))}
    </ul>
  );
}
