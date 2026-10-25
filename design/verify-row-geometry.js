/* One height for every row, and everything in it on the centre line.
 *
 *   node verify-row-geometry.js        (CDN_CACHE=/dir to run offline)
 *
 * Row height used to be whatever the longest cell wrapped to: a five-row
 * sample measured 82, 145, 187, 166 and 82 pixels. Nothing lined up across
 * the grid because every row had a different middle, and the drag grip was
 * pinned a flat 12px from the top of a card whose height varied — 18px above
 * centre in a short row, 70px in a long one.
 *
 * Fixed height is only half of it: a cell opened for editing, and a row with
 * its drawer open, MUST still be able to grow. Both are asserted here, since
 * a naive `height` would pass the first half and silently clip the second.
 */
const { chromium } = require("playwright");
const fs = require("fs"); const path = require("path"); const http = require("http");
const ROOT = process.env.ROW_ROOT || path.join(__dirname, "../tracker-public");
const CACHE = process.env.CDN_CACHE || "";
const CDN = {
  "https://unpkg.com/react@18.3.1/umd/react.production.min.js":"react.js",
  "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js":"react-dom.js",
  "https://unpkg.com/@babel/standalone@7.29.8/babel.min.js":"babel.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/dist/umd/supabase.js":"supabase.js" };
