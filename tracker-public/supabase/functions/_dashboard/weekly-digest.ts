/* GENERATED — DO NOT EDIT. Built by _dashboard/build.mjs from:
 *   _shared/digest.ts
 *   _shared/verify.ts
 *   weekly-digest/index.ts
 *
 * Paste this whole file into the Supabase dashboard function editor.
 * The dashboard cannot resolve ../_shared/, so those modules are inlined
 * here verbatim. Edit the sources above and re-run the build; editing
 * this file directly will be overwritten and will drift from the tests. */

import { createClient } from "jsr:@supabase/supabase-js@2";

/* ── inlined from _shared/digest.ts ───────────────────── */
/* Content for the weekly digest. Pure: takes rows and a clock, returns text. */

type DigestRow = {
  id: string;
  company: string;
  role: string;
  status: string;
  activity: string;
};

type Report = {
  count: number;
  oldestDays: number;
  items: Array<{ company: string; role: string; status: string; days: number }>;
  interviews: number;
  offers: number;
};

const DAY = 86400000;

/* Only stages where the ball is plausibly in your court. "To apply" has not
   been sent, and "Closed" is finished. */
const LIVE = ["applied", "replied", "interview"];

const STAGE_LABEL: Record<string, string> = {
  "to-apply": "To apply",
  applied: "Applied",
  replied: "Replied",
  interview: "Interview",
  offer: "Offer",
  closed: "Closed",
};

const daysSince = (iso: string, now: number): number =>
  Math.floor((now - new Date(iso).getTime()) / DAY);

function staleReport(rows: DigestRow[], now: number, staleAfter: number): Report {
  const stale = rows
    .filter((r) => LIVE.includes(r.status) && daysSince(r.activity, now) >= staleAfter)
    .map((r) => ({
      company: r.company.trim() || "Untitled application",
      role: r.role.trim(),
      status: STAGE_LABEL[r.status] || r.status,
      days: daysSince(r.activity, now),
    }))
    .sort((a, b) => b.days - a.days);

  return {
    count: stale.length,
    oldestDays: stale.length ? stale[0].days : 0,
    items: stale,
    interviews: rows.filter((r) => r.status === "interview").length,
    offers: rows.filter((r) => r.status === "offer").length,
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const digestSubject = (report: Report): string =>
  report.count === 0
    ? "Your pipeline is up to date"
    : `${plural(report.count, "application", "applications")} awaiting follow-up`;

/* The headline the brief asked for, phrased so it reads correctly at n=1. */
function headline(report: Report): string {
  if (report.count === 0) return "Nothing is awaiting follow-up. Everything live has been touched recently.";
  return (
    `You have ${plural(report.count, "app", "apps")} awaiting follow-up. ` +
    `Last touched ${plural(report.oldestDays, "day", "days")} ago.`
  );
}

function digestText(report: Report): string {
  const lines = [headline(report), ""];

  for (const item of report.items) {
    const role = item.role ? ` — ${item.role}` : "";
    lines.push(`• ${item.company}${role} · ${item.status} · ${plural(item.days, "day", "days")} ago`);
  }

  if (report.interviews || report.offers) {
    lines.push("");
    const bits = [];
    if (report.interviews) bits.push(`${plural(report.interviews, "interview", "interviews")} in progress`);
    if (report.offers) bits.push(`${plural(report.offers, "offer", "offers")} on the table`);
    lines.push(bits.join(" · "));
  }

  return lines.join("\n").trim();
}

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );

function digestHtml(report: Report, appUrl: string): string {
  const rows = report.items
    .map((item) => {
      const role = item.role ? ` — ${escapeHtml(item.role)}` : "";
      return (
        `<tr><td style="padding:6px 0;border-bottom:1px solid #ded7c5">` +
        `<strong>${escapeHtml(item.company)}</strong>${role}<br>` +
        `<span style="color:#7a7365;font-size:12px">${escapeHtml(item.status)} · ` +
        `${plural(item.days, "day", "days")} ago</span></td></tr>`
      );
    })
    .join("");

  const link = appUrl
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(appUrl)}" ` +
      `style="color:#8a6d28">Open the tracker</a></p>`
    : "";

  return (
    `<div style="font-family:system-ui,sans-serif;color:#545454;max-width:520px">` +
    `<p style="font-size:16px;margin:0 0 16px">${escapeHtml(headline(report))}</p>` +
    (rows ? `<table style="width:100%;border-collapse:collapse">${rows}</table>` : "") +
    link +
    `</div>`
  );
}

/* ── inlined from _shared/verify.ts ───────────────────── */
/* Authenticating callers.
 *
 * The inbound endpoint is a public URL that writes to the database, so an
 * unauthenticated POST must never reach the matching logic. Resend signs with
 * Svix; SendGrid's Inbound Parse does not sign at all and is protected by a
 * shared secret instead. Both paths are supported. */

const enc = new TextEncoder();

/* Compares in time independent of where the first difference falls, so a
   caller cannot learn the secret one byte at a time from response timing. */
function constantTimeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  // Fold the length difference in rather than returning early on it.
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

const base64 = (bytes: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)));

