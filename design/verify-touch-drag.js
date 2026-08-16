/* A REAL touch device: hasTouch, iPhone UA, and genuine touch/pointer events.
   The desktop drag was reported working after being driven with a mouse at
   1440px; this exists so that cannot happen again. */
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
let DB=['Alpha','Bravo','Charlie','Delta'].map((c,i)=>({id:'g'+i+'000000-0000-4000-8000-00000000000'+i,
 company:c,role_title:'Analyst',location:'London',status:'applied',replies:'',next_steps:'',notes:'',
 sort_order:i,deleted:false,contact_email:'',salary:'',equity:'',start_date:null,benefits_score:0,
 score_salary:0,score_growth:0,score_culture:0,score_location:0,activity:new Date().toISOString(),
 user_id:UID,stage_history:[],page_id:P1}));
const PAGES=[{id:P1,name:'Applications',sort_order:0,created_at:'2026-01-01T00:00:00Z'}];
const writes=[];
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:3,
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'});
 await ctx.route(u=>!!CDN[u.href.split('?')[0]],r=>r.fulfill({status:200,contentType:'application/javascript',
   body:fs.readFileSync(SP+'cdn/'+CDN[r.request().url().split('?')[0]])}));
 await ctx.route('https://stub.supabase.co/**',route=>{const q=route.request(),u=q.url(),m=q.method();
  const j=o=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(o)});
  if(u.includes('/auth/v1/user'))return j(USER); if(u.includes('/auth/v1/'))return j({user:USER});
  if(u.includes('/rest/v1/tracker_pages'))return j(m==='GET'?PAGES:[]);
  if(u.includes('/rest/v1/applications')){
    if(m==='GET')return j([...DB].sort((a,b)=>a.sort_order-b.sort_order));
    if(m==='PATCH'){const body=JSON.parse(q.postData()||'{}');const du=decodeURIComponent(u);
      const one=/id=eq\.([^&]+)/.exec(du); const hit=one?DB.filter(r=>r.id===one[1]):[];
      hit.forEach(r=>Object.assign(r,body)); writes.push({body,matched:hit.length}); return j(hit);}
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
 /* Wait for the thing being tested, not for a guess at how long it takes.
    This was a flat 1500ms, which sat right on the render boundary: Babel
    compiles the whole file at runtime, so first paint moves whenever the file
    grows, and the check failed or passed depending on the machine. A sleep
    tuned to today's file size is a test that breaks on unrelated edits. */
 await pg.waitForSelector('.tk-mcard',{timeout:20000});
 await pg.waitForTimeout(300);

 const order=()=>pg.evaluate(()=>[...document.querySelectorAll('.tk-mcard')].map(c=>{
   const t=c.textContent.trim(); return t.split('Analyst')[0].trim();}));
 check('the phone renders cards', (await order()).length===4, JSON.stringify(await order()));
 const vis=await pg.evaluate(()=>[...document.querySelectorAll('.tk-mcard .tk-drag')]
   .filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).opacity!=='0';}).length);
 check('every card has a VISIBLE drag handle', vis===4, vis+' visible');
 const ta=await pg.evaluate(()=>getComputedStyle(document.querySelector('.tk-mcard .tk-drag')).touchAction);
 check('the handle opts out of native scrolling', ta==='none', ta);

 // a real touch drag: press, hold past the threshold, move, release
 const h=await pg.evaluate(()=>{const r=document.querySelectorAll('.tk-mcard .tk-drag')[0].getBoundingClientRect();
   return {x:r.x+r.width/2,y:r.y+r.height/2};});
 const hs=await pg.evaluate(()=>[...document.querySelectorAll('.tk-mcard')].map(c=>c.getBoundingClientRect().height));
 const gap=await pg.evaluate(()=>{const a=document.querySelectorAll('.tk-mcard');
   return a[1].getBoundingClientRect().top-a[0].getBoundingClientRect().top;});

 const before=await order();
 // too short a press must NOT drag
 await pg.touchscreen.tap(h.x,h.y);
 await pg.waitForTimeout(250);
 check('a tap does not start a drag', JSON.stringify(await order())===JSON.stringify(before));

 // long press, then move
 await pg.evaluate(async ({dy})=>{
   /* Address the handle directly. elementFromPoint returns null if anything
      has scrolled since the coordinates were taken, which is a harness
      failure dressed up as a product one. */
   const el=document.querySelectorAll('.tk-mcard .tk-drag')[0];
   const r=el.getBoundingClientRect();
   const x=r.x+r.width/2, y=r.y+r.height/2;
   const opts=(cx,cy)=>({pointerId:1,pointerType:'touch',isPrimary:true,clientX:cx,clientY:cy,bubbles:true,cancelable:true});
   el.dispatchEvent(new PointerEvent('pointerdown',opts(x,y)));
   await new Promise(r=>setTimeout(r,520));            // past the 400ms threshold
   for(let i=1;i<=10;i++){
     window.dispatchEvent(new PointerEvent('pointermove',opts(x,y+(dy*i)/10)));
     await new Promise(r=>setTimeout(r,25));
   }
   window.dispatchEvent(new PointerEvent('pointerup',opts(x,y+dy)));
 },{dy:gap*2+4});
 await pg.waitForTimeout(1200);

 const after=await order();
 check('A LONG PRESS AND DRAG REORDERS ON TOUCH', JSON.stringify(after)!==JSON.stringify(before),
   'before='+JSON.stringify(before)+' after='+JSON.stringify(after));
 check('the touch reorder was written to the database',
   writes.length>0 && writes.every(w=>w.matched===1), writes.length+' writes, matched '+JSON.stringify(writes.map(w=>w.matched)));
 const db=[...DB].sort((a,b)=>a.sort_order-b.sort_order).map(r=>r.company);
 check('the database matches the phone', JSON.stringify(db)===JSON.stringify(after), 'db='+JSON.stringify(db));
 check('no JS faults', errs.length===0, errs[0]);
 console.log('\n'+out.filter(Boolean).length+'/'+out.length+' checks passed');
 await b.close();
})();
