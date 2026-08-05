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
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 const ctx=await b.newContext({viewport:{width:1440,height:1100}});
 await ctx.route(u=>!!CDN[u.href.split('?')[0]],r=>r.fulfill({status:200,contentType:'application/javascript',
   body:fs.readFileSync(SP+'cdn/'+CDN[r.request().url().split('?')[0]])}));
 let rows=['Alpha','Bravo','Charlie','Delta'].map((c,i)=>({id:'g'+i+'000000-0000-4000-8000-00000000000'+i,
   company:c,role_title:'Analyst',location:'London',status:'applied',replies:'',next_steps:'',notes:'',
   sort_order:i,deleted:false,contact_email:'',salary:'',equity:'',start_date:null,benefits_score:0,
   score_salary:0,score_growth:0,score_culture:0,score_location:0,
   activity:new Date().toISOString(),user_id:UID,stage_history:[],page_id:P1}));
 const pages=[{id:P1,name:'Applications',sort_order:0,created_at:'2026-01-01T00:00:00Z'}];
 const patches=[];
 await ctx.route('https://stub.supabase.co/**',route=>{const q=route.request(),u=q.url(),m=q.method();
  const j=o=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(o)});
  if(u.includes('/auth/v1/user'))return j(USER); if(u.includes('/auth/v1/'))return j({user:USER});
  if(u.includes('/rest/v1/tracker_pages'))return j(m==='GET'?pages:[]);
  if(u.includes('/rest/v1/applications')){
    if(m==='GET')return j(rows);
    if(m==='PATCH'){const body=JSON.parse(q.postData()||'{}');const du=decodeURIComponent(u);
      const one=/id=eq\.([^&]+)/.exec(du);
      const hit=one?rows.filter(r=>r.id===one[1]):[];
      hit.forEach(t=>Object.assign(t,body));
      patches.push(body);
      /* Return the matched rows. The app now asks for .select("id") and treats
         an empty result as a zero-row update — a stub that answers [] makes a
         correct write look like a silent failure and triggers a rollback. */
      return j(hit);}
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
 await pg.waitForSelector('.tk-grid'); await pg.waitForTimeout(900);
 const order=()=>pg.evaluate(()=>[...document.querySelectorAll('.tk-grid .tk-rowcard [data-c="0"]')]
   .map(e=>e.textContent.trim()));

 check('starts in manual order', JSON.stringify(await order())===JSON.stringify(['Alpha','Bravo','Charlie','Delta']),
   JSON.stringify(await order()));
 check('every DESKTOP row has a reorder handle',
   await pg.evaluate(()=>document.querySelectorAll('.tk-grid .tk-rowcard > .tk-drag').length)===4,
   'desktop '+await pg.evaluate(()=>document.querySelectorAll('.tk-grid .tk-rowcard > .tk-drag').length)+
   ', mobile '+await pg.evaluate(()=>document.querySelectorAll('.tk-mcard > .tk-drag').length));

 // --- pointer drag: Alpha down past Charlie ---
 const box=async i=>pg.evaluate(n=>{const h=document.querySelectorAll('.tk-drag')[n].getBoundingClientRect();
   return {x:h.x+h.width/2,y:h.y+h.height/2};},i);
 const cards=await pg.evaluate(()=>[...document.querySelectorAll('.tk-rowcard')].map(c=>{
   const r=c.getBoundingClientRect(); return {top:r.top,h:r.height};}));
 const from=await box(0);
 await pg.mouse.move(from.x,from.y);
 await pg.mouse.down();
 await pg.mouse.move(from.x,from.y+3);            // under the slop threshold
 const afterTiny=await order();
 check('3px of travel does not start a drag', JSON.stringify(afterTiny)===JSON.stringify(['Alpha','Bravo','Charlie','Delta']),
   JSON.stringify(afterTiny));
 await pg.mouse.move(from.x,from.y+cards[1].h+cards[2].h,{steps:8});
 await pg.waitForTimeout(150);
 /* The rows now MOVE during the drag by transform rather than by reordering
    the DOM — that is the change that removed 15,480 forced layouts per drag.
    So the check is that they are visibly displaced, not that the document
    order changed. */
 const displaced=await pg.evaluate(()=>[...document.querySelectorAll('.tk-grid .tk-rowcard')]
   .filter(c=>c.getAttribute('data-drag')!=='lift'&&getComputedStyle(c).transform!=='none').length);
 check('rows visibly part DURING the drag, not on release', displaced>0, displaced+' displaced');
 const lifted=await pg.evaluate(()=>!!document.querySelector('.tk-rowcard[data-drag="lift"]'));
 check('the dragged row is lifted while in flight', lifted);
 patches.length=0;
 await pg.mouse.up();
 await pg.waitForTimeout(600);
 const after=await order();
 check('Alpha moved down', after[0]!=='Alpha', JSON.stringify(after));
 check('the new order is written once per moved row', patches.length>0 && patches.length<=4,
   patches.length+' writes: '+JSON.stringify(patches));
 check('sort_order in the database matches the screen',
   JSON.stringify([...rows].sort((a,b)=>a.sort_order-b.sort_order).map(r=>r.company))===JSON.stringify(after),
   JSON.stringify([...rows].sort((a,b)=>a.sort_order-b.sort_order).map(r=>r.company)));

 // --- keyboard ---
 const before2=await order();
 await pg.evaluate(()=>document.querySelectorAll('.tk-drag')[0].focus());
 await pg.keyboard.press('Space'); await pg.waitForTimeout(150);
 check('Space picks the row up', await pg.evaluate(()=>
   document.querySelectorAll('.tk-drag')[0].getAttribute('aria-pressed')==='true'));
 await pg.keyboard.press('ArrowDown'); await pg.waitForTimeout(200);
 const kbdMoved=await order();
 check('ArrowDown moves it', JSON.stringify(kbdMoved)!==JSON.stringify(before2), JSON.stringify(kbdMoved));
 await pg.keyboard.press('Escape'); await pg.waitForTimeout(250);
 check('Escape puts it back', JSON.stringify(await order())===JSON.stringify(before2), JSON.stringify(await order()));

 // --- shadow invariant on a normal row ---
 await pg.mouse.move(5,5); await pg.waitForTimeout(150);
 const inv=await pg.evaluate(()=>{const c=document.querySelector('.tk-grid .tk-rowcard');
   const cs=getComputedStyle(c);
   return {radius:cs.borderRadius,inset:/inset/.test(cs.boxShadow),
     clip:[...document.querySelectorAll('.tk-scroll,.tk-grid')].map(e=>getComputedStyle(e).overflow).join('|')};});
 check('shadow invariant survives', inv.radius==='10px'&&inv.inset&&!/hidden/.test(inv.clip), JSON.stringify(inv));
 check('no JS faults', errs.length===0, errs[0]);
 console.log('\n'+out.filter(Boolean).length+'/'+out.length+' checks passed');
 await b.close();
})();
