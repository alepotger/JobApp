const { chromium } = require('playwright'); const fs = require('fs');
const SP='/tmp/claude-0/-home-user-Officient/70073ebc-e76e-5840-bec6-bc987ac23da4/scratchpad/';
const CDN={'https://unpkg.com/react@18.3.1/umd/react.production.min.js':'react.js',
 'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js':'react-dom.js',
 'https://unpkg.com/@babel/standalone@7.29.8/babel.min.js':'babel.js',
 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/dist/umd/supabase.js':'supabase.js'};
const UID='00000000-0000-4000-8000-000000000001';
const USER={id:UID,email:'t@e.com',aud:'authenticated',role:'authenticated'};
const P1='aaaaaaaa-0000-4000-8000-000000000001';
const N=Number(process.argv[2]||24);
let DB=[...Array(N)].map((_,i)=>({id:'g'+String(i).padStart(2,'0')+'00000-0000-4000-8000-'+String(i).padStart(12,'0'),
 company:'Company '+i,role_title:'Data Analyst',location:'London',status:'applied',
 replies:'Thanks for applying, we will be in touch shortly about next steps.',
 next_steps:'- [ ] chase\n- [ ] prep',notes:'Angle: referral via ex-colleague. ATS: Greenhouse.',
 sort_order:i,deleted:false,contact_email:'careers@company'+i+'.com',salary:'',equity:'',start_date:null,
 benefits_score:3,score_salary:4,score_growth:3,score_culture:4,score_location:2,
 activity:new Date().toISOString(),user_id:UID,stage_history:[{to:'applied',at:new Date().toISOString()}],page_id:P1}));
const PAGES=[{id:P1,name:'Applications',sort_order:0,created_at:'2026-01-01T00:00:00Z'}];
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 const ctx=await b.newContext({viewport:{width:1440,height:1000}});
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
      hit.forEach(r=>Object.assign(r,body)); return j(hit);}
    return j([]);}
  return j([]);});
 const pg=await ctx.newPage();
 await pg.addInitScript(()=>{localStorage.setItem('tracker.config',JSON.stringify({url:'https://stub.supabase.co',key:'x'.repeat(40)}));
  localStorage.setItem('sb-stub-auth-token',JSON.stringify({access_token:'s',token_type:'bearer',expires_in:86400,
   expires_at:Math.floor(Date.now()/1000)+86400,refresh_token:'s',
   user:{id:'00000000-0000-4000-8000-000000000001',email:'t@e.com',aud:'authenticated',role:'authenticated',
    app_metadata:{},user_metadata:{},created_at:new Date().toISOString()}}));});
 await pg.goto('http://127.0.0.1:8777/index.html',{waitUntil:'networkidle'});
 await pg.waitForSelector('.tk-grid'); await pg.waitForTimeout(1200);

 // instrument: frame deltas, and how many times the list is re-laid-out
 await pg.evaluate(()=>{
   window.__frames=[]; let last=performance.now();
   (function tick(){const n=performance.now(); window.__frames.push(n-last); last=n;
     window.__raf=requestAnimationFrame(tick);})();
   window.__rects=0;
   const orig=Element.prototype.getBoundingClientRect;
   Element.prototype.getBoundingClientRect=function(){window.__rects++;return orig.call(this);};
 });

 const h=await pg.evaluate(()=>{const r=document.querySelectorAll('.tk-drag')[0].getBoundingClientRect();
   return{x:r.x+r.width/2,y:r.y+r.height/2};});
 const cardH=await pg.evaluate(()=>document.querySelector('.tk-rowcard').getBoundingClientRect().height+12);
 await pg.evaluate(()=>{window.__frames.length=0; window.__rects=0;});

 await pg.mouse.move(h.x,h.y); await pg.mouse.down();
 // drag down over 8 rows, 60 discrete moves — a normal-speed gesture
 for(let i=1;i<=60;i++){ await pg.mouse.move(h.x,h.y+(cardH*8*i)/60); }
 const during=await pg.evaluate(()=>({frames:window.__frames.slice(),rects:window.__rects}));
 await pg.mouse.up(); await pg.waitForTimeout(600);

 const f=during.frames.filter(x=>x>0);
 f.sort((a,b)=>a-b);
 const p=q=>f[Math.min(f.length-1,Math.floor(f.length*q))];
 /* A frame at 60Hz IS ~16.7ms. Counting those as slow counts healthy vsync
    as failure. A DROPPED frame is one that took two vsync intervals. */
 const long=f.filter(x=>x>33).length;
 console.log('rows                 :', N);
 console.log('frames sampled       :', f.length);
 console.log('median frame         :', p(0.5).toFixed(1)+'ms');
 console.log('p90 frame            :', p(0.9).toFixed(1)+'ms');
 console.log('worst frame          :', f[f.length-1].toFixed(1)+'ms');
 console.log('DROPPED frames (>33ms):', long, '('+Math.round(long/f.length*100)+'%)');
 console.log('getBoundingClientRect:', during.rects, 'calls during the drag');
 await b.close();
})();
