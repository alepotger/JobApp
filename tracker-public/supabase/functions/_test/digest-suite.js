const FN = "http://127.0.0.1:8803/", DB = "http://127.0.0.1:8801";
const fs = require("fs"), BOX = __dirname + "/outbox.jsonl";
const U1 = "11111111-2222-4333-8444-555555555555";
const U2 = "99999999-8888-4777-8666-555555555555";
const out = [];
const t = (n, ok, d) => { out.push(ok); console.log((ok?"PASS  ":"FAIL  ")+n+(d?"  — "+d:"")); };
const days = (n) => new Date(Date.now() - n * 86400000).toISOString();
const reset = (s) => fetch(DB + "/__reset", { method: "POST", body: JSON.stringify(s) });
const state = () => fetch(DB + "/__state").then((r) => r.json());
const run = (secret) => fetch(FN, { method: "POST", headers: secret ? { "x-cron-secret": secret } : {} })
  .then(async (r) => ({ status: r.status, body: await r.json() }));
const outbox = () => { try { return fs.readFileSync(BOX, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse); } catch { return []; } };
const clearBox = () => { try { fs.unlinkSync(BOX); } catch {} };
const settings = (o = {}) => ({ user_id: U1, inbound_token: "aaaatoken", digest_email: null,
  digest_enabled: true, stale_after: 7, last_digest_at: null, ...o });
const stale = (n, o = {}) => ({ id: "s" + n, user_id: U1, company: "Co " + n, role_title: "Role",
  status: "applied", deleted: false, activity: days(20), ...o });

(async () => {
  /* ---- authentication ---- */
  t("no cron secret is refused", (await run(null)).status === 401);
  t("a wrong cron secret is refused", (await run("wrong-secret-entirely")).status === 401);
  t("a secret with the right length but wrong bytes is refused",
    (await run("x".repeat(process.env.CRON_SECRET.length))).status === 401);
  clearBox();
  t("none of those sent any mail", outbox().length === 0);

  /* ---- quiet weeks stay quiet ---- */
  await reset({ tracker_settings: [settings()],
    applications: [stale(1, { activity: days(2) }), stale(2, { activity: days(3) })] });
  clearBox();
  let r = await run(process.env.CRON_SECRET);
  t("a week with nothing stale sends nothing",
    r.body.results[0].status === "skipped" && outbox().length === 0,
    JSON.stringify(r.body.results[0]));

  /* ---- what counts as stale ---- */
  await reset({ tracker_settings: [settings()], applications: [
    stale(1, { activity: days(20) }),
    stale(2, { activity: days(8) }),
    stale(3, { activity: days(6) }),                        // inside the window
    stale(4, { activity: days(90), status: "closed" }),     // closed is not chased
    stale(5, { activity: days(90), deleted: true }),        // binned is not chased
    stale(6, { activity: days(90), status: "to-apply" }),   // never sent, nothing to chase
  ] });
  clearBox();
  r = await run(process.env.CRON_SECRET);
  t("only live applications past the window are counted",
    r.body.results[0].stale === 2, "counted " + r.body.results[0].stale);

  /* ---- the per-account window is respected ---- */
  await reset({ tracker_settings: [settings({ stale_after: 30 })],
    applications: [stale(1, { activity: days(20) })] });
  clearBox();
  r = await run(process.env.CRON_SECRET);
  t("a longer stale_after suppresses what a 7-day window would have flagged",
    r.body.results[0].status === "skipped");

  /* ---- an explicit digest address wins over the account address ---- */
  await reset({ tracker_settings: [settings({ digest_email: "elsewhere@example.org" })],
    applications: [stale(1)] });
  clearBox();
  await run(process.env.CRON_SECRET);
  t("digest_email overrides the sign-in address",
    outbox()[0].to[0] === "elsewhere@example.org", outbox()[0] && outbox()[0].to[0]);

  /* ---- opted out ---- */
  await reset({ tracker_settings: [settings({ digest_enabled: false })], applications: [stale(1)] });
  clearBox();
  r = await run(process.env.CRON_SECRET);
  t("an account with digests off is not even queried",
    r.body.results.length === 0 && outbox().length === 0);

  /* ---- one bad account must not stop the others ---- */
  await reset({
    tracker_settings: [settings({ user_id: U2, digest_email: null }), settings()],
    applications: [stale(1)],   // belongs to U1 only
  });
  clearBox();
  r = await run(process.env.CRON_SECRET);
  const sent = r.body.results.filter((x) => x.status === "sent");
  t("one account with nothing to report does not stop the other",
    r.body.results.length === 2 && sent.length === 1,
    JSON.stringify(r.body.results.map((x) => x.status)));
  t("and the healthy account still got its mail", outbox().length === 1);

  /* ---- the send is recorded ---- */
  const st = await state();
  t("last_digest_at is stamped only on the account that was sent to",
    st.tracker_settings.find((s) => s.user_id === U1).last_digest_at !== null &&
    st.tracker_settings.find((s) => s.user_id === U2).last_digest_at === null);

  console.log("\n" + out.filter(Boolean).length + "/" + out.length + " digest checks passed");
})();
