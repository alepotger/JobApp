/* Two signed-in devices against ONE shared stub database, plus a real touch
   context. Device A drags; device B loads fresh. This separates the two
   failures that look identical from the outside:
     - "the write never lands"        → A's screen and the database disagree
     - "the write lands, B never hears about it" → database is right, B is right
                                        on load, and only live propagation is
                                        in question
   The third context is a phone (390x844, hasTouch, iPhone UA) and exists
   because the drag was reported working after being tested only at 1440px with
   a mouse — which is how a touch path that never executes gets called done.
   Run with a local server on :8777 serving tracker-public, and CDN_CACHE-style
   copies of the four pinned scripts beside this file.

   KNOWN LIMIT, stated because it has now hidden two bugs: this stub is
   HTTP-only. There is no WebSocket, so no postgres_changes event ever fires
   here, and nothing about realtime propagation is verified by this file. */
const { chromium } = require('playwright'); const fs = require('fs');
const SP = '/tmp/claude-0/-home-user-Officient/70073ebc-e76e-5840-bec6-bc987ac23da4/scratchpad/';
const CDN = {'https://unpkg.com/react@18.3.1/umd/react.production.min.js':'react.js',
 'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js':'react-dom.js',
 'https://unpkg.com/@babel/standalone@7.29.8/babel.min.js':'babel.js',
 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/dist/umd/supabase.js':'supabase.js'};
const UID='00000000-0000-4000-8000-000000000001';
const USER={id:UID,email:'t@e.com',aud:'authenticated',role:'authenticated'};
const P1='aaaaaaaa-0000-4000-8000-000000000001';
const out=[]; const check=(n,ok,d)=>{out.push(ok);console.log((ok?'PASS  ':'FAIL  ')+n+(d?'  — '+d:''));};

// THE shared database, one copy, both devices talk to it
let DB = ['Alpha','Bravo','Charlie','Delta'].map((c,i)=>({
  id:'g'+i+'000000-0000-4000-8000-00000000000'+i, company:c, role_title:'Analyst',
  location:'London', status:'applied', replies:'', next_steps:'', notes:'',
  sort_order:i, deleted:false, contact_email:'', salary:'', equity:'', start_date:null,
  benefits_score:0, score_salary:0, score_growth:0, score_culture:0, score_location:0,
  activity:new Date().toISOString(), user_id:UID, stage_history:[], page_id:P1}));
const PAGES=[{id:P1,name:'Applications',sort_order:0,created_at:'2026-01-01T00:00:00Z'}];
const writes=[];

async function device(b,{width,height,hasTouch}){
  const ctx=await b.newContext({viewport:{width,height},hasTouch:!!hasTouch,isMobile:!!hasTouch,
    userAgent: hasTouch? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148':undefined});
  await ctx.route(u=>!!CDN[u.href.split('?')[0]],r=>r.fulfill({status:200,contentType:'application/javascript',
    body:fs.readFileSync(SP+'cdn/'+CDN[r.request().url().split('?')[0]])}));
  await ctx.route('https://stub.supabase.co/**',route=>{
    const q=route.request(),u=q.url(),m=q.method();
    const j=o=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(o)});
    if(u.includes('/auth/v1/user'))return j(USER);
    if(u.includes('/auth/v1/'))return j({user:USER});
    if(u.includes('/rest/v1/tracker_pages'))return j(m==='GET'?PAGES:[]);
    if(u.includes('/rest/v1/applications')){
      if(m==='GET')return j([...DB].sort((a,b)=>a.sort_order-b.sort_order));
      if(m==='PATCH'){const body=JSON.parse(q.postData()||'{}');const du=decodeURIComponent(u);
        const one=/id=eq\.([^&]+)/.exec(du);
        const matched=one?DB.filter(r=>r.id===one[1]):[];
        matched.forEach(r=>Object.assign(r,body));
        writes.push({body,matched:matched.length});
        return j(matched);}
      return j([]);}
    return j([]);});
  const pg=await ctx.newPage(); const errs=[];
  pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(()=>{localStorage.setItem('tracker.config',JSON.stringify({url:'https://stub.supabase.co',key:'x'.repeat(40)}));
    localStorage.setItem('sb-stub-auth-token',JSON.stringify({access_token:'s',token_type:'bearer',expires_in:86400,
     expires_at:Math.floor(Date.now()/1000)+86400,refresh_token:'s',
     user:{id:'00000000-0000-4000-8000-000000000001',email:'t@e.com',aud:'authenticated',role:'authenticated',
      app_metadata:{},user_metadata:{},created_at:new Date().toISOString()}}));});
  await pg.goto('http://127.0.0.1:8777/index.html',{waitUntil:'networkidle'});
  await pg.waitForTimeout(1000);
  return {ctx,pg,errs};
}
const deskOrder=pg=>pg.evaluate(()=>[...document.querySelectorAll('.tk-grid .tk-rowcard [data-c="0"]')].map(e=>e.textContent.trim()));
const mobOrder=pg=>pg.evaluate(()=>[...document.querySelectorAll('.lg\\:hidden .tk-rowcard')].map(c=>c.textContent.trim().slice(0,12)));

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});

 // ---------- device A: desktop ----------
 const A=await device(b,{width:1440,height:1000});
 await A.pg.waitForSelector('.tk-grid');
 check('A starts Alpha,Bravo,Charlie,Delta',
   JSON.stringify(await deskOrder(A.pg))===JSON.stringify(['Alpha','Bravo','Charlie','Delta']),
   JSON.stringify(await deskOrder(A.pg)));

 const h=await A.pg.evaluate(()=>{const e=document.querySelectorAll('.tk-drag')[0].getBoundingClientRect();
   return {x:e.x+e.width/2,y:e.y+e.height/2};});
 const hs=await A.pg.evaluate(()=>[...document.querySelectorAll('.tk-rowcard')].map(c=>c.getBoundingClientRect().height));
 writes.length=0;
 await A.pg.mouse.move(h.x,h.y); await A.pg.mouse.down();
 await A.pg.mouse.move(h.x,h.y+hs[1]+hs[2],{steps:10});
 await A.pg.waitForTimeout(200);
 await A.pg.mouse.up(); await A.pg.waitForTimeout(900);
 const aOrder=await deskOrder(A.pg);
 check('A shows a new order after the drag', JSON.stringify(aOrder)!==JSON.stringify(['Alpha','Bravo','Charlie','Delta']), JSON.stringify(aOrder));
 check('writes were sent', writes.length>0, writes.length+' writes');
 check('every write MATCHED a row (not a silent zero-row update)',
   writes.length>0 && writes.every(w=>w.matched===1), JSON.stringify(writes.map(w=>w.matched)));
 const dbOrder=[...DB].sort((a,b)=>a.sort_order-b.sort_order).map(r=>r.company);
 check('THE DATABASE matches what A shows', JSON.stringify(dbOrder)===JSON.stringify(aOrder),
   'db='+JSON.stringify(dbOrder)+' screen='+JSON.stringify(aOrder));

 // ---------- device B: reload, same database ----------
 const B=await device(b,{width:1440,height:1000});
 await B.pg.waitForSelector('.tk-grid');
 const bOrder=await deskOrder(B.pg);
 check('DEVICE B (fresh load) shows A’s order', JSON.stringify(bOrder)===JSON.stringify(aOrder),
   'B='+JSON.stringify(bOrder)+' A='+JSON.stringify(aOrder));

 // ---------- device C: a real phone ----------
 const C=await device(b,{width:390,height:844,hasTouch:true});
 await C.pg.waitForTimeout(1500);
 console.log('    phone body:', (await C.pg.evaluate(()=>document.body.innerText)).slice(0,120).replace(/\n/g,' | '));
 console.log('    phone errs:', C.errs.slice(0,2));
 const handles=await C.pg.evaluate(()=>({
   total:document.querySelectorAll('.tk-drag').length,
   visible:[...document.querySelectorAll('.tk-drag')].filter(e=>e.getBoundingClientRect().width>0).length,
   mobileCards:document.querySelectorAll('.tk-mcard, .tk-cardlist > *').length,
   anyCard:document.querySelectorAll('[class*=card]').length,
   gridVisible:!!document.querySelector('.tk-grid') && document.querySelector('.tk-scroll').getBoundingClientRect().width>0,
   sample:[...document.querySelectorAll('.tk-cardlist > *')].slice(0,4).map(e=>e.textContent.trim().slice(0,14))}));
 check('the phone renders application cards', handles.mobileCards>0, JSON.stringify(handles));
 check('the phone has a reachable drag handle', handles.visible>0,
   'handles in DOM: '+handles.total+', visible: '+handles.visible+' — mobile cards: '+handles.mobileCards);

 console.log('\n'+out.filter(Boolean).length+'/'+out.length+' checks passed');
 await b.close();
})();
