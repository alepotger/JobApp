# Application tracker

A pipeline tracker for job applications. One page, no build step, synced across
your devices. **Every user runs it on their own database**, so nobody's data
passes through anyone else's account.

![Stages: To apply, Applied, Replied, Interview, Offer, Closed](https://img.shields.io/badge/stages-6-555)
![No build step](https://img.shields.io/badge/build-none-555)
![Dark mode](https://img.shields.io/badge/theme-light%20%2F%20dark-555)
![MIT](https://img.shields.io/badge/licence-MIT-555)

---

## What it does

- **Six-stage pipeline.** Click a status to advance it: To apply → Applied →
  Replied → Interview → Offer → Closed. The bar at the top shows the shape of
  your funnel and doubles as a filter.
- **Chase timer.** Every live row tracks days since you last touched it. Seven
  days flags amber, fourteen flags red. Editing anything resets that row's
  clock — so the tracker measures follow-up, not submission count.
- **Inline editing.** Company, role, location, replies, next steps and notes
  are all click-to-edit. An empty cell opens an empty box; a cell with text in
  it opens with the caret already at the end, so you carry on where you left off.
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

## Setup

Open the deployed page and it walks you through all four steps. In short:

1. Create a free project at [supabase.com](https://supabase.com/dashboard).
2. In **SQL Editor → New query**, paste [`supabase/setup.sql`](supabase/setup.sql)
   and run it.
3. Under **Authentication → URL Configuration**, set **Site URL** to the address
   where you host this page, and add the same URL to **Redirect URLs**. Include
   the `https://` prefix.
4. Copy **Project URL** and the **publishable** (or legacy **anon**) key from
   **Project Settings → API Keys** and paste them into the page.

Sign in with an email link or the six-digit code. Use the same address on every
device to see one pipeline everywhere.

## Hosting it

`index.html` is the whole application. Any static host works:

- **Netlify:** drag the folder onto [app.netlify.com/drop](https://app.netlify.com/drop).
- **GitHub Pages:** enable Pages on the repo, serve from the root.
- **Locally:** `python3 -m http.server 8000`, then open
  `http://localhost:8000`. Opening the file directly with `file://` is
  unreliable — browsers restrict storage on that origin.

React, Tailwind and the Supabase client load from public CDNs, so an internet
connection is required.

## On security

The publishable key sits in the page and is visible to anyone who looks. That
is by design — it identifies the project, it does not grant access.

**Row Level Security is what protects the data.** The policy in `setup.sql`
makes Postgres reject any read or write where `auth.uid()` does not match the
row's `user_id`. Someone holding your URL and your publishable key still gets
an empty result.

Never paste a `service_role` or `sb_secret_` key into this page. Those carry
`BYPASSRLS` and ignore every policy.

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

MIT. See [LICENSE](LICENSE).
