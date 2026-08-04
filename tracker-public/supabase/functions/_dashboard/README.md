# Paste-ready bundles for the Supabase dashboard

`weekly-digest.ts` and `inbound-email.ts` here are **generated**. Paste either
one, whole, into the Supabase dashboard's function editor and deploy.

## Why they exist

The dashboard editor can only see files inside the function's own folder, so
`import … from "../_shared/digest.ts"` cannot resolve and the deploy fails with:

```
Failed to bundle the function (reason: Module not found ".../_shared/digest.ts")
```

That is a limitation of the browser deploy path, not a fault in the code.
Anyone using the Supabase CLI should deploy `weekly-digest/` and
`inbound-email/` as they are and ignore this folder entirely.

## Do not edit these files

Edit `_shared/*.ts` and the function entry points, then rebuild:

```
node supabase/functions/_dashboard/build.mjs
```

`_test/run-all.sh` runs `build.mjs --check` before the suite, so a forgotten
rebuild fails the tests rather than silently shipping stale code to whoever
deploys from a browser next.

## What the build does

Concatenation plus two textual removals: the local
`import { … } from "../_shared/x.ts";` statements, and the `export ` keyword in
front of declarations that are no longer cross-module. External imports
(`jsr:@supabase/supabase-js@2`) are hoisted unchanged, because ES modules
require imports before other statements. Nothing is reordered or renamed.

## How equivalence is established

1. **Generated, not transcribed.** No hand-copying, so no transcription errors.
2. **Token-level equality.** Both sides are stripped of comments, imports,
   `export` keywords and all whitespace, then compared character for character.
   The build fails on any divergence and prints where. Current: **7452 tokens**
   for `weekly-digest`, **11093** for `inbound-email`.
3. **Collision guard.** A duplicate top-level identifier between inlined
   modules would shadow silently, so the build refuses to emit and names both
   sources. Verified by deliberately introducing one.
4. **Parsed.** Both bundles parse clean under the TypeScript compiler's own
   parser, as do all five sources.

## Known gap

The 95-test suite in `_test/` needs Deno, which was not available where these
bundles were generated, so the suite was **not** re-run against them here. The
freshness gate in `run-all.sh` closes this the moment anyone runs the tests on
a machine with Deno. Equivalence above rests on (2) and (3), which are
mechanical, rather than on behavioural testing of the bundles themselves.
