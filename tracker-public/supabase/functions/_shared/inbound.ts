/* Decision logic for the inbound-email webhook.
 *
 * Everything here is pure: no network, no Deno globals, no database. The
 * entrypoint does the I/O and hands the results in, which keeps the parts that
 * are easy to get wrong — payload shapes, matching, status transitions — under
 * test. */

export type Mail = {
  messageId: string;
  from: string;
  fromName: string;
  to: string[];
  subject: string;
  text: string;
  receivedAt: string;
};

export type Application = {
  id: string;
  company: string;
  role: string;
  status: string;
  replies: string;
  contact_email: string;
  activity: string;
};

export type Match = {
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

export const emailAddress = (raw: string): string => {
  if (!raw) return "";
  const angled = /<([^>]+)>/.exec(raw);
  const addr = (angled ? angled[1] : raw).trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+$/.test(addr) ? addr : "";
};

export const displayName = (raw: string): string => {
  if (!raw) return "";
  const angled = /^\s*"?([^"<]*?)"?\s*</.exec(raw);
  return (angled ? angled[1] : "").trim();
};

export const domainOf = (address: string): string => {
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
export const domainCore = (domain: string): string => {
  const parts = domain.split(".").filter(Boolean);
  if (parts.length < 2) return squash(domain);
  const TWO_PART = new Set(["co", "com", "org", "net", "ac", "gov"]);
  let idx = parts.length - 2;
  if (parts.length >= 3 && TWO_PART.has(parts[parts.length - 2])) idx = parts.length - 3;
  return squash(parts[idx]);
};

/* Providers disagree on payload shape, and change it. Read defensively from
   every place a field is plausibly found rather than trusting one schema. */
export function normaliseInbound(payload: Record<string, unknown>): Mail | null {
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
export function tokenFromRecipients(to: string[]): string | null {
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
export function pickApplication(rows: Application[], mail: Mail): Match | null {
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
export function nextStatusFor(current: string): string | null {
  return current === "to-apply" || current === "applied" ? "replied" : null;
}

const BODY_LIMIT = 2000;
const FIELD_LIMIT = 8000;

export function composeReply(existing: string, mail: Mail): string {
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

export function appendHistory(
  history: unknown,
  status: string,
  at: string
): Array<{ to: string; at: string }> {
  const trail = Array.isArray(history) ? (history as Array<{ to: string; at: string }>) : [];
  return [...trail, { to: status, at }].slice(-200);
}
