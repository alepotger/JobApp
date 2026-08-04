/* GENERATED — DO NOT EDIT. Built by _dashboard/build.mjs from:
 *   _shared/inbound.ts
 *   _shared/verify.ts
 *   inbound-email/index.ts
 *
 * Paste this whole file into the Supabase dashboard function editor.
 * The dashboard cannot resolve ../_shared/, so those modules are inlined
 * here verbatim. Edit the sources above and re-run the build; editing
 * this file directly will be overwritten and will drift from the tests. */

import { createClient } from "jsr:@supabase/supabase-js@2";

/* ── inlined from _shared/inbound.ts ───────────────────── */
/* Decision logic for the inbound-email webhook.
 *
 * Everything here is pure: no network, no Deno globals, no database. The
 * entrypoint does the I/O and hands the results in, which keeps the parts that
 * are easy to get wrong — payload shapes, matching, status transitions — under
 * test. */

type Mail = {
  messageId: string;
  from: string;
  fromName: string;
  to: string[];
  subject: string;
  text: string;
  receivedAt: string;
};

type Application = {
  id: string;
  company: string;
  role: string;
  status: string;
  replies: string;
  contact_email: string;
  activity: string;
};

type Match = {
  application: Application;
  matchedBy: string;
  score: number;
};

/* Addresses that identify a person, not an employer. A reply from one of these
   can still be matched by an explicit contact_email, but never by its domain. */
const PUBLIC_MAILBOXES = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
  "yahoo.com", "yahoo.co.uk", "icloud.com", "me.com", "aol.com", "proton.me",
  "protonmail.com", "gmx.com", "mail.com", "zoho.com", "fastmail.com",
]);

/* Mail hosts and applicant tracking systems relay for many employers, so their
   domain says nothing about which company replied. */
const RELAY_DOMAINS = new Set([
  "greenhouse.io", "myworkday.com", "workday.com", "lever.co", "ashbyhq.com",
  "smartrecruiters.com", "successfactors.com", "taleo.net", "icims.com",
  "bamboohr.com", "teamtailor.com", "workable.com", "breezy.hr", "jobvite.com",
  "sendgrid.net", "amazonses.com", "mailgun.org", "resend.dev",
]);

const emailAddress = (raw: string): string => {
  if (!raw) return "";
  const angled = /<([^>]+)>/.exec(raw);
  const addr = (angled ? angled[1] : raw).trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+$/.test(addr) ? addr : "";
};

const displayName = (raw: string): string => {
  if (!raw) return "";
  const angled = /^\s*"?([^"<]*?)"?\s*</.exec(raw);
  return (angled ? angled[1] : "").trim();
};

const domainOf = (address: string): string => {
  const at = address.lastIndexOf("@");
  return at === -1 ? "" : address.slice(at + 1).toLowerCase();
};

/* "Example Consulting, Ltd." and "example-consulting.com" should look alike. */
const squash = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const COMPANY_NOISE =
  /\b(ltd|limited|llc|inc|incorporated|plc|gmbh|bv|sa|srl|group|holdings|the)\b/g;

const companyKey = (company: string): string =>
  squash(company.toLowerCase().replace(COMPANY_NOISE, ""));

/* The registrable-ish part of a domain: "careers.northwind.co.uk" → "northwind".
   Not a public-suffix implementation, just enough to compare against a name. */
const domainCore = (domain: string): string => {
  const parts = domain.split(".").filter(Boolean);
  if (parts.length < 2) return squash(domain);
  const TWO_PART = new Set(["co", "com", "org", "net", "ac", "gov"]);
  let idx = parts.length - 2;
  if (parts.length >= 3 && TWO_PART.has(parts[parts.length - 2])) idx = parts.length - 3;
  return squash(parts[idx]);
};

/* Providers disagree on payload shape, and change it. Read defensively from
   every place a field is plausibly found rather than trusting one schema. */
