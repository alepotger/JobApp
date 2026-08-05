/* Gmail → inbound-email, for people without a domain.
 *
 * The inbound-email function expects a mail provider to POST it a received
 * message. Routing real mail into it normally means a domain with MX records
 * pointed at Resend or SendGrid. Without one, this stands in: a Google Apps
 * Script running in your own account reads labelled threads and posts them to
 * the function itself, authenticating with the shared secret.
 *
 * The function cannot tell the difference. It is the same endpoint, the same
 * payload shape and the same authentication path as a provider webhook — only
 * the caller changed.
 *
 * SETUP (all in a browser)
 *   1. script.google.com → New project → paste this file over Code.gs
 *   2. Project Settings → Script Properties → add three:
 *        FUNCTION_URL            https://<PROJECT-REF>.supabase.co/functions/v1/inbound-email
 *        INBOUND_SHARED_SECRET   the same value as the Edge Function secret
 *        INBOUND_TOKEN           tracker_settings.inbound_token
 *   3. Run `fileLabelledReplies` once and accept the authorization prompt.
 *      It creates both Gmail labels and exits.
 *   4. Label a reply with "JobApp/Inbound" and run it again.
 *   5. Triggers (clock icon) → add a time-driven trigger, every 15 minutes.
 *
 * The secrets live in Script Properties rather than in this file so the code
 * stays pasteable and shareable without carrying write access to your database.
 */

const SOURCE_LABEL = 'JobApp/Inbound';
const DONE_LABEL = 'JobApp/Filed';
const MAX_THREADS = 50;
const BODY_LIMIT = 5000;

function fileLabelledReplies() {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('FUNCTION_URL');
  const secret = props.getProperty('INBOUND_SHARED_SECRET');
  const token = props.getProperty('INBOUND_TOKEN');

  if (!url || !secret || !token) {
    throw new Error(
      'Set FUNCTION_URL, INBOUND_SHARED_SECRET and INBOUND_TOKEN under ' +
      'Project Settings → Script Properties before running this.'
    );
  }

  const source = labelNamed(SOURCE_LABEL);
  const done = labelNamed(DONE_LABEL);

  const threads = source.getThreads(0, MAX_THREADS);
  if (threads.length === 0) {
    Logger.log('nothing labelled ' + SOURCE_LABEL);
    return;
  }

  for (const thread of threads) {
    /* Every message in the thread is posted, not just the newest. Ones already
       filed come back as {"status":"duplicate"} from the function's ledger and
       cost nothing, which is what makes re-running this safe. */
    let allAccepted = true;

    for (const message of thread.getMessages()) {
      const result = post(url, secret, token, message);
      Logger.log(message.getId() + ' → ' + result.code + ' ' + result.body);

      /* 200 filed it, 202 means it arrived and matched nothing — both are the
         function having dealt with the message. Anything else is a failure
         worth retrying, so the label stays put and the next run picks it up. */
      if (result.code !== 200 && result.code !== 202) allAccepted = false;
    }

    if (allAccepted) {
      thread.addLabel(done);
      thread.removeLabel(source);
    }
  }
}

function post(url, secret, token, message) {
  const payload = {
    /* Gmail's own id: stable across runs, which is what lets the function's
       ledger recognise a repeat. */
    message_id: message.getId(),
    from: message.getFrom(),
    /* No real inbound address exists here, so the token is carried in a
       synthetic recipient — the same shape a catch-all address would produce,
       and what routes the message to your account rather than by process of
       elimination. */
    to: ['reply+' + token + '@inbound.local'],
    subject: message.getSubject(),
    text: message.getPlainBody().slice(0, BODY_LIMIT),
    created_at: message.getDate().toISOString(),
  };

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-inbound-secret': secret },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  return { code: response.getResponseCode(), body: response.getContentText() };
}

function labelNamed(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}
