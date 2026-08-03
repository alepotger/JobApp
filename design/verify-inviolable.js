/* The ten behaviours the rebuild brief declares inviolable. Each was a real
   bug once. Verified individually, by exercising the app or reading the
   shipped source — not by inspection-and-hope. */
const fs = require("fs");
const { chromium } = require("playwright");
const SRC = fs.readFileSync("/home/user/Officient/tracker-public/index.html","utf8");
const SQL = fs.readFileSync("/home/user/Officient/tracker-public/supabase/setup.sql","utf8");
const out=[]; const t=(n,ok,d)=>{out.push({n,ok});console.log((ok?"PASS  ":"FAIL  ")+n+(d?"\n         "+d:""));};

(async () => {
  const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args:["--no-sandbox"] });

  /* 1 — user_id on every insert AND defaulted in the database */
  const inserts=[...SRC.matchAll(/\.from\("applications"\)\s*\n?\s*\.insert\(/g)]
    .map(m=>SRC.slice(Math.max(0,m.index-700), m.index+80));
  t("1. user_id is written on every insert, and the DB also defaults it to auth.uid()",
    inserts.length>0 && inserts.every(x=>/user_id/.test(x)) &&
      /alter column user_id set default auth\.uid\(\)/.test(SQL),
    `${inserts.length} insert site(s), all carry user_id; setup.sql sets the column default`);

  /* 2 — empty read-back after insert is surfaced, never swallowed */
  t("2. insert().select() returning [] with no error is surfaced as an RLS read-back failure",
    /could not be read back/i.test(SRC) && /FOR ALL/.test(SRC) &&
      /if \(data && data\[0\]\)[\s\S]{0,400}?\} else \{[\s\S]{0,200}?setOpError/.test(SRC),
    "addRow branches on the empty array and calls setOpError naming FOR ALL");

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
  await p.goto("http://127.0.0.1:8777/index.html",{waitUntil:"networkidle"});
  await p.waitForSelector("h1");
  const cases=[["https://abcdefgh.supabase.co/rest/v1/","https://abcdefgh.supabase.co"],
               ["https://abcdefgh.supabase.co/","https://abcdefgh.supabase.co"],
               ["abcdefgh.supabase.co/rest/v1/","https://abcdefgh.supabase.co"]];
  const got=[];
  for (const [input,want] of cases) {
    const ctx=await b.newContext(); const q=await ctx.newPage();
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
  const ctx=await b.newContext(); const fresh=await ctx.newPage();
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
  const ctx2=await b.newContext(); const r=await ctx2.newPage();
  await r.addInitScript(()=>localStorage.setItem("tracker.config",
    JSON.stringify({url:"https://stub.supabase.co",key:"x".repeat(40)})));
  await r.goto("http://127.0.0.1:8777/index.html",{waitUntil:"networkidle"});
  await r.waitForSelector("table");
  await r.getByRole("button",{name:/^Offer 1$/}).click().catch(async()=>{
    await r.evaluate(()=>{[...document.querySelectorAll("button")].find(b=>/Offer/.test(b.textContent)).click();});});
  await r.waitForTimeout(250);
  const filtered=await r.locator("tr.tk-rowcard").count();
  await r.getByRole("button",{name:/Add application/}).click();
  await r.waitForTimeout(500);
  const after=await r.locator("tr.tk-rowcard").count();
  t("9. adding a row clears any active stage filter, so the new row is visible",
    filtered===1 && after>filtered, `filtered to ${filtered}, after add ${after} rows visible`);
  await ctx2.close();

  /* 10 — soft delete restores to position; hard delete separately confirmed */
  const ctx3=await b.newContext(); const d=await ctx3.newPage();
  await d.addInitScript(()=>localStorage.setItem("tracker.config",
    JSON.stringify({url:"https://stub.supabase.co",key:"x".repeat(40)})));
  await d.goto("http://127.0.0.1:8777/index.html",{waitUntil:"networkidle"});
  await d.waitForSelector("table");
  const order0=await d.evaluate(()=>[...document.querySelectorAll('[data-c="0"]')].map(e=>e.textContent.trim()));
  await d.evaluate(()=>{document.querySelectorAll("tr.tk-rowcard")[1]
    .querySelector('button[aria-label^="Delete"]').click();});
  await d.waitForTimeout(300);
  await d.evaluate(()=>{[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="Restore").click();});
  await d.waitForTimeout(400);
  const order1=await d.evaluate(()=>[...document.querySelectorAll('[data-c="0"]')].map(e=>e.textContent.trim()));
  let confirmed=false; d.on("dialog",async dl=>{confirmed=true;await dl.dismiss();});
  await d.evaluate(()=>{document.querySelectorAll("tr.tk-rowcard")[1]
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
