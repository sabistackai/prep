// Runs every supabase/tests/*_test.sql against the local database, each in its
// own transaction (rolled back), with _helpers.sql prepended. Usage: npm run test:db
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "..", "supabase", "tests");
const helpers = readFileSync(join(dir, "_helpers.sql"), "utf8");
const files = readdirSync(dir).filter((f) => f.endsWith("_test.sql")).sort();

let total = 0;
let failed = false;
for (const file of files) {
  const res = spawnSync(
    "docker",
    ["exec", "-i", "supabase_db_prep", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q"],
    { input: helpers + "\n" + readFileSync(join(dir, file), "utf8"), encoding: "utf8" },
  );
  const lines = String(res.stderr).split("\n");
  const passes = lines.filter((l) => l.includes("PASS  ")).length;
  const problems = lines.filter((l) => /FAIL  |ERROR:/.test(l));
  total += passes;
  console.log(`${res.status === 0 ? "ok  " : "FAIL"} ${file}: ${passes} passed`);
  problems.forEach((l) => console.log("     " + l.replace(/^.*?(FAIL|ERROR)/, "$1")));
  if (res.status !== 0) failed = true;
}

console.log(failed ? "Database tests FAILED" : `All ${total} database checks passed`);
process.exit(failed ? 1 : 0);
