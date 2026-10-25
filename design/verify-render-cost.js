/* What ordinary use costs, and the one number that must stay at zero.
 *
 *   node verify-render-cost.js            (CDN_CACHE=/dir for offline)
 *
 * The grid animates reordering with FLIP, from a layout effect that has no
 * dependency array — so it runs after EVERY render. It used to animate any row
 * whose top had shifted by a pixel, which meant committing one cell edit slid
 * 25 rows and opening one drawer slid 50. That is what "the rows all glitch"
 * was. The effect now animates only when the row ORDER changed.
 *
 * So: FLIP writes during a non-reordering interaction must be 0. Everything
 * else here is reported for context rather than asserted, because frame times
 * depend on the machine; THROTTLE=4 emulates a slower one.
 */
const INSTRUMENT = function () {
  window.__m = { rect: 0, xform: 0, frames: [] };
  const orig = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () { window.__m.rect++; return orig.apply(this, arguments); };
  /* MutationObserver, not a property hook: in Chrome the CSS longhands are not
     own accessors on CSSStyleDeclaration.prototype, so defineProperty on
     "transform" observes nothing and cheerfully reports zero. */
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.attributeName !== "style") continue;
      if (/transform:\s*translate/i.test(m.target.getAttribute("style") || "")) window.__m.xform++;
    }
  }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["style"] });
  let last = performance.now();
  (function tick(){ const now = performance.now(); window.__m.frames.push(now - last); last = now;
    requestAnimationFrame(tick); })();
};

const out = [];
const t = (n, ok, d) => { out.push(ok); console.log((ok ? "PASS  " : "FAIL  ") + n + (d ? "  — " + d : "")); };

/* Measures what ordinary use costs: typing in a cell, opening a drawer,
   changing a stage. Counts forced layout reads and FLIP animations, because
   those are what "laggy and glitchy" means in a React app that reads geometry
   in a layout effect. */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const CACHE = process.env.CDN_CACHE || "";