function normaliseInbound(payload: Record<string, unknown>): Mail | null {
  const data = ((payload.data as Record<string, unknown>) ?? payload) as Record<string, unknown>;
  const pick = (...keys: string[]): string => {
    for (const key of keys) {
      const v = data[key] ?? payload[key];
      if (typeof v === "string" && v.trim() !== "") return v;
    }
    return "";
  };

  const rawFrom = pick("from", "sender", "From");
  const from = emailAddress(rawFrom);
  if (!from) return null;

  const rawTo = data.to ?? payload.to ?? data.recipient ?? payload.recipient ?? "";
  const toList = (Array.isArray(rawTo) ? rawTo : String(rawTo).split(","))
    .map((t) => emailAddress(String(t)))
    .filter(Boolean);

  const messageId =
    pick("message_id", "messageId", "id", "email_id", "Message-Id") ||
    // No provider id: fall back to something stable for this exact delivery so
    // a retry still de-duplicates.
    `${from}|${pick("subject", "Subject")}|${pick("created_at", "date", "timestamp")}`;

  return {
    messageId,
    from,
    fromName: displayName(rawFrom),
    to: toList,
    subject: pick("subject", "Subject"),
    text: pick("text", "text_body", "plain", "body-plain", "TextBody", "html", "Html"),
    receivedAt: pick("created_at", "date", "timestamp", "received_at") || new Date().toISOString(),
  };
}

/* Inbound addresses look like reply+<token>@inbound.example.com, so one route
   can serve every account without a lookup per message. */
function tokenFromRecipients(to: string[]): string | null {
  for (const address of to) {
    const local = address.slice(0, address.lastIndexOf("@"));
    const plus = local.indexOf("+");
    if (plus !== -1) {
      const tag = local.slice(plus + 1).trim();
      if (tag) return tag;
    }
    const dashed = /^(?:reply|inbound|u)-([a-z0-9]{6,})$/i.exec(local);
    if (dashed) return dashed[1];
  }
  return null;
}

/* Ranks a user's applications against one inbound mail. Returns the best
   candidate only when the evidence clears a floor — a wrong row silently
   overwritten is worse than a reply left for the user to file by hand. */
function pickApplication(rows: Application[], mail: Mail): Match | null {
  const fromDomain = domainOf(mail.from);
  const core = domainCore(fromDomain);
  const generic = PUBLIC_MAILBOXES.has(fromDomain) || RELAY_DOMAINS.has(fromDomain);
  const haystack = `${mail.subject} ${mail.fromName}`.toLowerCase();

  const scored = rows.map((row): Match => {
    const contact = emailAddress(row.contact_email || "");
    const key = companyKey(row.company || "");
    let score = 0;
    let matchedBy = "";

    if (contact && contact === mail.from) {
      score = 100;
      matchedBy = "contact_email";
    } else if (contact && !generic && domainOf(contact) === fromDomain) {
      score = 80;
      matchedBy = "contact_domain";
    } else if (key && !generic && core && (core === key || core.includes(key) || key.includes(core))) {
      score = 60;
      matchedBy = "company_domain";
    } else if (key && key.length >= 4 && haystack.includes(row.company.toLowerCase())) {
      score = 40;
      matchedBy = "company_in_subject";
    }

    // A live application is far likelier to be the one being replied to.
    if (score > 0 && row.status !== "closed") score += 5;
    return { application: row, matchedBy, score };
  });

  const ranked = scored
    .filter((m) => m.score >= 40)
    .sort(
      (a, b) =>
        b.score - a.score ||
        new Date(b.application.activity).getTime() - new Date(a.application.activity).getTime()
    );

  if (ranked.length === 0) return null;

  /* Two rows equally plausible — most often the same company applied to twice —
     is not a match worth acting on automatically. */
  if (ranked.length > 1 && ranked[0].score === ranked[1].score && ranked[0].score < 100) {
    return null;
  }
  return ranked[0];
}

/* A reply proves the application progressed past "sent", but it says nothing
   about an application already further along. Dragging an interview back to
   Replied would lose real progress and corrupt the funnel, so only the two
   earlier stages promote. */
function nextStatusFor(current: string): string | null {
  return current === "to-apply" || current === "applied" ? "replied" : null;
}

