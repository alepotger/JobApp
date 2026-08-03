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

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  appendHistory,
  composeReply,
  nextStatusFor,
  normaliseInbound,
  pickApplication,
  tokenFromRecipients,
  type Application,
} from "../_shared/inbound.ts";
import { verifySharedSecret, verifySvix } from "../_shared/verify.ts";

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
