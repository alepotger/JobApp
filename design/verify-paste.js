/* Drives paste-to-create in a real browser against a stub PostgREST.
 *
 *   node verify-paste.js
 *
 * The parser has its own suite (supabase/functions/_test/parser-suite.js) and
 * that is where extraction accuracy is measured. This harness exists for the
 * half a pure function cannot answer: does the dialog open, does a paste event
 * actually parse, does the review step show provenance for a guess and a
 * "not found" for a blank, does the duplicate warning fire, does Escape close
 * without creating anything, and — the one that matters most — does Confirm
 * insert exactly the row the review step was showing.
 *
 * CDN_CACHE=/path/to/dir routes the pinned CDN scripts at a local copy, so
 * this runs on a machine with no route to unpkg.
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
const USER = { id: UID, email: "t@e.com", aud: "authenticated", role: "authenticated" };
const PAGE = "aaaaaaaa-0000-4000-8000-000000000001";

const POSTING = `Skip to main content
LinkedIn
Sign in
Investment Analyst
Bloomberg · London, United Kingdom
Hybrid
3 weeks ago · 47 applicants
Easy Apply
About the job
Bloomberg is looking for an Investment Analyst to join the EMEA equities desk.
Write to careers@bloomberg.example.com to apply.
https://boards.greenhouse.io/bloomberg/jobs/771`;

const out = [];
const t = (n, ok, d) => {
  out.push(ok);
  console.log((ok ? "PASS  " : "FAIL  ") + n + (d ? "  — " + d : ""));
};

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
  const server = serve(8779);
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium",
    args: ["--no-sandbox"],
  });

  const inserts = [];
  const existing = [{
    id: "row-1", user_id: UID, company: "Bloomberg L.P.", role_title: "Equity Research",
    location: "London", status: "applied", replies: "", next_steps: "", notes: "",
    sort_order: 0, deleted: false, contact_email: "", salary: "", equity: "",
    start_date: null, benefits_score: 0, score_salary: 0, score_growth: 0,
    score_culture: 0, score_location: 0, activity: new Date().toISOString(),
    stage_history: [], page_id: PAGE,
  }];

  async function makeContext() {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    if (CACHE) {
      await ctx.route((u) => !!CDN[u.href.split("?")[0]], (r) =>
        r.fulfill({
          status: 200, contentType: "application/javascript",
          body: fs.readFileSync(path.join(CACHE, CDN[r.request().url().split("?")[0]])),
        })
      );
    }
    await ctx.route("https://stub.supabase.co/**", async (route) => {
      const q = route.request(), u = q.url(), m = q.method();
      const j = (o) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(o) });
      if (u.includes("/auth/v1/user")) return j(USER);
      if (u.includes("/auth/v1/")) return j({ user: USER });
      if (u.includes("/rest/v1/tracker_pages")) {
        return j(m === "GET" ? [{ id: PAGE, name: "Applications", sort_order: 0, user_id: UID }] : []);
      }
      if (u.includes("/rest/v1/applications")) {
        if (m === "GET") return j(existing);
        if (m === "POST") {
          const body = JSON.parse(q.postData() || "{}");
          inserts.push(body);
          return j([Object.assign({}, existing[0], body, { id: "new-" + inserts.length })]);
        }
        if (m === "PATCH") return j([existing[0]]);
      }
      return j([]);
    });
    await ctx.addInitScript(() => {
      localStorage.setItem("tracker.config", JSON.stringify({ url: "https://stub.supabase.co", key: "x".repeat(40) }));
      localStorage.setItem("sb-stub-auth-token", JSON.stringify({
        access_token: "s", token_type: "bearer", expires_in: 86400,
        expires_at: Math.floor(Date.now() / 1000) + 86400, refresh_token: "s",
        user: { id: "00000000-0000-4000-8000-000000000001", email: "t@e.com", aud: "authenticated",
          role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
      }));
    });
    return ctx;
  }

  const ctx = await makeContext();
  const pg = await ctx.newPage();
  const errors = [];
  pg.on("pageerror", (e) => errors.push(e.message));
  await pg.goto("http://127.0.0.1:8779/index.html", { waitUntil: "networkidle" });
  await pg.waitForSelector(".tk-grid", { timeout: 15000 });
  await pg.waitForTimeout(400);

  t("the page compiles and renders with no JS faults", errors.length === 0, errors[0]);

  /* ---- entry point ---- */
  const trigger = pg.locator('button[title*="Paste a job description"]');
  t("a Paste control sits in the header", (await trigger.count()) === 1);

  /* "Secondary" here means one specific thing: no accent fill. Resolve the
     accent token through a probe element so the comparison is against the
     browser's own serialisation rather than a guess at the colour format. */
  const filled = await pg.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = "var(--accent)";
    document.body.appendChild(probe);
    const accent = getComputedStyle(probe).backgroundColor;
    probe.remove();
    const bar = document.querySelector(".tk-headbar");
    const buttons = [].slice.call(bar.querySelectorAll("button"));
    return {
      accent: accent,
      filled: buttons.filter((b) => getComputedStyle(b).backgroundColor === accent).length,
      total: buttons.length,
    };
  });
  t("exactly one accent-filled control remains in the header",
    filled.filled === 1, JSON.stringify(filled));

  /* ---- open, and paste ---- */
  await trigger.click();
  await pg.waitForSelector('[role="dialog"]');
  t("the dialog is modal and labelled", await pg.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return d.getAttribute("aria-modal") === "true" && !!document.getElementById(d.getAttribute("aria-labelledby"));
  }));
  t("focus lands in the textarea on open",
    await pg.evaluate(() => document.activeElement && document.activeElement.classList.contains("tk-pastebox")));

  /* A real paste: write the clipboard, then fire ctrl+V, so the onPaste path
     is genuinely exercised rather than simulated by typing. */
  await pg.evaluate(async (text) => { await navigator.clipboard.writeText(text); }, POSTING).catch(() => {});
  let usedClipboard = true;
  try {
    await pg.focus(".tk-pastebox");
    await pg.keyboard.press("ControlOrMeta+V");
    await pg.waitForTimeout(250);
    const v = await pg.inputValue(".tk-pastebox");
    if (!v) throw new Error("empty");
  } catch (e) {
    usedClipboard = false;
    await pg.evaluate((text) => {
      const ta = document.querySelector(".tk-pastebox");
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      setter.call(ta, text);
      ta.dispatchEvent(new Event("paste", { bubbles: true }));
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }, POSTING);
    await pg.waitForTimeout(400);
  }
  console.log("      (paste delivered via " + (usedClipboard ? "the real clipboard" : "a synthetic paste event") + ")");

  const review = async () => pg.evaluate(() => {
    const labels = [].slice.call(document.querySelectorAll('[role="dialog"] label'));
    const o = {};
    for (const l of labels) {
      const input = l.querySelector("input");
      if (!input) continue;
      const name = l.querySelector("span") ? l.querySelector("span").textContent.trim() : "";
      const why = l.querySelector(".tk-guess");
      o[name] = { value: input.value, why: why ? why.textContent.trim() : null,
        dashed: getComputedStyle(input).borderStyle === "dashed" };
    }
    return o;
  });

  let r = await review();
  t("parsing happened on paste with no button press", !!r.Role && r.Role.value.length > 0);

  /* "No network calls of any kind" is a stated constraint of the feature, and
     the kind that rots quietly — one convenience fetch added later would not
     show up in any other check here. Counted from before the paste to after
     the parse, across every request type the page can make. */
  const traffic = [];
  const watch = (req) => traffic.push(req.url());
  pg.on("request", watch);
  await pg.evaluate((text) => {
    const ta = document.querySelector(".tk-pastebox");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    setter.call(ta, text + "\nExtra line to force a re-parse.");
    ta.dispatchEvent(new Event("paste", { bubbles: true }));
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }, POSTING);
  await pg.waitForTimeout(600);
  pg.off("request", watch);
  t("parsing makes no network request of any kind", traffic.length === 0, traffic.join(" "));
  t("role extracted", r.Role && r.Role.value === "Investment Analyst", r.Role && r.Role.value);
  t("company extracted", r.Company && r.Company.value === "Bloomberg", r.Company && r.Company.value);
  t("location extracted", r.Location && r.Location.value === "London (Hybrid)", r.Location && r.Location.value);
  t("contact email extracted", r["Contact email"] && r["Contact email"].value === "careers@bloomberg.example.com");
  t("source link extracted", r["Source link"] && /greenhouse/.test(r["Source link"].value));

  t("a low-confidence guess names the rule that produced it",
    Object.keys(r).some((k) => r[k].why && /Guessed from/.test(r[k].why)),
    JSON.stringify(Object.keys(r).map((k) => k + ":" + r[k].why)));
  t("a high-confidence extraction carries no caption",
    r["Contact email"] && r["Contact email"].why === null);

  const src = await pg.evaluate(() => {
    const el = document.querySelector(".tk-pastesrc");
    return el ? el.textContent : null;
  });
  t("the pasted source stays visible during review", !!src && src.includes("EMEA equities desk"));

  /* ---- duplicate ---- */
  const dupe = await pg.evaluate(() => {
    const el = document.querySelector(".tk-dupe");
    return el ? el.textContent.replace(/\s+/g, " ").trim() : null;
  });
  t("a duplicate company warns during review, naming the match",
    !!dupe && /Bloomberg L\.P\./.test(dupe), dupe);
  t("the duplicate warning does not block creation",
    await pg.evaluate(() => !document.querySelector('[role="dialog"] button:last-of-type').disabled));

  /* ---- a field the parser could not find ---- */
  await pg.evaluate(() => {
    const ta = document.querySelector(".tk-pastebox");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    setter.call(ta, "Barista wanted\nThe Daily Grind");
    ta.dispatchEvent(new Event("paste", { bubbles: true }));
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await pg.waitForTimeout(300);
  r = await review();
  t("a field with nothing to find says so rather than leaving a blank",
    r.Location && r.Location.why === "Not found — add it if you want it", r.Location && r.Location.why);
  t("a not-found field is distinguishable without colour (dashed edge)",
    r.Location && r.Location.dashed === true);

  /* ---- an edit survives a re-parse ---- */
  await pg.evaluate(() => {
    const inputs = [].slice.call(document.querySelectorAll('[role="dialog"] input'));
    const loc = inputs[2];
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(loc, "Shoreditch");
    loc.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await pg.evaluate(() => {
    const ta = document.querySelector(".tk-pastebox");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    setter.call(ta, "Barista wanted\nThe Daily Grind\nBased in Leeds");
    ta.dispatchEvent(new Event("paste", { bubbles: true }));
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await pg.waitForTimeout(300);
  r = await review();
  t("a hand-corrected field is not overwritten by a later parse",
    r.Location && r.Location.value === "Shoreditch", r.Location && r.Location.value);

  /* ---- Escape discards ---- */
  await pg.keyboard.press("Escape");
  await pg.waitForTimeout(200);
  t("Escape closes the dialog", (await pg.locator('[role="dialog"]').count()) === 0);
  t("cancelling creates nothing", inserts.length === 0, JSON.stringify(inserts));
  t("focus returns to the control that opened it",
    await pg.evaluate(() => document.activeElement && /Paste/.test(document.activeElement.textContent || "")));

  /* ---- create for real ---- */
  await trigger.click();
  await pg.waitForSelector('[role="dialog"]');
  await pg.evaluate((text) => {
    const ta = document.querySelector(".tk-pastebox");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    setter.call(ta, text);
    ta.dispatchEvent(new Event("paste", { bubbles: true }));
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }, POSTING);
  await pg.waitForTimeout(300);

  /* Tab cycle must stay inside the dialog. */
  const trapped = await pg.evaluate(async () => {
    const d = document.querySelector('[role="dialog"]');
    const nodes = [].slice.call(d.querySelectorAll("button,input,textarea")).filter((n) => n.offsetParent);
    nodes[nodes.length - 1].focus();
    return d.contains(document.activeElement);
  });
  t("focus is confined to the dialog", trapped);

  await pg.locator('[role="dialog"] button', { hasText: "Create application" }).click();
  await pg.waitForTimeout(600);

  t("confirming creates exactly one row", inserts.length === 1, JSON.stringify(inserts.length));
  const ins = inserts[0] || {};
  t("the created row carries the reviewed values",
    ins.company === "Bloomberg" && ins.role_title === "Investment Analyst" && ins.location === "London (Hybrid)",
    JSON.stringify({ c: ins.company, r: ins.role_title, l: ins.location }));
  t("the contact email is written to its own column", ins.contact_email === "careers@bloomberg.example.com", ins.contact_email);
  t("the source URL is written into notes, prefixed and on its own line",
    typeof ins.notes === "string" && /^Source: https:\/\/boards\.greenhouse\.io/.test(ins.notes), ins.notes);
  t("the row lands on the current page", ins.page_id === PAGE, ins.page_id);
  t("the row starts in the default stage", ins.status === "to-apply", ins.status);
  t("the dialog closes after creating", (await pg.locator('[role="dialog"]').count()) === 0);

  /* ---- shape and elevation ---- */
  await trigger.click();
  await pg.waitForSelector('[role="dialog"]');
  const shape = await pg.evaluate(() => {
    const card = document.querySelector(".tk-pastecard");
    const cs = getComputedStyle(card);
    let clipped = null;
    for (let el = card.parentElement; el && el !== document.body; el = el.parentElement) {
      const s = getComputedStyle(el);
      if (s.overflow !== "visible" && s.overflow !== "" && s.overflowY !== "auto") clipped = el.className;
    }
    return {
      radius: cs.borderTopLeftRadius, shadow: cs.boxShadow,
      inset: /inset/.test(cs.boxShadow), bg: cs.backgroundColor, clipped: clipped,
    };
  });
  t("one element owns background, radius and shadow together",
    shape.radius !== "0px" && shape.shadow !== "none" && shape.bg !== "rgba(0, 0, 0, 0)",
    JSON.stringify(shape));
  t("the hairline is an inset ring on that same element, not a parent border", shape.inset);
  t("no clipping ancestor eats the bottom-edge shadow", shape.clipped === null, shape.clipped);

  /* ---- phone ---- */
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  if (CACHE) {
    await mob.route((u) => !!CDN[u.href.split("?")[0]], (rt) =>
      rt.fulfill({ status: 200, contentType: "application/javascript",
        body: fs.readFileSync(path.join(CACHE, CDN[rt.request().url().split("?")[0]])) }));
  }
  await mob.route("https://stub.supabase.co/**", async (route) => {
    const q = route.request(), u = q.url(), m = q.method();
    const j = (o) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(o) });
    if (u.includes("/auth/v1/user")) return j(USER);
    if (u.includes("/auth/v1/")) return j({ user: USER });
    if (u.includes("/rest/v1/tracker_pages")) return j(m === "GET" ? [{ id: PAGE, name: "Applications", sort_order: 0, user_id: UID }] : []);
    if (u.includes("/rest/v1/applications")) return j(m === "GET" ? existing : []);
    return j([]);
  });
  await mob.addInitScript(() => {
    localStorage.setItem("tracker.config", JSON.stringify({ url: "https://stub.supabase.co", key: "x".repeat(40) }));
    localStorage.setItem("sb-stub-auth-token", JSON.stringify({
      access_token: "s", token_type: "bearer", expires_in: 86400,
      expires_at: Math.floor(Date.now() / 1000) + 86400, refresh_token: "s",
      user: { id: "00000000-0000-4000-8000-000000000001", email: "t@e.com", aud: "authenticated",
        role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
    }));
  });
  const mp = await mob.newPage();
  const mErrors = [];
  mp.on("pageerror", (e) => mErrors.push(e.message));
  await mp.goto("http://127.0.0.1:8779/index.html", { waitUntil: "networkidle" });
  await mp.waitForTimeout(1200);
  await mp.locator('button[title*="Paste a job description"]').first().click();
  await mp.waitForSelector('[role="dialog"]');
  await mp.evaluate((text) => {
    const ta = document.querySelector(".tk-pastebox");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    setter.call(ta, text);
    ta.dispatchEvent(new Event("paste", { bubbles: true }));
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }, POSTING);
  await mp.waitForTimeout(400);

  const phone = await mp.evaluate(() => {
    const card = document.querySelector(".tk-pastecard");
    const ta = document.querySelector(".tk-pastebox");
    const inputs = [].slice.call(document.querySelectorAll('[role="dialog"] input'));
    const r = card.getBoundingClientRect();
    return {
      cardW: Math.round(r.width), vw: window.innerWidth,
      taW: Math.round(ta.getBoundingClientRect().width),
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
      smallestTap: Math.min.apply(null, [].slice.call(document.querySelectorAll('[role="dialog"] button'))
        .map((b) => Math.round(b.getBoundingClientRect().height))),
      inputsFit: inputs.every((i) => i.getBoundingClientRect().width <= window.innerWidth),
      fontPx: parseFloat(getComputedStyle(ta).fontSize),
    };
  });
  t("the phone dialog fills the viewport rather than shrinking the desktop card",
    Math.abs(phone.cardW - phone.vw) <= 1, JSON.stringify(phone));
  t("nothing overflows horizontally at phone width", phone.overflowX === false);
  t("every review field fits the screen", phone.inputsFit);
  t("the textarea's type is at least 16px, so iOS does not zoom on focus",
    phone.fontPx >= 16, phone.fontPx + "px");
  t("dialog buttons keep a usable tap height", phone.smallestTap >= 32, phone.smallestTap + "px");
  t("no JS faults at phone width", mErrors.length === 0, mErrors[0]);

  await browser.close();
  server.close();
  const bad = out.filter((x) => !x).length;
  console.log("\n" + (bad ? "FAIL" : "PASS") + " — " + (out.length - bad) + "/" + out.length);
  process.exit(bad ? 1 : 0);
})();
