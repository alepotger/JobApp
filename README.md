# Officient

A pipeline tracker for job applications. One page, no build step, synced across
your devices. **Every user runs it on their own database**, so nobody's data
passes through anyone else's account.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/alepotger/Officient)

![Stages: To apply, Applied, Replied, Interview, Offer, Closed](https://img.shields.io/badge/stages-6-555)
![No build step](https://img.shields.io/badge/build-none-555)
![Dark mode](https://img.shields.io/badge/theme-light%20%2F%20dark-555)
![MIT](https://img.shields.io/badge/licence-MIT-555)

The button gives you your own copy at your own address in about a minute. Then
connect it to a free Supabase database and sign in — the page walks you through
both, and [Getting started](#getting-started) below has the same steps in
writing.

---

## What it does

- **Six-stage pipeline.** Click a status to advance it: To apply → Applied →
  Replied → Interview → Offer → Closed. The bar at the top shows the shape of
  your funnel and doubles as a filter.
- **Chase count.** The header counts anything live you have not touched for
  seven days as awaiting chase, and editing a row resets its clock — so the
  tracker measures follow-up, not submission count. There is deliberately no
  per-row day counter: it read as "applied N days ago" when it actually
  measured last edit, so it went out rather than mislead.
- **Inline editing.** Company, role, location, replies and notes are all
  click-to-edit. An empty cell opens an empty box; a cell with text in it opens
  with the caret already at the end, so you carry on where you left off.
- **Next steps is a checklist.** Click the cell and a tickable box appears with
  the caret beside it; every Return adds another. Tick one and its text greys
  out with a line through it, untick and it comes back. Boxes tick straight from
  the table without opening anything. It is stored as a markdown task list in
  the same text column, so there is no migration and the value stays readable in
  the Supabase table editor — anything you wrote as prose beforehand simply
  becomes the first unticked step.
- **Group by, off by default.** A **Group by** dropdown splits the pipeline by
  location, company, role or status; it rests on **None**, so an ungrouped list
  is the obvious default rather than one option among several. Whatever you have
  typed into those cells becomes the categories — type "London" into a few
  location cells and London becomes one. A second dropdown then narrows to a
  single category, with counts against each.
- **Keyboard driven.** `Tab` moves between cells and the arrow keys move around
  the table like a grid. `Enter` opens a cell to edit, or advances the stage when
  the status pill has focus; `Shift`+`Enter` advances the stage from anywhere in
  the row. `Esc` discards an edit, `⌘`/`Ctrl`+`Enter` saves it, and either way
  focus returns to the cell you came from.
- **Dark mode.** A toggle in the header, remembered per browser. It follows your
  system preference until you override it, and applies before the first paint so
  a reload never flashes light.
- **Funnel analytics.** A dashboard across the top shows how many applications
  are sitting at each stage right now, each stage's share of everything you
  track, and the mean days each step actually took — the timings measured from
  recorded transitions, not estimated, and labelled with the sample they came
  from. Counts are live: moving a row out of a stage decrements it and
  increments the next. Collapse the whole panel to a one-line summary when you
  want the screen for the table; the choice is remembered.
- **Company scoring.** Rate each company 1-5 on salary, growth, culture and
  location. The table shows the aggregate, and sorts or filters by it. Rating
  only some facets is fine — the mean uses whichever you have filled in. Any
  rating clears again from the × beside it, or all four at once from *Clear
  all*, so a guess you were only trying out is never permanent.
- **Offer tracking.** Salary, equity, start date and a benefits rating appear in
  the row's drawer once an application reaches the Offer stage, and stay out of
  the way before then. The start date is typed day-first as `DD/MM/YYYY` — just
  the digits, the separators appear on their own, and backspace runs back
  through the whole field rather than sticking at each slash.
- **Export to PDF.** *Share / Export* opens the print dialogue against a print
  stylesheet: controls, delete buttons and the sync chip drop away, the palette
  forces back to light even in dark mode, and rows avoid splitting across pages.
- **Nothing is a dead end.** Every narrowing control has a visible way out —
  an **All** chip on the stage rail, **Reset view** whenever anything is
  filtered, and an empty table that names what is hiding rows rather than
  implying you have none. Advancing a stage, deleting a row and clearing a
  scorecard all offer an **Undo**, which restores the row exactly as it was,
  including its chase timer and recorded stage history.
- **Soft delete.** Deleted rows move to a Recently deleted panel and restore to
  their original position. Permanent deletion is a separate, confirmed action.
- **Live sync.** Changes appear on your other signed-in devices in about a
  second, over a websocket.

## Why bring-your-own database

There is no shared backend. You create a free Supabase project, run one SQL
script, and point the page at it. That means:

- Your applications, contacts and notes live in an account only you control.
- The author of this repo cannot see your data and is not responsible for it.
- No usage limits imposed by anyone else, and nothing to pay.

## Getting started

Four steps, about ten minutes, once. The deployed page walks you through the
same thing on screen — this is the version you can read first.

### 1. Get your own copy

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/alepotger/Officient)

Netlify forks this repo to your GitHub account and publishes it. There is no
build step and nothing to configure — accept the defaults. You end up at an
address like `https://silly-name-123456.netlify.app`.

**Copy that address. You need it in step 3, and it has to match exactly.**

Renaming the site later (Site configuration → Change site name) or adding a
custom domain changes the address, and sign-in breaks until you update step 3
to match. Rename first if you are going to.

<details>
<summary>Prefer to host it elsewhere?</summary>

`tracker-public/index.html` is the whole application; any static host works.

- **Netlify, by hand:** drag the `tracker-public` folder onto
  [app.netlify.com/drop](https://app.netlify.com/drop).
- **GitHub Pages:** enable Pages on your fork, serve from `/tracker-public`.
- **Locally:** `cd tracker-public && python3 -m http.server 8000`, then open
  `http://localhost:8000`. Opening the file directly with `file://` is
  unreliable — browsers restrict storage on that origin.

</details>

### 2. Create the database

1. Sign up at [supabase.com](https://supabase.com/dashboard) and create a
   project. Any region, any name. The free tier is plenty.
2. Open **SQL Editor → New query**, paste all of
   [`tracker-public/supabase/setup.sql`](tracker-public/supabase/setup.sql), and
   click **Run**.

That creates one table and locks it to your account. Running it twice is
harmless.

### 3. Tell Supabase where your page lives

This is the step that decides whether signing in works, so do it before
trying to sign in rather than after.

In your Supabase project, go to **Authentication → URL Configuration** and set
**both** of these to the address from step 1:

| Field | Value |
|---|---|
| **Site URL** | `https://your-site.netlify.app` |
| **Redirect URLs** | `https://your-site.netlify.app` |

Include the `https://` and leave off any trailing slash. If the address here
does not match your page exactly, Supabase refuses to send you back to it and
the sign-in link fails.

### 4. Connect and sign in

Open your page. It asks for two values, both from
**Project Settings → API Keys** in Supabase:

- **Project URL** — looks like `https://abcdefgh.supabase.co`
- **Publishable key** (or the legacy **anon** key) — starts `sb_publishable_…`
  or `eyJhbGciOi…`

Paste them in and press **Connect**. They are stored in that browser only.

> Never paste a `service_role` or `sb_secret_` key. Those bypass every security
> policy and belong on a server. See [On security](#on-security).

## Signing in

There is no password to invent or remember. Type your email address, press
**Send link**, and Supabase emails you.

**On the device you asked from**, click the link in the email — you land back on
the tracker, signed in.

**On a different device**, use the six-digit code instead. Links are tied to the
browser that requested them, so a link opened on your phone after requesting it
on your laptop will not work; the code always will.

To make the code appear in the email, add it to the template once: **Supabase →
Authentication → Emails → Magic Link**, and include `{{ .Token }}` somewhere in
the body. For example:

```html
<h2>Sign in to your tracker</h2>
<p><a href="{{ .ConfirmationURL }}">Click here to sign in</a></p>
<p>Or type this code into the page: <strong>{{ .Token }}</strong></p>
```

Sign in with the **same email address on every device** and you see one pipeline
everywhere, syncing in about a second.

### When sign-in does not work

| What you see | What it means |
|---|---|
| *"requested path is invalid"*, or the link lands on a Supabase error page | Step 3 does not match your page's address. Check for a missing `https://`, a trailing slash, or a site you renamed after setting it. |
| The link says **expired** or **invalid** the first time you click it | Some mail providers open links while scanning them, which spends the single use. Send another and use the six-digit code. |
| No email at all | Check spam. The built-in mail service allows only a handful of messages an hour — wait a few minutes, or connect your own SMTP under **Authentication → Emails**. |
| The email arrives with no six-digit code | The default template only contains the link. Add `{{ .Token }}` as shown above. |
| *"Database error"* once you are signed in | The setup SQL did not finish. Re-run all of `tracker-public/supabase/setup.sql`. |

The page recognises most of these and shows the fix on screen, including the
exact address to paste into step 3.

### Upgrading an existing database

`setup.sql` is idempotent and also upgrades an older table, so re-running it is
the simplest path. If you would rather apply only the delta, run
[`001-offer-scoring.sql`](tracker-public/supabase/migrations/001-offer-scoring.sql),
which adds the scoring, offer and stage-history columns. Either way the page
detects a database missing those columns and offers you the script on screen.

Stage history starts empty for rows that predate it. The migration anchors each
one at its current stage rather than inventing the earlier dates, so the "mean
days" figures are built only from transitions actually observed — each is
labelled with the sample size it came from.

## What is in this repo

```
netlify.toml                        deploy config: publish dir + security headers
tracker-public/
  index.html                        the entire application
  LICENSE
  supabase/
    setup.sql                       run this first; also upgrades an older table
    migrations/
      001-offer-scoring.sql         offer fields, company scoring, stage history
      002-inbound-and-digest.sql    inbound email + digest tables (optional)
    functions/
      inbound-email/                webhook: files a reply against an application
      weekly-digest/                cron: emails what has gone quiet
      _shared/                      matching, digest text, signature checks
```

## Hosting

`tracker-public/index.html` is the whole application — there is no build step,
so any static host works. The deploy button uses [`netlify.toml`](netlify.toml)
at the repository root, which publishes the `tracker-public` folder and sets the
security headers. Other hosts are covered under [step 1](#1-get-your-own-copy).

React, Tailwind and the Supabase client load from public CDNs, so an internet
connection is required. On a managed school or work network those hosts are
sometimes blocked; the page says so explicitly rather than showing a blank
screen.

Whenever you change the address the page is served from — a renamed Netlify
site, a custom domain — update **Site URL** and **Redirect URLs** in Supabase to
match, or sign-in stops working.

## On security

The publishable key sits in the page and is visible to anyone who looks. That
is by design — it identifies the project, it does not grant access.

**Row Level Security is what protects the data.** The policy in `setup.sql`
makes Postgres reject any read or write where `auth.uid()` does not match the
row's `user_id`. Someone holding your URL and your publishable key still gets
an empty result.

Never paste a `service_role` or `sb_secret_` key into this page. Those carry
`BYPASSRLS` and ignore every policy.

## Optional: email sync and a weekly digest

Two [Supabase Edge Functions](tracker-public/supabase/functions/) add background
behaviour. The tracker works fully without them — skip this unless you want it.

- **Replies file themselves.** Point a mail provider (Resend, SendGrid) at the
  `inbound-email` function and forward company replies to your inbound address.
  The reply is appended to that application's Replies field and the row moves to
  **Replied**. Matching is by contact address first, then the sender's domain
  against the company name, then the company name in the subject — the fallback
  for applicant tracking systems, which all send from the same few domains.
- **A weekly nudge.** `weekly-digest` runs on `pg_cron` and emails you *"You have
  3 apps awaiting follow-up. Last touched 9 days ago."* It stays quiet in a week
  with nothing to chase.

Both refuse to guess. Two live applications at the same company leave the mail
unfiled rather than picking one, and nothing already at Interview or beyond is
ever dragged back to Replied. Unmatched mail is still recorded, so you can see
what arrived and why nothing moved.

Setup, secrets and provider routing are in
[`supabase/functions/README.md`](tracker-public/supabase/functions/README.md).
Run
[`002-inbound-and-digest.sql`](tracker-public/supabase/migrations/002-inbound-and-digest.sql)
first.

## Limits

- **Last write wins.** Editing the same cell on two devices in the same second
  means one silently overwrites the other. Acceptable for a single-user tool.
- **Free-tier projects pause** after a week of inactivity. Loading the page
  wakes them, after a few seconds' delay. Data is not lost.
- **No automated backups** on the free tier. Export a CSV from the Supabase
  table editor occasionally.
- **Email rate limits** on the built-in mail service are low. Connect your own
  SMTP under **Authentication → Emails** if you hit them.

## Licence

MIT. See [LICENSE](tracker-public/LICENSE).
