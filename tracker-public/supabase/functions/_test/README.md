# Running the functions without deploying them

```bash
./run-all.sh
```

Needs `deno` and `node` on `PATH`. Nothing else — no Supabase project, no mail
provider, no API keys, no network.

Both functions are started for real and driven over HTTP. The sources in
`../inbound-email/` and `../weekly-digest/` are imported **unmodified**; three
things are redirected, all of them environmental rather than logical:

| Redirected | Why |
|---|---|
| `jsr:@supabase/supabase-js@2` → `npm:@supabase/supabase-js` (via `deno.json`) | So the harness runs on a machine that cannot reach `jsr.io`. Same library. |
| the listen port | `Deno.serve` otherwise fixes it at 8000, and two functions cannot share it. |
| `api.resend.com` | Captured to `outbox.jsonl` so the composed email can be read, instead of sent. |

The database is a stub speaking PostgREST on `127.0.0.1:8801`, so the **real**
`supabase-js` query builder, its filters, and its error codes are exercised —
only the storage behind them is fake. `23505` on a repeated `message_id` and
`57014` from the fault injector are the shapes Postgres actually returns.

## What it covers

**`inbound-suite.js`** — signature verification (unsigned, forged, replayed,
future-dated), provider retries, ambiguity, stage promotion, personal and ATS
sender domains, SendGrid's form encoding, and the mid-delivery database failure
described below.

**`digest-suite.js`** — cron authentication, what counts as stale, per-account
`stale_after`, `digest_email` overriding the sign-in address, opted-out
accounts, one account's failure not stopping the run, and `last_digest_at`.

## The one that matters most

`inbound_messages` is written *before* the reply is filed, which is what makes
a retried delivery idempotent. It also means a database failure between the two
used to convert a retryable error into permanent loss: the provider retried,
saw the id already in the ledger, got a cheerful `200 duplicate`, and the reply
was never filed.

The harness injects that failure (`POST /__fail`) and asserts the retry
recovers. If you change the ledger logic, this is the check that will catch you.

## Reading the captured mail

```bash
./run-all.sh && cat outbox.jsonl | tail -1 | python3 -m json.tool
```

## Fixtures

`env.example.sh` holds the values used for a run. They are not secrets and must
never point at a live project — the whole point is that this touches nothing
real. To use different ones: `ENV_FILE=./my-env.sh ./run-all.sh`.