const UID="00000000-0000-4000-8000-000000000001";
const USER={id:UID,email:"t@e.com",aud:"authenticated",role:"authenticated",
  app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
const P1="aaaaaaaa-0000-4000-8000-000000000001";
const LONG="This is a deliberately long note that would wrap across several lines inside its cell and push the whole row taller than its neighbours";
const base=(o)=>Object.assign({id:"x",user_id:UID,company:"Acme",role_title:"Analyst",
  location:"London",status:"applied",replies:"",next_steps:"",notes:"",sort_order:0,
  deleted:false,contact_email:"",salary:"",equity:"",start_date:null,benefits_score:0,
  score_salary:3,score_growth:4,score_culture:4,score_location:3,
  activity:new Date().toISOString(),stage_history:[],page_id:P1},o);
const rows=[
  base({id:"r0"}),
  base({id:"r1",company:"Northwind Trading Group Limited",role_title:"Senior Analyst, Commercial Strategy and Pricing",notes:LONG}),
  base({id:"r2",company:"Bluefin",next_steps:LONG,status:"interview"}),
  base({id:"r3",company:"Carrow",replies:LONG,status:"offer"}),
  base({id:"r4",company:"Dalton",status:"to-apply"}),
];
const out=[]; const t=(n,ok,d)=>{out.push(ok);console.log((ok?"PASS  ":"FAIL  ")+n+(d?"  — "+d:""));};

function serve(port){
  const s=http.createServer((req,res)=>{
    const f=path.join(ROOT, req.url.split("?")[0]==="/"?"/index.html":req.url.split("?")[0]);
    fs.readFile(f,(e,b)=>{ if(e){res.writeHead(404);res.end();return;}
      res.writeHead(200,{"Content-Type":f.endsWith(".html")?"text/html":"text/plain"}); res.end(b); });
  }); s.listen(port,"127.0.0.1"); return s;
}

(async()=>{
  const server=serve(8784);
  const browser=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--no-sandbox"]});
  async function open(viewport){
    const ctx=await browser.newContext({viewport});
    if(CACHE) await ctx.route(u=>!!CDN[u.href.split("?")[0]],r=>r.fulfill({status:200,
      contentType:"application/javascript",body:fs.readFileSync(path.join(CACHE,CDN[r.request().url().split("?")[0]]))}));
    await ctx.route("https://stub.supabase.co/**",rt=>{const u=rt.request().url(),m=rt.request().method();
      const j=o=>rt.fulfill({status:200,contentType:"application/json",body:JSON.stringify(o)});
      if(u.includes("/auth/v1/user"))return j(USER); if(u.includes("/auth/v1/"))return j({user:USER});
      if(u.includes("tracker_pages"))return j(m==="GET"?[{id:P1,name:"Applications",sort_order:0,user_id:UID}]:[]);
      if(u.includes("applications"))return j(m==="GET"?rows:[]); return j([]);});
    await ctx.addInitScript(()=>{localStorage.setItem("tracker.config",JSON.stringify({url:"https://stub.supabase.co",key:"x".repeat(40)}));
      localStorage.setItem("sb-stub-auth-token",JSON.stringify({access_token:"s",token_type:"bearer",expires_in:86400,
        expires_at:Math.floor(Date.now()/1000)+86400,refresh_token:"s",
        user:{id:"00000000-0000-4000-8000-000000000001",email:"t@e.com",aud:"authenticated",role:"authenticated",
          app_metadata:{},user_metadata:{},created_at:new Date().toISOString()}}));});
    const pg=await ctx.newPage(); const errs=[]; pg.on("pageerror",e=>errs.push(e.message));
    await pg.goto("http://127.0.0.1:8784/index.html",{waitUntil:"commit"});
    return {ctx,pg,errs};
  }

  const {pg,errs}=await open({width:1500,height:1000});
  await pg.waitForSelector(".tk-grid .tk-rowcard",{timeout:25000});
  await pg.waitForTimeout(700);
  await pg.mouse.move(700,400);   // reveal the grips

  const heights=()=>pg.evaluate(()=>[...document.querySelectorAll(".tk-grid .tk-rowcard")]
    .map(c=>Math.round(c.getBoundingClientRect().height)));

  const h=await heights();
  t("every row is the same height, whatever is written in it",
    new Set(h).size===1, h.join(", "));
  const token=await pg.evaluate(()=>parseInt(getComputedStyle(document.documentElement).getPropertyValue("--row-h"),10));
  t("...and that height is the --row-h token", h[0]===token, h[0]+"px vs --row-h "+token+"px");

  /* Everything on the centre line. The identity column is two stacked lines
     by design, so its two children are excluded — the STACK is what has to be
     centred there, and that is checked separately below. */
  const audit=await pg.evaluate(()=>{
    const card=[...document.querySelectorAll(".tk-grid .tk-rowcard")][1];
    const row=card.querySelector('[role="row"]');
    const b=row.getBoundingClientRect(); const mid=(b.top+b.bottom)/2;
    const cells=[...row.children];
    const identity=cells[0];
    const bad=[];
    card.querySelectorAll("button,select,input,svg,span").forEach(el=>{
      const r=el.getBoundingClientRect();
      if(r.height===0||r.width===0) return;
      if(el.closest(".tk-detail")) return;
      if(identity && identity.contains(el)) return;
      if(el.querySelector("button,select,input")) return;
      const off=Math.round(((r.top+r.bottom)/2)-mid);
      if(Math.abs(off)>1) bad.push({off,
        what:(el.getAttribute("aria-label")||el.textContent||el.tagName).replace(/\s+/g," ").trim().slice(0,28)});
    });
    const idr=identity?identity.getBoundingClientRect():null;
    const kids=identity?[...identity.querySelectorAll(".tk-cell")].map(k=>k.getBoundingClientRect()):[];
    const stackMid=kids.length?((Math.min(...kids.map(k=>k.top))+Math.max(...kids.map(k=>k.bottom)))/2):null;
    return {bad, stackOff: stackMid==null?null:Math.round(stackMid-mid)};
  });
  t("every element in a resting row sits on its centre line",
    audit.bad.length===0, JSON.stringify(audit.bad));
  t("the identity column's two-line stack is centred as a stack",
    audit.stackOff !== null && Math.abs(audit.stackOff)<=1, audit.stackOff+"px");

  /* grip and pill were the two named complaints */
  const named=await pg.evaluate(()=>{
    const card=[...document.querySelectorAll(".tk-grid .tk-rowcard")][1];
    const row=card.querySelector('[role="row"]');
    const b=row.getBoundingClientRect(); const mid=(b.top+b.bottom)/2;
    const off=(sel)=>{const e=card.querySelector(sel); if(!e) return null;
      const r=e.getBoundingClientRect(); return Math.round(((r.top+r.bottom)/2)-mid);};
    return {grip:off(".tk-drag"), pill:off(".tk-pill")};
  });
  t("the drag grip is on the centre line", named.grip===0, named.grip+"px");
  t("the stage pill is on the centre line", named.pill===0, named.pill+"px");

  /* truncation, with the full value still reachable */
  const trunc=await pg.evaluate(()=>{
    const cells=[...document.querySelectorAll('.tk-grid .tk-rowcard')][1];
    const over=[...cells.querySelectorAll(".tk-cell")].filter(b=>b.scrollWidth>b.clientWidth+1);
    return {n:over.length, titled:over.filter(b=>b.getAttribute("title")).length};});
  t("long text is clipped to one line rather than wrapping", trunc.n>0, "overflowing cells: "+trunc.n);
  t("...and the whole value is on the title attribute", trunc.n>0 && trunc.titled===trunc.n,
    trunc.titled+"/"+trunc.n);

  /* the score cell keeps its own layout: a fixed row height must not flatten it */
  const score=await pg.evaluate(()=>{
    const cells=[...document.querySelector(".tk-grid .tk-rowcard").querySelectorAll('[role="cell"]')];
    const btn=cells[7].querySelector("button.tk-cell");
    const num=btn.querySelector(".tk-data"), car=btn.querySelector(".tk-noprint");
    const b=btn.getBoundingClientRect(),n=num.getBoundingClientRect(),c=car.getBoundingClientRect();
    return {display:getComputedStyle(btn).display, gap:Math.round(c.left-n.right)};});
  t("the score cell keeps its flex layout, caret pushed to the edge",
    score.display==="flex" && score.gap>2, JSON.stringify(score));

  /* growth is still possible where it is wanted */
  await pg.evaluate(()=>{
    const c=[...document.querySelectorAll('.tk-grid .tk-rowcard')][1];
    const cells=[...c.querySelectorAll('[role="cell"]')];
    cells[6].querySelector("button.tk-cell").click();});
  await pg.waitForTimeout(350);
  let now=await heights();
  t("opening a cell for editing grows THAT row", now[1]>now[0], now.join(", "));
  t("...and leaves its neighbours alone", now[0]===h[0] && now[2]===h[2], now.join(", "));
  await pg.keyboard.press("Escape"); await pg.waitForTimeout(350);
  now=await heights();
  t("closing the editor returns the row to one height", new Set(now).size===1, now.join(", "));

  await pg.evaluate(()=>{const b=document.querySelector('.tk-grid .tk-rowcard button[aria-expanded]'); if(b)b.click();});
  await pg.waitForTimeout(400);
  now=await heights();
  t("the drawer still opens", now[0]>h[0], now.join(", "));
  await pg.evaluate(()=>{const b=document.querySelector('.tk-grid .tk-rowcard button[aria-expanded]'); if(b)b.click();});
  await pg.waitForTimeout(400);
  now=await heights();
  t("closing the drawer returns every row to one height", new Set(now).size===1, now.join(", "));
  t("no JS faults at desktop width", errs.length===0, errs[0]);

  /* the phone is meant to show everything — it must NOT have been clipped */
  const m=await open({width:390,height:844});
  await m.pg.waitForSelector(".tk-mcard",{timeout:25000}); await m.pg.waitForTimeout(500);
  const phone=await m.pg.evaluate(()=>{
    const clipped=[...document.querySelectorAll(".tk-mcard .tk-cell")].filter(b=>b.scrollWidth>b.clientWidth+1).length;
    return {clipped, cards:document.querySelectorAll(".tk-mcard").length};});
  t("the phone cards still show their text in full", phone.clipped===0,
    phone.clipped+" clipped of "+phone.cards+" cards");
  t("no JS faults at phone width", m.errs.length===0, m.errs[0]);

  await browser.close(); server.close();
  const bad=out.filter(x=>!x).length;
  console.log("\n"+(bad?"FAIL":"PASS")+" — "+(out.length-bad)+"/"+out.length);
  process.exit(bad?1:0);
})();
