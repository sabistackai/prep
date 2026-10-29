// Points the LOCAL database at the local Edge Functions, so notifications are
// delivered while developing. Reads PREP_FUNCTIONS_SECRET from supabase/.env.
// Usage: npm run db:vault   (run again after `supabase db reset`)
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const env = Object.fromEntries(
  readFileSync(join(import.meta.dirname, "..", "supabase", ".env"), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
if (!env.PREP_FUNCTIONS_SECRET) throw new Error("PREP_FUNCTIONS_SECRET missing from supabase/.env");

// The database container reaches the functions through the API gateway container.
const url = "http://supabase_kong_prep:8000/functions/v1";
const quote = (s) => `'${s.replaceAll("'", "''")}'`;
const sql = ["prep_functions_url", "prep_functions_secret"]
  .map((name, i) => {
    const value = quote(i === 0 ? url : env.PREP_FUNCTIONS_SECRET);
    return `delete from vault.secrets where name = '${name}'; select vault.create_secret(${value}, '${name}');`;
  })
  .join("\n");

const res = spawnSync("docker", ["exec", "-i", "supabase_db_prep", "psql", "-U", "postgres", "-q", "-v", "ON_ERROR_STOP=1"], {
  input: sql,
  encoding: "utf8",
});
if (res.status !== 0) {
  console.error(res.stderr);
  process.exit(1);
}
console.log("Local Vault configured: notifications will be sent through", url);
