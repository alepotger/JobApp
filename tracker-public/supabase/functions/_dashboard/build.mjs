#!/usr/bin/env node
/* Builds paste-ready single files for the Supabase dashboard editor.
 *
 *   node build.mjs          write the bundles
 *   node build.mjs --check  fail if they are stale (for CI / pre-push)
 *
 * WHY THIS EXISTS
 * The dashboard's function editor can only see files inside the function's own
 * folder, so `../_shared/*.ts` cannot resolve and the deploy fails with
 * "Module not found". Anyone with the Supabase CLI is unaffected. This produces
 * an equivalent single file per function for people deploying from a browser.
 *
 * WHAT IT DOES, AND DELIBERATELY DOES NOT DO
 * Concatenation, plus two textual removals: the local `import { ... } from
 * "../_shared/x.ts";` statements, and the `export ` keyword in front of
 * declarations that are now local. Nothing is reordered, renamed or rewritten.
 * External imports (`jsr:@supabase/supabase-js@2`) are hoisted to the top
 * unchanged, because ES modules require imports before other statements.
 *
 * The two bundles were checked for identifier collisions before this was
 * written: digest.ts + verify.ts + weekly-digest/index.ts share no top-level
 * name, and neither do inbound.ts + verify.ts + inbound-email/index.ts. The
 * build re-checks that on every run rather than trusting the snapshot.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FUNCTIONS = join(HERE, "..");

const BUNDLES = [
  { out: "weekly-digest.ts", entry: "weekly-digest/index.ts",
    shared: ["_shared/digest.ts", "_shared/verify.ts"] },
  { out: "inbound-email.ts", entry: "inbound-email/index.ts",
    shared: ["_shared/inbound.ts", "_shared/verify.ts"] },
];

const read = (p) => readFileSync(join(FUNCTIONS, p), "utf8");

/* Local imports only. An external specifier (jsr:, npm:, https:) is left
   exactly as written — those resolve fine in the dashboard. */
const LOCAL_IMPORT = /^import\s+(?:type\s+)?\{[\s\S]*?\}\s+from\s+"\.\.\/_shared\/[^"]+";\n/gm;
const EXTERNAL_IMPORT = /^import\s+.*?from\s+"(?:jsr:|npm:|https:)[^"]*";\n/gm;

/* Top-level declarations, used for the collision check and for stripping the
   `export ` keyword once a module is no longer a module. */
const DECL = /^export\s+(const|let|function|async function|type|interface|class)\s+([A-Za-z_$][\w$]*)/gm;

function topLevelNames(src) {
  const names = [];
  for (const m of src.matchAll(DECL)) names.push(m[2]);
  return names;
}

function build({ out, entry, shared }) {
  const entrySrc = read(entry);
  const sharedSrcs = shared.map(read);

  /* collision check — a duplicate top-level name would shadow silently */
  const seen = new Map();
  for (const [i, src] of [...sharedSrcs, entrySrc].entries()) {
    const where = i < shared.length ? shared[i] : entry;
    const names = i < shared.length
      ? topLevelNames(src)
      : [...src.matchAll(/^(?:const|let|function|async function|type)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
    for (const n of names) {
      if (seen.has(n)) {
        throw new Error(
          `identifier collision building ${out}: "${n}" declared in both ${seen.get(n)} and ${where}`
        );
      }
      seen.set(n, where);
    }
  }

  /* Every external import, deduplicated, hoisted — ES modules require import
     statements before other top-level statements. */
  const externals = new Set();
  for (const src of [...sharedSrcs, entrySrc]) {
    for (const m of src.matchAll(EXTERNAL_IMPORT)) externals.add(m[0].trim());
  }

  const strip = (src) =>
    src.replace(LOCAL_IMPORT, "").replace(EXTERNAL_IMPORT, "").replace(/^export\s+/gm, "");

  const parts = [
    `/* GENERATED — DO NOT EDIT. Built by _dashboard/build.mjs from:\n` +
      shared.map((s) => ` *   ${s}\n`).join("") +
      ` *   ${entry}\n` +
      ` *\n` +
      ` * Paste this whole file into the Supabase dashboard function editor.\n` +
      ` * The dashboard cannot resolve ../_shared/, so those modules are inlined\n` +
      ` * here verbatim. Edit the sources above and re-run the build; editing\n` +
      ` * this file directly will be overwritten and will drift from the tests. */`,
    [...externals].join("\n"),
    ...shared.map((s, i) => `/* ── inlined from ${s} ───────────────────── */\n` + strip(sharedSrcs[i]).trim()),
    `/* ── ${entry} ───────────────────── */\n` + strip(entrySrc).trim(),
  ];
  return parts.join("\n\n") + "\n";
}

/* Equivalence check: strip comments, string-normalise and drop whitespace from
   both sides, then compare token streams. Anything surviving beyond the
   removed import/export statements is a defect in the generator, not a
   stylistic difference. */
function tokenise(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1 ")
    .replace(/^import\s+[\s\S]*?;\s*$/gm, " ")
    .replace(/\bexport\s+/g, " ")
    .replace(/\s+/g, "")
    .trim();
}

function verify(spec, generated) {
  const original = [...spec.shared.map(read), read(spec.entry)].map(tokenise).join("");
  const built = tokenise(generated);
  if (original !== built) {
    // find the first divergence so the failure is actionable
    let i = 0;
    while (i < original.length && original[i] === built[i]) i++;
    throw new Error(
      `${spec.out}: token streams diverge at ${i}\n` +
        `  original: …${original.slice(Math.max(0, i - 60), i + 60)}\n` +
        `  built:    …${built.slice(Math.max(0, i - 60), i + 60)}`
    );
  }
  return original.length;
}

const check = process.argv.includes("--check");
let stale = 0;
for (const spec of BUNDLES) {
  const generated = build(spec);
  const tokens = verify(spec, generated);
  const dest = join(HERE, spec.out);
  const current = existsSync(dest) ? readFileSync(dest, "utf8") : null;
  if (check) {
    if (current !== generated) {
      console.error(`STALE  ${spec.out} — re-run: node _dashboard/build.mjs`);
      stale++;
    } else {
      console.log(`ok     ${spec.out} (${tokens} tokens match source)`);
    }
  } else {
    writeFileSync(dest, generated);
    console.log(`wrote  ${spec.out} (${tokens} tokens match source)`);
  }
}
if (check && stale) process.exit(1);
