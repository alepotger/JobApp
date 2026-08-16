/* The ten behaviours the rebuild brief declares inviolable. Each was a real
   bug once. Verified individually, by exercising the app or reading the
   shipped source — not by inspection-and-hope. */
const fs = require("fs");
const { chromium } = require("playwright");
const SRC = fs.readFileSync("/home/user/Officient/tracker-public/index.html","utf8");
const SQL = fs.readFileSync("/home/user/Officient/tracker-public/supabase/setup.sql","utf8");
const out=[]; const t=(n,ok,d)=>{out.push({n,ok});console.log((ok?"PASS  ":"FAIL  ")+n+(d?"\n         "+d:""));};

(async () => {
  const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium", args:["--no-sandbox"] });

  /* The page pins four CDN scripts. Where there is no outbound network, serve
     them from a local cache instead of waiting 30s for a selector that can
     never appear. CDN_CACHE should hold react.js, react-dom.js, babel.js and
     supabase.js. */
  const CACHE = process.env.CDN_CACHE;
  const CDN_MAP = {
    "https://unpkg.com/react@18.3.1/umd/react.production.min.js": "react.js",
    "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js": "react-dom.js",
    "https://unpkg.com/@babel/standalone@7.29.8/babel.min.js": "babel.js",
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/dist/umd/supabase.js": "supabase.js",
  };
  const routeCdn = async (target) => {
    if (!CACHE) return;
    await target.route((u) => !!CDN_MAP[u.href.split("?")[0]], (r) =>
      r.fulfill({ status: 200, contentType: "application/javascript",
        body: fs.readFileSync(`${CACHE}/${CDN_MAP[r.request().url().split("?")[0]]}`) }));
  };

  /* Checks 9 and 10 exercise the running grid, and the grid needs a signed-in
     session and a database behind it. These contexts used to set
     tracker.config and nothing else — so the app did exactly the right thing,
     showed the sign-in screen, and the harness sat waiting out a 30s timeout
     for a .tk-grid that could never appear. Two of the ten behaviours were
     not being verified at all, and the run died before reporting it.

     The store below is deliberately tiny but real: it holds inserted rows, so
     the seeding path runs, PATCH mutates what GET returns, and the filter and
     soft-delete checks operate on state that actually changes. */
  const UID = "00000000-0000-4000-8000-000000000001";
  const PAGE_ID = "aaaaaaaa-0000-4000-8000-000000000001";
  const USER = { id: UID, email: "t@e.com", aud: "authenticated", role: "authenticated",
    app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };

  const signedIn = async (ctx) => {
    const rows = []; let n = 0;
    await ctx.route("https://stub.supabase.co/**", async (route) => {
      const q = route.request(), u = q.url(), m = q.method();
      const j = (o) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(o) });
      if (u.includes("/auth/v1/user")) return j(USER);
      if (u.includes("/auth/v1/")) return j({ user: USER });
      if (u.includes("/rest/v1/tracker_pages"))
        return j(m === "GET" ? [{ id: PAGE_ID, name: "Applications", sort_order: 0, user_id: UID }] : []);
      if (u.includes("/rest/v1/applications")) {
        if (m === "GET") return j(rows);
        if (m === "POST") {
          const body = JSON.parse(q.postData() || "{}");
          const made = (Array.isArray(body) ? body : [body]).map((r) => Object.assign({
            id: "r" + (++n), company: "", role_title: "", location: "", status: "to-apply",
            replies: "", next_steps: "", notes: "", contact_email: "", salary: "", equity: "",
            start_date: null, benefits_score: 0, score_salary: 0, score_growth: 0,
            score_culture: 0, score_location: 0, deleted: false, sort_order: 0,
            activity: new Date().toISOString(), stage_history: [], page_id: null,
          }, r));
          made.forEach((r) => rows.push(r));
          return j(made);
        }
        if (m === "PATCH") {
          const body = JSON.parse(q.postData() || "{}");
          const id = /id=eq\.([^&]+)/.exec(u);
          const hit = id ? rows.filter((r) => r.id === decodeURIComponent(id[1])) : [];
          hit.forEach((r) => Object.assign(r, body));
          return j(hit);
        }
        if (m === "DELETE") {
          const id = /id=eq\.([^&]+)/.exec(u);
          if (id) {
            const i = rows.findIndex((r) => r.id === decodeURIComponent(id[1]));
            if (i >= 0) rows.splice(i, 1);
          }
          return j([]);
        }
      }
      return j([]);
    });
    await ctx.addInitScript(() => {
      localStorage.setItem("tracker.config",
        JSON.stringify({ url: "https://stub.supabase.co", key: "x".repeat(40) }));
      localStorage.setItem("sb-stub-auth-token", JSON.stringify({
        access_token: "s", token_type: "bearer", expires_in: 86400,
        expires_at: Math.floor(Date.now() / 1000) + 86400, refresh_token: "s",
        user: { id: "00000000-0000-4000-8000-000000000001", email: "t@e.com",
          aud: "authenticated", role: "authenticated", app_metadata: {},
          user_metadata: {}, created_at: new Date().toISOString() },
      }));
    });
  };

  /* 1 — user_id on every insert AND defaulted in the database */
  const inserts=[...SRC.matchAll(/\.from\("applications"\)\s*\n?\s*\.insert\(/g)]
    .map(m=>SRC.slice(Math.max(0,m.index-700), m.index+80));
  t("1. user_id is written on every insert, and the DB also defaults it to auth.uid()",
    inserts.length>0 && inserts.every(x=>/user_id/.test(x)) &&
      /alter column user_id set default auth\.uid\(\)/.test(SQL),
    `${inserts.length} insert site(s), all carry user_id; setup.sql sets the column default`);

  /* 2 — empty read-back after insert is surfaced, never swallowed */
  /* Was a fixed-width regex over addRow, which broke the moment a comment grew
     inside the branch — a harness that fails on prose is a harness nobody
     trusts. Now: locate each function that inserts and reads back, and require
     each to guard the empty array and name FOR ALL. Adding a third such site
     without the guard fails this. */
  const readBackSites = ["addRow", "createPage"].map((fn) => {
    const at = SRC.indexOf(`const ${fn} = async`);
    if (at === -1) return { fn, found: false };
    const body = SRC.slice(at, at + 2500);
    return {
      fn,
      found: true,
      guarded:
        /\.insert\(/.test(body) &&
        /\.select\(\)/.test(body) &&
        /if \(data && data\[0\]\)/.test(body) &&
        /else \{[\s\S]{0,400}?setOpError/.test(body) &&
        /could not be read back/i.test(body) &&
        /FOR ALL/.test(body),
    };
  });
  t("2. insert().select() returning [] with no error is surfaced as an RLS read-back failure",
    readBackSites.every((x) => x.found && x.guarded),
    readBackSites.map((x) => `${x.fn}: ${x.found ? (x.guarded ? "guarded" : "NOT guarded") : "missing"}`).join("; "));

  /* 3 — no discarded Supabase errors */
  const calls=[...SRC.matchAll(/(?:(?:const|let)\s*)?\(?\{[^}]*\}\s*=\s*await sb[\s\S]{0,300}?;|await sb[\s\S]{0,300}?;/g)].map(m=>m[0]);
  const risky=calls.filter(c=>/\.(insert|update|delete|select)\(/.test(c) && !/error/.test(c));
  t("3. every Supabase call captures error and displays it",
    risky.length===0, risky.length?risky[0].slice(0,120):`${calls.length} call sites, all destructure error`);

  /* 4 — both sign-in routes */
  t("4. sign-in offers magic link and six-digit OTP via verifyOtp",
    /signInWithOtp\(/.test(SRC) && /verifyOtp\(\{[\s\S]{0,120}?type: "email"/.test(SRC),
    "signInWithOtp + verifyOtp({email, token, type:'email'})");

  /* 5 — URL reduced to origin; exercised for real */
  const p = await b.newPage();
  await routeCdn(p);
  await p.goto("http://127.0.0.1:8777/index.html",{waitUntil:"networkidle"});
  await p.waitForSelector("h1");
  const cases=[["https://abcdefgh.supabase.co/rest/v1/","https://abcdefgh.supabase.co"],
               ["https://abcdefgh.supabase.co/","https://abcdefgh.supabase.co"],
               ["abcdefgh.supabase.co/rest/v1/","https://abcdefgh.supabase.co"]];
  const got=[];
  for (const [input,want] of cases) {
    const ctx=await b.newContext(); await routeCdn(ctx); const q=await ctx.newPage();
    await q.goto("http://127.0.0.1:8777/index.html",{waitUntil:"networkidle"});
    await q.waitForSelector("h1");
    await q.locator("input").nth(0).fill(input);
    await q.locator("input").nth(1).fill("sb_publishable_"+"a".repeat(30));
    await q.getByRole("button",{name:/^Connect$/}).click();
    await q.waitForTimeout(300);
    const stored=await q.evaluate(()=>{const r=localStorage.getItem("tracker.config");return r?JSON.parse(r).url:null;});
    got.push(stored===want); await ctx.close();
  }
  t("5. a pasted /rest/v1/ endpoint or trailing slash is reduced to its origin",
    got.every(Boolean), `3 inputs → origin: ${got.map(x=>x?"ok":"FAIL").join(", ")}`);

  /* 6 — no credentials anywhere; empty form on a clean browser */
  const ctx=await b.newContext(); await routeCdn(ctx); const fresh=await ctx.newPage();
  const reqs=[]; fresh.on("request",r=>reqs.push(r.url()));
  await fresh.goto("http://127.0.0.1:8777/index.html",{waitUntil:"networkidle"});
  await fresh.waitForSelector("h1"); await fresh.waitForTimeout(400);
  const clean=await fresh.evaluate(()=>({
    vals:[...document.querySelectorAll("input")].map(i=>i.value),
    stored:Object.keys(localStorage),
  }));
  t("6. no credentials are hardcoded, defaulted or injected; a clean browser gets an empty form",
    !/sb_publishable_[A-Za-z0-9_-]{8,}|eyJhbGciOi[A-Za-z0-9_-]{10,}|https:\/\/[a-z0-9]{15,}\.supabase\.co/.test(SRC) &&
      clean.vals.every(v=>v==="") && !clean.stored.includes("tracker.config") &&
      !reqs.some(u=>/supabase\.(co|com)/.test(u) && !/jsdelivr/.test(u)),
    `fields ${JSON.stringify(clean.vals)}, storage ${JSON.stringify(clean.stored)}, 0 supabase requests`);
  await ctx.close();

  /* 7 — storage keys carry no personal identifier */
  const keys=[...SRC.matchAll(/KEY = "([^"]+)"/g)].map(m=>m[1]);
  t("7. localStorage keys carry no personal identifier",
    keys.length>0 && keys.every(k=>/^tracker\.[a-zA-Z]+$/.test(k)), keys.join(", "));

  /* 8 — the generic seed set */
  const seeds=[...SRC.matchAll(/company: "(Example [A-Za-z]+)"/g)].map(m=>m[1]);
  t("8. seed rows are the generic Example Consulting / Studio / Foundation set",
    JSON.stringify(seeds)===JSON.stringify(["Example Consulting","Example Studio","Example Foundation"]),
    seeds.join(", "));

  /* 9 — adding a row clears an active stage filter (exercised) */
  const ctx2=await b.newContext(); await routeCdn(ctx2); await signedIn(ctx2); const r=await ctx2.newPage();
  await r.goto("http://127.0.0.1:8777/index.html",{waitUntil:"networkidle"});
  await r.waitForSelector(".tk-grid");
  /* Pick whichever stage chip actually holds exactly one row rather than
     naming one. The seed is applied/to-apply/interview and has no Offer, so
     the old /^Offer 1$/ target could never match — the check filtered to zero
     rows and then "passed the add" for the wrong reason. Deriving the target
     from the rendered counts keeps this honest when the seed changes. */
  const picked = await r.evaluate(() => {
    const chip = [].slice.call(document.querySelectorAll("button"))
      .find((b) => /^(To apply|Applied|Replied|Interview|Offer|Closed)\s*1$/.test(b.textContent.replace(/\s+/g, " ").trim()));
    if (!chip) return null;
    chip.click();
    return chip.textContent.replace(/\s+/g, " ").trim();
  });
  await r.waitForTimeout(250);
  const filtered=await r.locator(".tk-grid .tk-rowcard").count();
  await r.getByRole("button",{name:/Add application/}).click();
  await r.waitForTimeout(500);
  const after=await r.locator(".tk-grid .tk-rowcard").count();
  t("9. adding a row clears any active stage filter, so the new row is visible",
    picked!==null && filtered===1 && after>filtered,
    `filtered by "${picked}" to ${filtered}, after add ${after} rows visible`);
  await ctx2.close();

  /* 10 — soft delete restores to position; hard delete separately confirmed */
  const ctx3=await b.newContext(); await routeCdn(ctx3); await signedIn(ctx3); const d=await ctx3.newPage();
  await d.goto("http://127.0.0.1:8777/index.html",{waitUntil:"networkidle"});
  await d.waitForSelector(".tk-grid");
  const order0=await d.evaluate(()=>[...document.querySelectorAll('[data-c="0"]')].map(e=>e.textContent.trim()));
  await d.evaluate(()=>{document.querySelectorAll(".tk-grid .tk-rowcard")[1]
    .querySelector('button[aria-label^="Delete"]').click();});
  await d.waitForTimeout(300);
  await d.evaluate(()=>{[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="Restore").click();});
  await d.waitForTimeout(400);
  const order1=await d.evaluate(()=>[...document.querySelectorAll('[data-c="0"]')].map(e=>e.textContent.trim()));
  let confirmed=false; d.on("dialog",async dl=>{confirmed=true;await dl.dismiss();});
  await d.evaluate(()=>{document.querySelectorAll(".tk-grid .tk-rowcard")[1]
    .querySelector('button[aria-label^="Delete"]').click();});
  await d.waitForTimeout(200);
  await d.evaluate(()=>{const b=[...document.querySelectorAll("button")].find(x=>/Delete for good/.test(x.textContent));if(b)b.click();});
  await d.waitForTimeout(300);
  t("10. soft delete restores to its original position; hard delete is separately confirmed",
    JSON.stringify(order0)===JSON.stringify(order1) && confirmed,
    `order preserved: ${JSON.stringify(order0)===JSON.stringify(order1)}; confirm dialog shown: ${confirmed}`);
  await ctx3.close();

  await b.close();
  const bad=out.filter(x=>!x.ok);
  console.log("\n" + (out.length-bad.length) + "/" + out.length + " inviolable behaviours verified");
  process.exit(bad.length?1:0);
})();
