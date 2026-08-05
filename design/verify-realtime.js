const { chromium } = require('playwright'); const fs = require('fs');
const { startRealtime } = require('./realtime-stub.js');
const SP = '/tmp/claude-0/-home-user-Officient/70073ebc-e76e-5840-bec6-bc987ac23da4/scratchpad/';
const CDN = {'https://unpkg.com/react@18.3.1/umd/react.production.min.js':'react.js',
 'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js':'react-dom.js',
 'https://unpkg.com/@babel/standalone@7.29.8/babel.min.js':'babel.js',
 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/dist/umd/supabase.js':'supabase.js'};
const UID='00000000-0000-4000-8000-000000000001';
const USER={id:UID,email:'t@e.com',aud:'authenticated',role:'authenticated'};
const P1='aaaaaaaa-0000-4000-8000-000000000001';
const out=[]; const check=(n,ok,d)=>{out.push(ok);console.log((ok?'PASS  ':'FAIL  ')+n+(d?'  — '+d:''));};

const RT = startRealtime(8788);
let DB = ['Alpha','Bravo','Charlie','Delta'].map((c,i)=>({
  id:'g'+i+'000000-0000-4000-8000-00000000000'+i, company:c, role_title:'Analyst',
  location:'London', status:'applied', replies:'', next_steps:'', notes:'',
  sort_order:i, deleted:false, contact_email:'', salary:'', equity:'', start_date:null,
  benefits_score:0, score_salary:0, score_growth:0, score_culture:0, score_location:0,
  activity:new Date().toISOString(), user_id:UID, stage_history:[], page_id:P1}));
const PAGES=[{id:P1,name:'Applications',sort_order:0,created_at:'2026-01-01T00:00:00Z'}];

async function device(b,opts){
  const ctx=await b.newContext(opts);
  await ctx.route(u=>!!CDN[u.href.split('?')[0]],r=>r.fulfill({status:200,contentType:'application/javascript',
    body:fs.readFileSync(SP+'cdn/'+CDN[r.request().url().split('?')[0]])}));
  // point the realtime socket at our server
  await ctx.route('wss://stub.supabase.co/**',r=>r.abort());
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
        const hit=one?DB.filter(r=>r.id===one[1]):[];
        hit.forEach(r=>{const old={...r}; Object.assign(r,body); RT.broadcast('applications','UPDATE',{...r},old);});
        return j(hit);}
      return j([]);}
    return j([]);});
  const pg=await ctx.newPage(); const errs=[];
  pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(()=>{
    localStorage.setItem('tracker.config',JSON.stringify({url:'https://stub.supabase.co',key:'x'.repeat(40)}));
    localStorage.setItem('sb-stub-auth-token',JSON.stringify({access_token:'s',token_type:'bearer',expires_in:86400,
     expires_at:Math.floor(Date.now()/1000)+86400,refresh_token:'s',
     user:{id:'00000000-0000-4000-8000-000000000001',email:'t@e.com',aud:'authenticated',role:'authenticated',
      app_metadata:{},user_metadata:{},created_at:new Date().toISOString()}}));
    // redirect the realtime socket to the local stub
    const N=WebSocket;
    window.WebSocket=function(url,p){
      const u=String(url).replace('wss://stub.supabase.co','ws://127.0.0.1:8788');
      return p?new N(u,p):new N(u);};
    window.WebSocket.prototype=N.prototype;
  });
  await pg.goto('http://127.0.0.1:8777/index.html',{waitUntil:'networkidle'});
  await pg.waitForTimeout(1200);
  return {ctx,pg,errs};
}
const order=pg=>pg.evaluate(()=>[...document.querySelectorAll('.tk-grid .tk-rowcard [data-c="0"]')].map(e=>e.textContent.trim()));

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 const A=await device(b,{viewport:{width:1440,height:1000}});
 const B=await device(b,{viewport:{width:1440,height:1000}});
 await A.pg.waitForSelector('.tk-grid'); await B.pg.waitForSelector('.tk-grid');
 await A.pg.waitForTimeout(900);

 check('both devices opened a realtime channel', RT.clients()>=2 && RT.subscribed()>=2,
   RT.clients()+' sockets, '+RT.subscribed()+' channels');
 const syncA=await A.pg.evaluate(()=>{const el=[...document.querySelectorAll('*')]
   .find(e=>/^(live|saving|offline)$/i.test(e.textContent.trim())); return el?el.textContent.trim():'?';});
 check('device A reports itself live, not offline', /live|saving/i.test(syncA), syncA);

 check('B starts equal to A', JSON.stringify(await order(B.pg))===JSON.stringify(await order(A.pg)));

 // A drags row 1 down two slots
 const h=await A.pg.evaluate(()=>{const e=document.querySelectorAll('.tk-drag')[0].getBoundingClientRect();
   return {x:e.x+e.width/2,y:e.y+e.height/2};});
 const hs=await A.pg.evaluate(()=>[...document.querySelectorAll('.tk-rowcard')].map(c=>c.getBoundingClientRect().height));
 await A.pg.mouse.move(h.x,h.y); await A.pg.mouse.down();
 await A.pg.mouse.move(h.x,h.y+hs[1]+hs[2],{steps:10});
 await A.pg.waitForTimeout(150); await A.pg.mouse.up();
 await A.pg.waitForTimeout(1500);          // realtime latency budget

 const aOrder=await order(A.pg), bOrder=await order(B.pg);
 const dbOrder=[...DB].sort((x,y)=>x.sort_order-y.sort_order).map(r=>r.company);
 check('A shows the new order', JSON.stringify(aOrder)!==JSON.stringify(['Alpha','Bravo','Charlie','Delta']), JSON.stringify(aOrder));
 check('the database agrees with A', JSON.stringify(dbOrder)===JSON.stringify(aOrder), 'db='+JSON.stringify(dbOrder));
 check('DEVICE B UPDATED WITHOUT A RELOAD', JSON.stringify(bOrder)===JSON.stringify(aOrder),
   'B='+JSON.stringify(bOrder)+'  A='+JSON.stringify(aOrder));
 check('no JS faults on either device', A.errs.length===0&&B.errs.length===0, (A.errs[0]||B.errs[0]||''));

 console.log('\n'+out.filter(Boolean).length+'/'+out.length+' checks passed');
 RT.close(); await b.close(); process.exit(0);
})();
