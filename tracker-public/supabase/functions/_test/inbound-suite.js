const crypto = require("crypto");
const SECRET = process.env.INBOUND_SIGNING_SECRET;
const FN = "http://127.0.0.1:8802/", DB = "http://127.0.0.1:8801";
const out = [];
const t = (n, ok, d) => { out.push(ok); console.log((ok?"PASS  ":"FAIL  ")+n+(d?"  — "+d:"")); };

const sign = (id, ts, body) => "v1," + crypto.createHmac("sha256",
  Buffer.from(SECRET.replace(/^whsec_/, ""), "base64")).update(`${id}.${ts}.${body}`).digest("base64");

async function post(payload, o = {}) {
  const body = o.form ? new URLSearchParams(payload).toString() : JSON.stringify(payload);
  const id = o.id || "msg_" + crypto.randomUUID();
  const ts = String(Math.floor(Date.now() / 1000) + (o.skew || 0));
  const h = { "Content-Type": o.form ? "application/x-www-form-urlencoded" : "application/json" };
  if (!o.noSig) h["svix-signature"] = o.badSig ? "v1,AAAA" : sign(id, ts, body);
  if (!o.noSig) { h["svix-id"] = id; h["svix-timestamp"] = ts; }
  const res = await fetch(FN, { method: "POST", headers: h, body });
  return { status: res.status, body: await res.json() };
}
const reset = (s) => fetch(DB + "/__reset", { method: "POST", body: JSON.stringify(s) });
const state = () => fetch(DB + "/__state").then((r) => r.json());
const days = (n) => new Date(Date.now() - n * 86400000).toISOString();
const app = (o) => ({ id: "app-1", user_id: "11111111-2222-4333-8444-555555555555", company: "Northwind",
  role_title: "Analyst, Strategy", status: "applied", replies: "", contact_email: "",
  deleted: false, activity: days(9), stage_history: [{ to: "applied", at: days(9) }], ...o });
const mail = (over = {}) => ({ type: "email.received", created_at: new Date().toISOString(),
  data: { email_id: "re_" + crypto.randomUUID().slice(0, 8),
    from: "Priya Raman <priya.raman@northwind.com>",
    to: ["reply+aaaatoken@inbound.jobapp.dev"],
    subject: "Re: Application for Analyst, Strategy",
    text: "Thanks for applying.", ...over } });