const PORT = process.env.PORT || 8777;
const N = Number(process.env.ROWS || 25);
const M = {
  "https://unpkg.com/react@18.3.1/umd/react.production.min.js": "react.js",
  "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js": "react-dom.js",
  "https://unpkg.com/@babel/standalone@7.29.8/babel.min.js": "babel.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/dist/umd/supabase.js": "supabase.js",
};
const UID = "00000000-0000-4000-8000-000000000001";
const USER = { id: UID, email: "t@e.com", aud: "authenticated", role: "authenticated",
  app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const PAGE = "aaaaaaaa-0000-4000-8000-000000000001";
const CO = ["Northwind","Acme","Bluefin","Carrow","Dalton","Everly","Fenwick","Garrick",
  "Halcyon","Ironside","Jarvis","Kestrel","Larkhill","Mayfield","Norbury","Orwell",
  "Pemberton","Quill","Ravenscroft","Sutton","Thornbury","Upton","Vance","Westhill","Yarrow"];
const rows = [];
for (let i = 0; i < N; i++) rows.push({
  id: "r" + i, user_id: UID, company: CO[i % CO.length] + (i >= CO.length ? " " + i : ""),
  role_title: "Analyst, Strategy", location: "London", status: ["to-apply","applied","replied","interview"][i % 4],
  replies: "", next_steps: "", notes: "", sort_order: i, deleted: false, contact_email: "",
  salary: "", equity: "", start_date: null, benefits_score: 0, score_salary: 0,
  score_growth: 0, score_culture: 0, score_location: 0,
  activity: new Date(Date.now() - i * 86400000).toISOString(), stage_history: [], page_id: PAGE,
});

(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const c = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await c.route(u => !!M[u.href.split("?")[0]], r => r.fulfill({ status: 200,
    contentType: "application/javascript", body: fs.readFileSync(path.join(CACHE, M[r.request().url().split("?")[0]])) }));
  await c.route("https://stub.supabase.co/**", rt => {
    const u = rt.request().url(), m = rt.request().method();
    const j = o => rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(o) });
    if (u.includes("/auth/v1/user")) return j(USER);
    if (u.includes("/auth/v1/")) return j({ user: USER });
    if (u.includes("tracker_pages")) return j(m === "GET" ? [
      { id: PAGE, name: "Applications", sort_order: 0, user_id: UID },
      { id: "bbbbbbbb-0000-4000-8000-000000000002", name: "Internships", sort_order: 1, user_id: UID }] : []);
    if (u.includes("applications")) return j(m === "GET" ? rows : []);
    return j([]);
  });
  await c.addInitScript(() => {
    localStorage.setItem("tracker.config", JSON.stringify({ url: "https://stub.supabase.co", key: "x".repeat(40) }));
    localStorage.setItem("sb-stub-auth-token", JSON.stringify({ access_token: "s", token_type: "bearer",
      expires_in: 86400, expires_at: Math.floor(Date.now()/1000)+86400, refresh_token: "s",
      user: { id: "00000000-0000-4000-8000-000000000001", email: "t@e.com", aud: "authenticated",
        role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } }));
  });
  const p = await c.newPage();
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  const t0 = Date.now();
  await p.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "commit" });
  await p.waitForSelector(".tk-grid .tk-rowcard", { timeout: 25000 });
  const boot = Date.now() - t0;
  await p.waitForTimeout(900);

  /* Instrument: count geometry reads and transform writes from here on. */
  await p.evaluate(INSTRUMENT);
  if (process.env.THROTTLE) {
    const cdp = await p.context().newCDPSession(p);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.THROTTLE) });
  }
  const reset = () => p.evaluate(() => { window.__m.rect = 0; window.__m.xform = 0; window.__m.frames = []; window.__m.trans = 0; });
  const read = () => p.evaluate(() => {
    const f = window.__m.frames.slice().sort((a,b)=>a-b);
    return { rect: window.__m.rect, xform: window.__m.xform, trans: window.__m.trans,
      p90: f.length ? f[Math.floor(f.length*0.9)] : 0,
      dropped: f.filter(x => x > 33).length, frames: f.length };
  });


  const shown = await p.evaluate(() => document.querySelectorAll("[data-row-card]").length);
  console.log(`rows ${N} · boot ${boot}ms · js faults ${errs.length}` +
    (process.env.THROTTLE ? ` · CPU throttle ${process.env.THROTTLE}x` : ""));
  console.log("");

  const report = (label, r) => console.log("      " + label.padEnd(20) +
    "layout reads " + String(r.rect).padStart(4) +
    "   FLIP writes " + String(r.xform).padStart(4) +
    "   p90 " + r.p90.toFixed(1) + "ms   dropped " + r.dropped + "/" + r.frames);

  /* 1. committing a cell edit — not a reorder */
  await reset();
  await p.evaluate(() => { const b = document.querySelector('.tk-grid .tk-rowcard button.tk-cell'); if (b) b.click(); });
  await p.waitForTimeout(200);
  await p.keyboard.type("Northwind Trading Group", { delay: 20 });
  const typing = await read();
  await p.evaluate(() => { const t = document.querySelector('.tk-grid textarea.tk-edit'); if (t) t.blur(); });
  await p.waitForTimeout(700);
  let r = await read();
  t("typing in a cell does not re-render the grid", typing.rect === 0, "layout reads " + typing.rect);
  t("committing a cell edit animates NO rows", r.xform === 0, "FLIP writes " + r.xform);
  report("edit commit", r);

  /* 2. opening and closing a drawer — not a reorder */
  await reset();
  for (let i = 0; i < 2; i++) {
    await p.evaluate(() => { const b = document.querySelector('.tk-grid .tk-rowcard button[aria-expanded]'); if (b) b.click(); });
    await p.waitForTimeout(350);
  }
  r = await read();
  t("opening a drawer animates NO rows", r.xform === 0, "FLIP writes " + r.xform);
  report("drawer toggle", r);

  /* 3. scrolling */
  await reset();
  for (let i = 0; i < 20; i++) { await p.mouse.wheel(0, 120); await p.waitForTimeout(16); }
  await p.waitForTimeout(300);
  r = await read();
  t("scrolling costs no layout reads and no animation", r.rect === 0 && r.xform === 0,
    "reads " + r.rect + ", FLIP " + r.xform);
  report("scroll", r);

  /* 4. a REAL reorder still animates — the gate must not have disabled FLIP */
  await reset();
  /* Real key events, not synthetic ones: React listens at the root through
     its own event system, and a hand-built KeyboardEvent does not carry the
     properties its handler reads. */
  const moved = await p.evaluate(() => {
    const grip = document.querySelector(".tk-grid .tk-drag");
    if (!grip) return false;
    grip.focus();
    return true;
  });
  if (moved) {
    await p.keyboard.press("Space");
    await p.waitForTimeout(150);
    await p.keyboard.press("ArrowDown");
  }
  await p.waitForTimeout(600);
  r = await read();
  t("a genuine reorder DOES animate", !moved || r.xform > 0, "FLIP writes " + r.xform);
  report("keyboard reorder", r);

  t("no JS faults", errs.length === 0, errs[0]);

  await b.close();
  const bad = out.filter((x) => !x).length;
  console.log("\n" + (bad ? "FAIL" : "PASS") + " — " + (out.length - bad) + "/" + out.length);
  process.exit(bad ? 1 : 0);
})();