const fromBase64 = (s: string): Uint8Array =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function hmacSha256(key: Uint8Array, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return base64(await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message)));
}

const TOLERANCE_SECONDS = 5 * 60;

/* Svix signature scheme, as used by Resend webhooks.
 *   signed content = "<id>.<timestamp>.<raw body>"
 *   header         = "v1,<sig> v1,<other sig>"   (space separated, may rotate)
 * The secret arrives as "whsec_<base64>". */
async function verifySvix(
  secret: string,
  headers: { id: string; timestamp: string; signature: string },
  rawBody: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): Promise<boolean> {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;

  const sent = Number(headers.timestamp);
  if (!Number.isFinite(sent)) return false;
  // Rejects both replays of an old delivery and clocks skewed into the future.
  if (Math.abs(nowSeconds - sent) > TOLERANCE_SECONDS) return false;

  const key = fromBase64(secret.startsWith("whsec_") ? secret.slice(6) : secret);
  const expected = await hmacSha256(key, `${headers.id}.${headers.timestamp}.${rawBody}`);

  return headers.signature
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .some((part) => {
      const value = part.startsWith("v1,") ? part.slice(3) : part;
      return constantTimeEqual(value, expected);
    });
}

/* The fallback for providers that do not sign: a secret the caller must present,
   accepted from a header or a query parameter because SendGrid's Inbound Parse
   only lets you configure a URL. */
function verifySharedSecret(
  secret: string,
  headerValue: string | null,
  queryValue: string | null
): boolean {
  if (!secret) return false;
  const offered = headerValue?.replace(/^Bearer\s+/i, "") ?? queryValue ?? "";
  return offered !== "" && constantTimeEqual(offered, secret);
}

/* ── weekly-digest/index.ts ───────────────────── */
/* Weekly digest.
 *
 * Called on a schedule by pg_cron (see migrations/002). For each account with
 * digests enabled, counts what has gone quiet and emails a summary:
 *
 *   "You have 3 apps awaiting follow-up. Last touched 9 days ago."
 *
 * Deploy:  supabase functions deploy weekly-digest --no-verify-jwt
 *
 * The caller is Postgres, not a signed-in user, so authentication is the
 * CRON_SECRET header instead of a JWT. */


const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const DIGEST_FROM = Deno.env.get("DIGEST_FROM") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "";

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function sendEmail(to: string, subject: string, text: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: DIGEST_FROM, to: [to], subject, text, html }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
}

Deno.serve(async (req) => {
  const offered = (req.headers.get("x-cron-secret") ?? "").trim();
  if (!CRON_SECRET || !constantTimeEqual(offered, CRON_SECRET)) {
    return json(401, { error: "unauthenticated" });
  }
  if (!RESEND_API_KEY || !DIGEST_FROM) {
    return json(500, { error: "RESEND_API_KEY and DIGEST_FROM must be set" });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const now = Date.now();

  const { data: accounts, error: accountsError } = await db
    .from("tracker_settings")
    .select("user_id, digest_email, stale_after")
    .eq("digest_enabled", true);

  if (accountsError) return json(500, { error: accountsError.message });

  const results: Array<Record<string, unknown>> = [];

  for (const account of accounts ?? []) {
    try {
      const { data: rows, error: rowsError } = await db
        .from("applications")
        .select("id, company, role_title, status, activity")
        .eq("user_id", account.user_id)
        .eq("deleted", false);

      if (rowsError) throw new Error(rowsError.message);

      const report = staleReport(
        (rows ?? []).map((r): DigestRow => ({
          id: r.id,
          company: r.company ?? "",
          role: r.role_title ?? "",
          status: r.status ?? "",
          activity: r.activity,
        })),
        now,
        account.stale_after ?? 7
      );

      /* Nothing to chase is not news. A digest that arrives every week whether
         or not it has anything to say is a digest people stop opening. */
      if (report.count === 0) {
        results.push({ user_id: account.user_id, status: "skipped", reason: "nothing stale" });
        continue;
      }

      let to = account.digest_email as string | null;
      if (!to) {
        const { data: user } = await db.auth.admin.getUserById(account.user_id);
        to = user?.user?.email ?? null;
      }
      if (!to) {
        results.push({ user_id: account.user_id, status: "skipped", reason: "no address" });
        continue;
      }

      await sendEmail(
        to,
        digestSubject(report),
        digestText(report),
        digestHtml(report, APP_URL)
      );

      await db
        .from("tracker_settings")
        .update({ last_digest_at: new Date().toISOString() })
        .eq("user_id", account.user_id);

      results.push({ user_id: account.user_id, status: "sent", stale: report.count });
    } catch (err) {
      // One account's failure must not stop the rest of the run.
      const message = err instanceof Error ? err.message : String(err);
      /* pg_cron discards the response body, so this array is read by nobody.
         Without a log line, an account whose digest fails every week fails
         invisibly, forever. This lands in Edge Function logs, which persist
         and can be searched. */
      console.error(`weekly-digest: ${account.user_id} failed — ${message}`);
      results.push({ user_id: account.user_id, status: "error", error: message });
    }
  }

  return json(200, { ran_at: new Date(now).toISOString(), results });
});
