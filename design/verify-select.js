/* Multi-select and bulk move, driven in a real browser.
 *
 *   node verify-select.js
 *
 * The things worth proving are the ones that break quietly: that a modifier
 * click selects WITHOUT opening the cell editor underneath it, that a plain
 * click still edits, that the bulk move issues one write rather than one per
 * row, and that undo puts rows back where each of them came from rather than
 * dumping the lot on one page.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = path.join(__dirname, "../tracker-public");
const CACHE = process.env.CDN_CACHE || "";
const CDN = {
  "https://unpkg.com/react@18.3.1/umd/react.production.min.js": "react.js",
  "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js": "react-dom.js",
  "https://unpkg.com/@babel/standalone@7.29.8/babel.min.js": "babel.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/dist/umd/supabase.js": "supabase.js",
};
const UID = "00000000-0000-4000-8000-000000000001";
const USER = { id: UID, email: "t@e.com", aud: "authenticated", role: "authenticated",
  app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const P1 = "aaaaaaaa-0000-4000-8000-000000000001";
const P2 = "bbbbbbbb-0000-4000-8000-000000000002";
const P3 = "cccccccc-0000-4000-8000-000000000003";
const NAMES = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"];

const out = [];
const t = (n, ok, d) => { out.push(ok); console.log((ok ? "PASS  " : "FAIL  ") + n + (d ? "  — " + d : "")); };

function serve(port) {
  const s = http.createServer((req, res) => {
    const f = path.join(ROOT, req.url.split("?")[0] === "/" ? "/index.html" : req.url.split("?")[0]);
    fs.readFile(f, (e, b) => {
      if (e) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": f.endsWith(".html") ? "text/html" : "text/plain" });
      res.end(b);
    });
  });
  s.listen(port, "127.0.0.1");
  return s;
}

(async () => {
  const server = serve(8781);
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });

  const rows = NAMES.map((n, i) => ({
    id: "r" + i, user_id: UID, company: n, role_title: "Analyst", location: "London",
    status: "applied", replies: "", next_steps: "", notes: "", sort_order: i,
    deleted: false, contact_email: "", salary: "", equity: "", start_date: null,
    benefits_score: 0, score_salary: 0, score_growth: 0, score_culture: 0,
    score_location: 0, activity: new Date().toISOString(), stage_history: [],
    page_id: i < 4 ? P1 : P2,
  }));
  const patches = [];

  async function open(viewport) {
    const ctx = await browser.newContext({ viewport });
    if (CACHE) await ctx.route(u => !!CDN[u.href.split("?")[0]], r => r.fulfill({
      status: 200, contentType: "application/javascript",
      body: fs.readFileSync(path.join(CACHE, CDN[r.request().url().split("?")[0]])) }));
    await ctx.route("https://stub.supabase.co/**", async route => {
      const q = route.request(), u = q.url(), m = q.method();
      const j = o => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(o) });
      if (u.includes("/auth/v1/user")) return j(USER);
      if (u.includes("/auth/v1/")) return j({ user: USER });
      if (u.includes("tracker_pages")) return j(m === "GET" ? [
        { id: P1, name: "Applications", sort_order: 0, user_id: UID },
        { id: P2, name: "Internships", sort_order: 1, user_id: UID },
        { id: P3, name: "2027", sort_order: 2, user_id: UID }] : []);
      if (u.includes("applications")) {
        if (m === "GET") return j(rows);
        if (m === "PATCH") {
          const body = JSON.parse(q.postData() || "{}");
          patches.push({ url: decodeURIComponent(u), body });
          const ids = (decodeURIComponent(u).match(/id=in\.\(([^)]*)\)/) || [])[1];
          const list = ids ? ids.split(",") : (decodeURIComponent(u).match(/id=eq\.([^&]+)/) || [])[1];
          const touched = Array.isArray(list) ? list : (ids ? ids.split(",") : [list]);
          rows.forEach(r => { if (touched.indexOf(r.id) !== -1) Object.assign(r, body); });
          return j([]);
        }
      }
      return j([]);
    });
    await ctx.addInitScript(() => {
      localStorage.setItem("tracker.config", JSON.stringify({ url: "https://stub.supabase.co", key: "x".repeat(40) }));
      localStorage.setItem("sb-stub-auth-token", JSON.stringify({ access_token: "s", token_type: "bearer",
        expires_in: 86400, expires_at: Math.floor(Date.now()/1000)+86400, refresh_token: "s",
        user: { id: "00000000-0000-4000-8000-000000000001", email: "t@e.com", aud: "authenticated",
          role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } }));
    });
    const pg = await ctx.newPage();
    const errs = [];
    pg.on("pageerror", e => errs.push(e.message));
    await pg.goto("http://127.0.0.1:8781/index.html", { waitUntil: "commit" });
    return { ctx, pg, errs };
  }

  const { pg, errs } = await open({ width: 1440, height: 1000 });
  await pg.waitForSelector(".tk-grid .tk-rowcard", { timeout: 25000 });
  await pg.waitForTimeout(500);
  t("the page renders with no JS faults", errs.length === 0, errs[0]);

  const card = (name) => pg.locator(`.tk-grid .tk-rowcard`, { hasText: name }).first();
  const selectedIds = () => pg.evaluate(() =>
    [...document.querySelectorAll('.tk-grid .tk-rowcard[data-selected]')]
      .map(e => e.getAttribute("data-row-card")));
  const bar = () => pg.locator(".tk-selbar");

  /* ---- modifier click selects, and does NOT open the editor ---- */
  t("no selection bar before anything is selected", (await bar().count()) === 0);
  await card("Alpha").locator("button.tk-cell").first().click({ modifiers: ["ControlOrMeta"] });
  await pg.waitForTimeout(200);
  t("Cmd/Ctrl-click selects the row", (await selectedIds()).length === 1, JSON.stringify(await selectedIds()));
  t("...and does NOT open the cell editor underneath it",
    (await pg.locator(".tk-grid textarea.tk-edit").count()) === 0);
  t("the selection bar appears and counts", /1 application selected/.test(
    (await bar().innerText()).replace(/\s+/g, " ")), (await bar().innerText()).replace(/\s+/g," "));

  /* ---- selection is visible without relying on colour alone ---- */
  const ring = await pg.evaluate(() => {
    const el = document.querySelector('.tk-grid .tk-rowcard[data-selected]');
    return el ? getComputedStyle(el).boxShadow : null;
  });
  t("a selected row is marked by a thickened inset ring on the card itself",
    !!ring && /inset/.test(ring), ring);

  /* ---- shift extends a range ---- */
  await card("Delta").locator("button.tk-cell").first().click({ modifiers: ["Shift"] });
  await pg.waitForTimeout(200);
  let ids = await selectedIds();
  t("Shift-click extends the range from the last pick", ids.length === 4, JSON.stringify(ids));

  /* ---- modifier click again removes one ---- */
  await card("Bravo").locator("button.tk-cell").first().click({ modifiers: ["ControlOrMeta"] });
  await pg.waitForTimeout(200);
  ids = await selectedIds();
  t("Cmd/Ctrl-click on a selected row removes it", ids.length === 3 && ids.indexOf("r1") === -1, JSON.stringify(ids));

  /* ---- a plain click still edits: no mode was introduced ---- */
  await card("Charlie").locator("button.tk-cell").first().click();
  await pg.waitForTimeout(250);
  t("a plain click still opens the cell editor",
    (await pg.locator(".tk-grid textarea.tk-edit").count()) === 1);
  await pg.keyboard.press("Escape");
  await pg.waitForTimeout(150);

  /* ---- destinations are buttons, not a menu ---- */
  const dests = await pg.evaluate(() =>
    [...document.querySelectorAll(".tk-selbar .tk-selpage")].map(b => b.textContent.trim()));
  t("every other page is offered as its own button, not behind a dropdown",
    dests.length === 2 && dests.indexOf("Internships") !== -1 && dests.indexOf("2027") !== -1,
    JSON.stringify(dests));
  t("the page you are already on is not offered", dests.indexOf("Applications") === -1);

  /* ---- the move ---- */
  const before = await selectedIds();
  patches.length = 0;
  await pg.locator(".tk-selbar .tk-selpage", { hasText: "Internships" }).click();
  await pg.waitForTimeout(700);

  t("moving issues ONE write for the whole selection, not one per row",
    patches.length === 1, JSON.stringify(patches.map(p => p.url.split("?")[1])));
  t("...addressed with an id IN list", patches.length === 1 && /id=in\.\(/.test(patches[0].url),
    patches[0] && patches[0].url.split("?")[1]);
  t("...setting page_id to the destination",
    patches.length === 1 && patches[0].body.page_id === P2, JSON.stringify(patches[0] && patches[0].body));
  /* Four of the six fixtures start on this page, not six. */
  t("the moved rows leave the page you are looking at",
    (await pg.locator(".tk-grid .tk-rowcard").count()) === 4 - before.length,
    "rows left: " + (await pg.locator(".tk-grid .tk-rowcard").count()));
  t("the selection clears after the move", (await bar().count()) === 0);

  /* ---- one undo for the whole gesture, restoring each row's own origin ---- */
  const undo = pg.locator("button", { hasText: /^Undo$/ });
  t("a single undo is offered for the whole move", (await undo.count()) >= 1);
  patches.length = 0;
  if (await undo.count()) { await undo.first().click(); await pg.waitForTimeout(700); }
  t("undo returns the rows to the page they came from",
    (await pg.locator(".tk-grid .tk-rowcard").count()) === 4,
    "rows back: " + (await pg.locator(".tk-grid .tk-rowcard").count()));

  /* ---- Escape clears ---- */
  await card("Alpha").locator("button.tk-cell").first().click({ modifiers: ["ControlOrMeta"] });
  await pg.waitForTimeout(200);
  t("selected again, ready to cancel", (await bar().count()) === 1);
  await pg.keyboard.press("Escape");
  await pg.waitForTimeout(200);
  t("Escape clears the selection", (await bar().count()) === 0);

  /* ---- pages are visible rather than behind a control ---- */
  const tabs = await pg.evaluate(() =>
    [...document.querySelectorAll('[role="tab"]')]
      .filter(b => b.getBoundingClientRect().height > 0)
      .map(b => b.textContent.replace(/\s+/g," ").trim()));
  t("every page is on screen as a tab at desktop width", tabs.length === 3, JSON.stringify(tabs));
  t("no JS faults through the whole desktop run", errs.length === 0, errs[0]);

  /* ---- phone ---- */
  const m = await open({ width: 390, height: 844 });
  await m.pg.waitForSelector(".tk-mcard", { timeout: 25000 });
  await m.pg.waitForTimeout(400);
  /* VISIBLE tabs. Counting [role="tab"] alone passes on the old build too,
     where the strip is in the DOM behind display:none — the assertion has to
     be about what is on screen, which is the whole point of the change. */
  const phone = await m.pg.evaluate(() => ({
    tabs: [...document.querySelectorAll('[role="tab"]')]
      .filter(b => b.getBoundingClientRect().height > 0)
      .map(b => b.textContent.replace(/\s+/g," ").trim()),
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    headerH: Math.round(document.querySelector("header").getBoundingClientRect().height),
  }));
  t("the pages are on screen at phone width too, not behind a dropdown",
    phone.tabs.length === 3, JSON.stringify(phone.tabs));
  t("nothing overflows horizontally at phone width", phone.overflowX === false);
  t("no JS faults at phone width", m.errs.length === 0, m.errs[0]);
  console.log("      phone header height: " + phone.headerH + "px");

  await browser.close();
  server.close();
  const bad = out.filter(x => !x).length;
  console.log("\n" + (bad ? "FAIL" : "PASS") + " — " + (out.length - bad) + "/" + out.length);
  process.exit(bad ? 1 : 0);
})();
