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

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  digestHtml,
  digestSubject,
  digestText,
  staleReport,
  type DigestRow,
} from "../_shared/digest.ts";
import { constantTimeEqual } from "../_shared/verify.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
/* Trimmed here, not just at the comparison. HTTP already strips whitespace
   around header values, so trimming the incoming header alone protected the
   side that was never at risk; a secret pasted into the dashboard with a
   trailing newline would have failed this check forever, silently. */
const CRON_SECRET = (Deno.env.get("CRON_SECRET") ?? "").trim();
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

      /* Not thrown: the email has already gone, so failing the account here
         would report "error" for a digest that was delivered. But it must not
         be discarded either — supabase-js returns errors rather than throwing,
         so an unchecked update is a failure with no symptom at all. A missing
         service_role grant looked exactly like success. */
      const { error: stampError } = await db
        .from("tracker_settings")
        .update({ last_digest_at: new Date().toISOString() })
        .eq("user_id", account.user_id);

      if (stampError) {
        console.error(
          `weekly-digest: sent to ${account.user_id} but could not stamp ` +
            `last_digest_at — ${stampError.message}`
        );
      }

      results.push({
        user_id: account.user_id,
        status: "sent",
        stale: report.count,
        ...(stampError ? { stamped: false } : {}),
      });
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