const BODY_LIMIT = 2000;
const FIELD_LIMIT = 8000;

function composeReply(existing: string, mail: Mail): string {
  const day = (mail.receivedAt || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
  const body = mail.text.replace(/\r\n/g, "\n").trim();
  const clipped =
    body.length > BODY_LIMIT ? `${body.slice(0, BODY_LIMIT).trimEnd()}\n[…truncated]` : body;

  const entry = [
    `[${day}] ${mail.from}${mail.subject ? ` — ${mail.subject}` : ""}`,
    clipped,
  ]
    .filter(Boolean)
    .join("\n");

  // Newest first, so the cell shows the latest reply without being opened.
  const merged = existing.trim() ? `${entry}\n\n${existing.trim()}` : entry;
  return merged.length > FIELD_LIMIT
    ? `${merged.slice(0, FIELD_LIMIT).trimEnd()}\n[…older replies trimmed]`
    : merged;
}

function appendHistory(
  history: unknown,
  status: string,
  at: string
): Array<{ to: string; at: string }> {
  const trail = Array.isArray(history) ? (history as Array<{ to: string; at: string }>) : [];
  return [...trail, { to: status, at }].slice(-200);
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

/* ── inbound-email/index.ts ───────────────────── */
/* Inbound email → "Replied".
 *
 * A provider (Resend, SendGrid) posts a received email here. The function
 * finds which application it belongs to, logs the message into that row's
 * Replies field, and promotes the row to Replied if it had not got there yet.
 *
 * Deploy:  supabase functions deploy inbound-email --no-verify-jwt
 *
 * --no-verify-jwt is required: the caller is a mail provider, which cannot
 * present a Supabase JWT. Authentication is instead the provider's own
 * signature, checked below — never remove that check to "make it work". */


const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SIGNING_SECRET = Deno.env.get("INBOUND_SIGNING_SECRET") ?? "";
const SHARED_SECRET = Deno.env.get("INBOUND_SHARED_SECRET") ?? "";

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only" });

  const url = new URL(req.url);
  const raw = await req.text();

  /* ---- authenticate the caller ---------------------------------------- */
  const signed = await verifySvix(
    SIGNING_SECRET,
    {
      id: req.headers.get("svix-id") ?? req.headers.get("webhook-id") ?? "",
      timestamp: req.headers.get("svix-timestamp") ?? req.headers.get("webhook-timestamp") ?? "",
      signature: req.headers.get("svix-signature") ?? req.headers.get("webhook-signature") ?? "",
    },
    raw
  );
  const shared = verifySharedSecret(
    SHARED_SECRET,
    req.headers.get("x-inbound-secret") ?? req.headers.get("authorization"),
    url.searchParams.get("key")
  );

  if (!signed && !shared) return json(401, { error: "unauthenticated" });

  /* ---- read the message ------------------------------------------------ */
  let payload: Record<string, unknown>;
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("json")) {
      payload = JSON.parse(raw);
    } else {
      // SendGrid Inbound Parse posts multipart/form-data.
      payload = Object.fromEntries(new URLSearchParams(raw));
    }
  } catch {
    return json(400, { error: "unparseable body" });
  }

  const mail = normaliseInbound(payload);
  if (!mail) return json(400, { error: "no sender address in payload" });

  const db = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  /* ---- whose mailbox is this? ------------------------------------------ */
  const token = tokenFromRecipients(mail.to);
  const settingsQuery = db.from("tracker_settings").select("user_id, inbound_token");
  const { data: settings, error: settingsError } = token
    ? await settingsQuery.eq("inbound_token", token).limit(1)
    : await settingsQuery.limit(2);

  if (settingsError) return json(500, { error: settingsError.message });

  /* With no token we can only proceed when the project has exactly one
     account, which is the norm for this bring-your-own-database setup.
     Guessing between several would file mail against a stranger's pipeline. */
  if (!settings || settings.length !== 1) {
    return json(202, {
      status: "unrouted",
      reason: token ? "no account for that address" : "recipient token missing and several accounts exist",
    });
  }
  const userId = settings[0].user_id as string;

  /* ---- has this delivery already been applied? ------------------------- */
  const { error: ledgerError } = await db.from("inbound_messages").insert({
    message_id: mail.messageId,
    user_id: userId,
    from_address: mail.from,
    subject: mail.subject,
  });
  if (ledgerError && ledgerError.code !== "23505") {
    return json(500, { error: ledgerError.message });
  }
  if (ledgerError) {
    /* The id is already in the ledger, which means one of two things, and they
       are not the same. Either the provider is retrying a delivery that
       finished — repeating it would append the reply twice — or it is retrying
       one that started and did not finish, because the database failed
       somewhere after this insert. Treating both as duplicates loses the
       second kind outright: the provider retries, gets a cheerful 200, and the
       reply is never filed.

       application_id tells them apart. It is written last, only once the
       application row has actually been updated, so its absence means the work
       did not complete. An unmatched message also has no application_id, and
       reprocessing one changes nothing, so reprocessing it is harmless.

       That leaves one residual case: an update that succeeded and then failed
       to record itself, where this will file the reply a second time. That is
       the right way to be wrong. A duplicated entry is visible in the cell and
       can be edited out; a silently dropped reply is invisible. */
    const { data: prior, error: priorError } = await db
      .from("inbound_messages")
      .select("application_id")
      .eq("message_id", mail.messageId)
      .limit(1);

    if (priorError) return json(500, { error: priorError.message });
    if (prior && prior.length > 0 && prior[0].application_id) {
      return json(200, { status: "duplicate" });
    }
    // Otherwise fall through and finish what the last attempt started.
  }

  /* ---- which application? ---------------------------------------------- */
  const { data: rows, error: rowsError } = await db
    .from("applications")
    .select("id, company, role_title, status, replies, contact_email, activity, stage_history")
    .eq("user_id", userId)
    .eq("deleted", false);

  if (rowsError) return json(500, { error: rowsError.message });

  const candidates: Application[] = (rows ?? []).map((r) => ({
    id: r.id,
    company: r.company ?? "",
    role: r.role_title ?? "",
    status: r.status ?? "",
    replies: r.replies ?? "",
    contact_email: r.contact_email ?? "",
    activity: r.activity,
  }));

  const match = pickApplication(candidates, mail);
  if (!match) {
    /* Deliberately not a failure. The message is recorded as received and
       unmatched, so the user can see it arrived rather than wondering. */
    return json(202, { status: "unmatched", from: mail.from, subject: mail.subject });
  }

  /* ---- apply it -------------------------------------------------------- */
  const source = (rows ?? []).find((r) => r.id === match.application.id)!;
  const now = new Date().toISOString();
  const promoted = nextStatusFor(match.application.status);

  const patch: Record<string, unknown> = {
    replies: composeReply(match.application.replies, mail),
    activity: now,
  };
  if (promoted) {
    patch.status = promoted;
    patch.stage_history = appendHistory(source.stage_history, promoted, now);
  }

  const { error: updateError } = await db
    .from("applications")
    .update(patch)
    .eq("id", match.application.id)
    .eq("user_id", userId);

  if (updateError) return json(500, { error: updateError.message });

  /* This write is what a later retry reads to decide whether the work was
     done, so its failure is not cosmetic: it would make a retry file the reply
     a second time. The reply itself is already saved, so this is not worth
     failing the request over — but it is worth being able to find in the
     function logs afterwards. */
  const { error: ledgerUpdateError } = await db
    .from("inbound_messages")
    .update({ application_id: match.application.id, matched_by: match.matchedBy })
    .eq("message_id", mail.messageId);

  if (ledgerUpdateError) {
    console.error(
      `inbound-email: filed ${mail.messageId} against ${match.application.id} but could ` +
        `not record it — a provider retry will duplicate this reply: ${ledgerUpdateError.message}`
    );
  }

  return json(200, {
    status: "applied",
    application_id: match.application.id,
    matched_by: match.matchedBy,
    promoted_to: promoted ?? null,
  });
});
