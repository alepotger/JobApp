/* Gmail → inbound-email, for people without a domain.
 *
 * The inbound-email function expects a mail provider to POST it a received
 * message. Routing real mail into it normally means a domain with MX records
 * pointed at Resend or SendGrid. Without one, this stands in: a Google Apps
 * Script running in your own account reads threads and posts them to the
 * function itself, authenticating with the shared secret.
 *
 * The function cannot tell the difference. It is the same endpoint, the same
 * payload shape and the same authentication path as a provider webhook — only
 * the caller changed.
 *
 * Threads are found two ways, and you can use either or both:
 *   - anything you label "JobApp/Inbound" by hand
 *   - anything matching AUTO_QUERY, if you set one
 * Both end up labelled "JobApp/Filed", which is also what stops the automatic
 * search picking the same thread up twice.
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
 * OPTIONAL, for automatic labelling
 *        AUTO_QUERY   a Gmail search expression — see the README section
 *        DRY_RUN      "true" to log what would be posted and post nothing
 *
 *   Set both, run by hand, read the log, tune AUTO_QUERY until it is finding
 *   what you want and nothing else, then remove DRY_RUN. Tuning a query
 *   against a live inbox with the safety off is how you end up with fifty
 *   newsletters in your ledger.
 *
 * The secrets live in Script Properties rather than in this file so the code
 * stays pasteable and shareable without carrying write access to your database.
 */

const SOURCE_LABEL = 'JobApp/Inbound';
const DONE_LABEL = 'JobApp/Filed';
const MAX_THREADS = 50;
const BODY_LIMIT = 5000;

/* How far back the automatic search looks. Manual labelling ignores this — if
   you label something from last year, it gets filed. The window exists so a
   15-minute trigger is not re-scanning your entire archive, and so switching
   AUTO_QUERY on does not immediately post years of old mail. */
const WINDOW_DAYS = 14;

function fileLabelledReplies() {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('FUNCTION_URL');
  const secret = props.getProperty('INBOUND_SHARED_SECRET');
  const token = props.getProperty('INBOUND_TOKEN');
  const autoQuery = (props.getProperty('AUTO_QUERY') || '').trim();
  const dryRun = (props.getProperty('DRY_RUN') || '').trim().toLowerCase() === 'true';

  if (!url || !secret || !token) {
    throw new Error(
      'Set FUNCTION_URL, INBOUND_SHARED_SECRET and INBOUND_TOKEN under ' +
      'Project Settings → Script Properties before running this.'
    );
  }

  const source = labelNamed(SOURCE_LABEL);
  const done = labelNamed(DONE_LABEL);

  const threads = collectThreads(source, autoQuery);
  if (threads.length === 0) {
    Logger.log('nothing to file' + (autoQuery ? '' : ' (no AUTO_QUERY set — labelling only)'));
    return;
  }

  if (dryRun) {
    Logger.log('DRY RUN — ' + threads.length + ' thread(s) would be posted, nothing sent:');
    for (const thread of threads) {
      for (const message of thread.getMessages()) {
        Logger.log('  ' + message.getFrom() + '  |  ' + message.getSubject());
      }
    }
    Logger.log('Remove the DRY_RUN property to file these for real.');
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
         worth retrying, so the labels stay as they are and the next run picks
         the thread up again. */
      if (result.code !== 200 && result.code !== 202) allAccepted = false;
    }

    if (allAccepted) {
      /* DONE_LABEL is bookkeeping, not decoration: the automatic search
         excludes it, so this is what stops a thread being posted every fifteen
         minutes for the next fortnight. */
      thread.addLabel(done);
      thread.removeLabel(source);
    }
  }
}

function collectThreads(source, autoQuery) {
  const seen = {};
  const all = [];

  const add = function (list) {
    for (const thread of list) {
      const id = thread.getId();
      if (!seen[id]) {
        seen[id] = true;
        all.push(thread);
      }
    }
  };

  add(source.getThreads(0, MAX_THREADS));

  if (autoQuery) {
    /* Guards, not preferences — appended to whatever you wrote so a careless
       AUTO_QUERY cannot re-post filed threads or trawl the whole archive. */
    const guarded =
      '(' + autoQuery + ') -label:"' + DONE_LABEL + '" newer_than:' + WINDOW_DAYS + 'd';
    add(GmailApp.search(guarded, 0, MAX_THREADS));
  }

  return all;
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
