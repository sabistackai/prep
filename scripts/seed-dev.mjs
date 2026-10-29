// Demo household for the LOCAL database: a parent you can sign in as, one child
// and a nanny waiting for setup. Prints the nanny's setup link.
// Usage: npm run db:seed   (after `npm run db:reset`). Never point this at the cloud project.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(join(import.meta.dirname, "..", ".env.local"), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) throw new Error(`Refusing to seed a non-local database: ${url}`);

// Local-only demo values.
const PARENT = { email: "demo-parent@prep.test", password: "demo-parent-1", name: "Mrs Okafor" };
const NANNY = { name: "Blessing", phone: "+2348030000001" }; // choose PIN 482915 on the setup link

const admin = createClient(url, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const { error: userError } = await admin.auth.admin.createUser({
  email: PARENT.email,
  password: PARENT.password,
  email_confirm: true,
});
if (userError) throw userError;

const parent = createClient(url, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const { error: signInError } = await parent.auth.signInWithPassword(PARENT);
if (signInError) throw signInError;

const { data: household, error } = await parent.rpc("create_household", { p_name: "The Okafors", p_display_name: PARENT.name });
if (error) throw error;
await parent.from("children").insert({ household_id: household, name: "Ada", class_name: "Primary 4" });
const { data: token, error: nannyError } = await parent.rpc("add_nanny", { p_display_name: NANNY.name, p_phone: NANNY.phone });
if (nannyError) throw nannyError;

console.log(`Parent: ${PARENT.email} (password in scripts/seed-dev.mjs)`);
console.log(`Nanny setup link: ${env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/setup/${token}`);