(async () => {
  /* ---- authentication ---- */
  await reset({ applications: [app({})] });
  t("an unsigned POST is refused", (await post(mail(), { noSig: true })).status === 401);
  t("a forged signature is refused", (await post(mail(), { badSig: true })).status === 401);
  t("a delivery signed 10 minutes ago is refused as a replay",
    (await post(mail(), { skew: -600 })).status === 401);
  t("a timestamp from the future is refused too",
    (await post(mail(), { skew: 600 })).status === 401);
  t("nothing was written by any of those",
    (await state()).applications[0].status === "applied" &&
    (await state()).inbound_messages.length === 0);

  /* ---- provider retry ---- */
  await reset({ applications: [app({})] });
  const id = "msg_retry_1";
  const m = mail({ email_id: "re_fixed_id" });
  const first = await post(m, { id });
  const second = await post(m, { id: "msg_retry_2" });   // same email_id, new delivery id
  const st = await state();
  t("the first delivery is applied", first.status === 200 && first.body.status === "applied");
  t("a provider retry of the same email is a no-op",
    second.status === 200 && second.body.status === "duplicate");
  t("and the reply was not appended twice",
    (st.applications[0].replies.match(/Thanks for applying/g) || []).length === 1,
    (st.applications[0].replies.match(/Thanks for applying/g) || []).length + " copies");

  /* ---- ambiguity ---- */
  await reset({ applications: [
    app({ id: "a", role_title: "Analyst" }), app({ id: "b", role_title: "Associate" }) ] });
  const amb = await post(mail());
  const ambState = await state();
  t("two equally plausible rows leave the mail unfiled rather than guessing",
    amb.status === 202 && amb.body.status === "unmatched");
  t("and neither row was touched",
    ambState.applications.every((r) => r.status === "applied" && r.replies === ""));
  t("but the message is still recorded as received",
    ambState.inbound_messages.length === 1);

  /* ---- progress is never dragged backwards ---- */
  await reset({ applications: [app({ status: "interview",
    stage_history: [{ to: "interview", at: days(3) }] })] });
  const iv = await post(mail());
  const ivState = await state();
  t("a reply to an interview-stage row is filed without demoting it",
    iv.body.status === "applied" && iv.body.promoted_to === null &&
    ivState.applications[0].status === "interview");
  t("the reply text still landed", /Thanks for applying/.test(ivState.applications[0].replies));
  t("and its stage history was not rewritten",
    ivState.applications[0].stage_history.length === 1);

  /* ---- a personal address only matches an explicit contact ---- */
  await reset({ applications: [app({ contact_email: "" })] });
  const gm = await post(mail({ from: "someone@gmail.com" }));
  t("a gmail sender is not matched to a company by its domain",
    gm.status === 202 && gm.body.status === "unmatched");

  await reset({ applications: [app({ contact_email: "someone@gmail.com" })] });
  const gm2 = await post(mail({ from: "Someone <someone@gmail.com>" }));
  t("but is matched when it is the row's recorded contact",
    gm2.body.status === "applied" && gm2.body.matched_by === "contact_email");

  /* ---- an ATS relay cannot claim a company by its domain ---- */
  await reset({ applications: [app({})] });
  const ats = await post(mail({ from: "no-reply@greenhouse.io",
    subject: "Your application to Northwind" }));
  t("an ATS relay falls back to the company named in the subject",
    ats.body.status === "applied" && ats.body.matched_by === "company_in_subject");

  /* ---- SendGrid posts a form, not JSON ---- */
  await reset({ applications: [app({})] });
  const sg = await post({ from: "priya.raman@northwind.com",
    to: "reply+aaaatoken@inbound.jobapp.dev",
    subject: "Re: your application", text: "We would like to talk.",
    "message_id": "sg-" + crypto.randomUUID().slice(0, 8) }, { form: true });
  t("a form-encoded SendGrid payload is understood", sg.body.status === "applied", JSON.stringify(sg.body));

  /* ---- a sender nobody recognises ---- */
  await reset({ applications: [app({})] });
  const un = await post(mail({ from: "newsletter@unrelated-vendor.dev", subject: "Weekly roundup" }));
  const unState = await state();
  t("unrecognised mail is accepted, recorded, and changes nothing",
    un.status === 202 && un.body.status === "unmatched" &&
    unState.inbound_messages.length === 1 && unState.applications[0].replies === "");

  /* ---- a database failure mid-delivery must not eat the email ----
     The ledger row is written before the work, so a failure after it used to
     make the provider's retry look like a duplicate. The reply was lost with
     a 200 and no trace. */
  await reset({ applications: [app({})] });
  await fetch(DB + "/__fail", { method: "POST", body: JSON.stringify({ table: "applications", method: "GET" }) });
  const blinked = await post(mail({ email_id: "re_retry_after_failure" }));
  t("a database failure mid-delivery returns 500 so the provider will retry",
    blinked.status === 500);
  const midState = await state();
  t("the delivery is in the ledger but nothing was applied",
    midState.inbound_messages.length === 1 && midState.applications[0].replies === "");

  const recovered = await post(mail({ email_id: "re_retry_after_failure" }));
  const endState = await state();
  t("the provider's retry finishes the job rather than being called a duplicate",
    recovered.status === 200 && recovered.body.status === "applied",
    JSON.stringify(recovered.body));
  t("and the reply landed exactly once",
    (endState.applications[0].replies.match(/Thanks for applying/g) || []).length === 1);

  /* A retry of a delivery that DID complete must still be a no-op — the fix
     must not have traded one failure for the other. */
  const again = await post(mail({ email_id: "re_retry_after_failure" }));
  t("a retry of a completed delivery is still a no-op",
    again.body.status === "duplicate",
    JSON.stringify(again.body));
  t("so the reply is still there exactly once",
    ((await state()).applications[0].replies.match(/Thanks for applying/g) || []).length === 1);

  /* ---- no sender at all ---- */
  t("a payload with no sender is a 400, not a crash",
    (await post({ data: { subject: "nothing here" } })).status === 400);

  console.log("\n" + out.filter(Boolean).length + "/" + out.length + " inbound checks passed");
})();
