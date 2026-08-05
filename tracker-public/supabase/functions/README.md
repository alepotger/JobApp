# Edge Functions

Two optional background jobs. The tracker works fully without them; they add
automatic reply logging and a weekly nudge.

| Function | Trigger | What it does |
|---|---|---|
| `inbound-email` | a mail provider posts a received email | Files the reply against the right application and moves it to **Replied** |
| `weekly-digest` | `pg_cron`, Mondays 08:00 UTC | Emails you what has gone quiet |

Both are deployed with `--no-verify-jwt`, because neither caller can present a
Supabase JWT — one is a mail provider, the other is Postgres. They authenticate
themselves instead: `inbound-email` verifies the provider's signature, and
`weekly-digest` requires a shared secret. **Do not remove those checks.**
`inbound-email` is a public URL that writes to your database.

## Before deploying

Run [`../migrations/002-inbound-and-digest.sql`](../migrations/002-inbound-and-digest.sql)
in the SQL Editor. It adds `contact_email`, a `tracker_settings` row per
account, the ledger that stops a retried delivery being logged twice, and the
`service_role` grants both functions need — see below if you ran an older copy
of it.

Find your inbound token:

```sql
select inbound_token from public.tracker_settings;
```

## Secrets

```bash
supabase secrets set \
  INBOUND_SIGNING_SECRET=whsec_...   `# Resend/Svix webhook secret` \
  INBOUND_SHARED_SECRET=$(openssl rand -hex 24) \
  CRON_SECRET=$(openssl rand -hex 24) \
  RESEND_API_KEY=re_... \
  DIGEST_FROM='Tracker <tracker@yourdomain.com>' \
  APP_URL=https://your-tracker-url
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

Set `INBOUND_SIGNING_SECRET` if your provider signs (Resend), or
`INBOUND_SHARED_SECRET` if it does not (SendGrid). Either satisfies the check;
setting neither means every request is rejected.

## Deploy

```bash
supabase functions deploy inbound-email  --no-verify-jwt
supabase functions deploy weekly-digest  --no-verify-jwt
```

## Routing mail in

Point a catch-all address at the function and put your token in the address, so
one route serves the account:

```
reply+<inbound_token>@inbound.yourdomain.com
```

- **Resend** — Domains → *Inbound*, forward to
  `https://<PROJECT-REF>.supabase.co/functions/v1/inbound-email`.
- **SendGrid** — Inbound Parse → destination
  `https://<PROJECT-REF>.supabase.co/functions/v1/inbound-email?key=<INBOUND_SHARED_SECRET>`
  (Inbound Parse cannot send custom headers, hence the query parameter).

Then forward or reply-to that address when you apply for something.

## Scheduling the digest

Uncomment the `pg_cron` block at the bottom of the migration, substitute your
project ref and `CRON_SECRET`, and run it.

Check it afterwards with:

```sql
select jobname, schedule, active from cron.job;
select * from cron.job_run_details order by start_time desc limit 5;
```

## When something goes wrong

Both functions log failures to **Supabase → Edge Functions → *function* →
Logs**, which persists and can be searched. Check there first — `pg_cron`
throws away the digest's response body, so the log line is the only record that
an account's digest failed.

### `permission denied for table tracker_settings`

A missing `GRANT`, not RLS — RLS refusals return zero rows and a `200`, and a
missing table comes back as `Could not find the table … in the schema cache`.
The functions connect as `service_role`, and every grant in `setup.sql` and in
early copies of `002` went to `authenticated` only. Re-run
[`../migrations/002-inbound-and-digest.sql`](../migrations/002-inbound-and-digest.sql)
(it is idempotent) or just the grants at the end of its privileges block.

Check what a role actually holds with:

```sql
select table_name, grantee,
       string_agg(privilege_type, ', ' order by privilege_type) as privileges
  from information_schema.role_table_grants
 where table_schema = 'public'
   and table_name in ('applications', 'tracker_settings', 'inbound_messages')
   and grantee in ('anon', 'authenticated', 'service_role')
 group by table_name, grantee order by table_name, grantee;
```

`REFERENCES, TRIGGER, TRUNCATE` and nothing else against `service_role` is the
signature of this fault.

Two log lines worth knowing:

- `weekly-digest: <user_id> failed — …` — that account got no email this week.
  The rest of the run continued.
- `inbound-email: filed <id> against <app> but could not record it` — the reply
  was saved but the ledger was not updated, so a provider retry will file it a
  second time. Harmless but visible; delete the duplicate entry from the cell.

**Retries are safe.** The ledger is written before the reply is filed, so a
delivery that fails partway leaves an id behind with no `application_id`
against it. A retry sees that and finishes the job rather than treating it as
already done — an earlier version returned `duplicate` here and lost the email
silently. A retry of a delivery that genuinely completed is still a no-op.

## Testing it locally

[`_test/run-all.sh`](_test/) runs both functions for real against a stub
database and a captured mail provider — no project, no keys, no network. Run it
after changing anything in here.

## How a reply is matched

In order of confidence, stopping at the first that fits:

1. **`contact_email` exact** — the address on the row.
2. **Same domain as `contact_email`** — a colleague of your known contact.
3. **Company name matches the sender's domain** — `careers@northwind.com` → Northwind.
4. **Company name in the subject or sender name** — the fallback for applicant
   tracking systems, which all send from `greenhouse.io` and similar.

Public mailboxes (gmail, outlook, …) and known ATS relays never match on domain
alone, since their domain says nothing about who is writing.

Two things it deliberately refuses to do:

- **Guess between equally plausible rows.** Two live applications at the same
  company leave the mail unfiled rather than picking one. Set `contact_email` on
  one of them to resolve it.
- **Move an application backwards.** Only `To apply` and `Applied` promote to
  `Replied`. A reply to something already at Interview is logged without
  touching the stage, because dragging it back would discard real progress and
  corrupt the funnel timings.

Unmatched mail returns `202` and is recorded in `inbound_messages`, so you can
see what arrived and why nothing moved:

```sql
select received_at, from_address, subject, matched_by, application_id
  from public.inbound_messages
 order by received_at desc limit 20;
```

## Testing without a mail provider

```bash
curl -X POST "https://<PROJECT-REF>.supabase.co/functions/v1/inbound-email?key=$INBOUND_SHARED_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{
        "message_id": "test-1",
        "from": "Talent <careers@northwind.com>",
        "to": ["reply+<inbound_token>@inbound.yourdomain.com"],
        "subject": "Your application",
        "text": "Thanks for applying, we would like to talk."
      }'
```

Repeat the same call and it returns `{"status":"duplicate"}` — the ledger is
doing its job.

For the digest:

```bash
curl -X POST "https://<PROJECT-REF>.supabase.co/functions/v1/weekly-digest" \
  -H "x-cron-secret: $CRON_SECRET"
```

It skips accounts with nothing stale, so make sure a live row is at least
`stale_after` days old (default 7) before expecting mail.
