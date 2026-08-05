const { chromium } = require('playwright'); const fs = require('fs');
const SP='/tmp/claude-0/-home-user-Officient/70073ebc-e76e-5840-bec6-bc987ac23da4/scratchpad/';
const CDN={'https://unpkg.com/react@18.3.1/umd/react.production.min.js':'react.js',
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
async function boot(b,reduced){
 const ctx=await b.newContext({viewport:{width:1440,height:1000},
   reducedMotion: reduced?'reduce':'no-preference'});
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
 const pg=await ctx.newPage(); const errs=[];
 pg.on('pageerror',e=>errs.push(e.message));
 await pg.addInitScript(()=>{localStorage.setItem('tracker.config',JSON.stringify({url:'https://stub.supabase.co',key:'x'.repeat(40)}));
  localStorage.setItem('sb-stub-auth-token',JSON.stringify({access_token:'s',token_type:'bearer',expires_in:86400,
   expires_at:Math.floor(Date.now()/1000)+86400,refresh_token:'s',
   user:{id:'00000000-0000-4000-8000-000000000001',email:'t@e.com',aud:'authenticated',role:'authenticated',
    app_metadata:{},user_metadata:{},created_at:new Date().toISOString()}}));});
 await pg.goto('http://127.0.0.1:8777/index.html',{waitUntil:'networkidle'});
 await pg.waitForSelector('.tk-grid'); await pg.waitForTimeout(900);
 return {pg,errs};
}
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 const {pg,errs}=await boot(b,false);

 // ---- item 3 ----
 const openMenu=async()=>{await pg.evaluate(()=>{[...document.querySelectorAll('.tk-headbar button[aria-haspopup="menu"]')].pop().click();});
   await pg.waitForTimeout(200);};
 const themeRow=()=>pg.evaluate(()=>{const el=[...document.querySelectorAll('[role="menuitem"]')]
   .find(x=>/mode/i.test(x.textContent));
   if(!el)return null;
   const svg=el.querySelector('svg'); const paths=svg?svg.innerHTML.length:0;
   return {label:el.textContent.trim(), glyph:paths, aria:el.getAttribute('aria-label'),
     theme:document.documentElement.getAttribute('data-theme')};});
 await openMenu();
 const t1=await themeRow();
 check('the row states the current theme', t1 && /Light mode/.test(t1.label) && t1.theme!=='dark', JSON.stringify(t1));
 await pg.evaluate(()=>[...document.querySelectorAll('[role="menuitem"]')].find(x=>/mode/i.test(x.textContent)).click());
 await pg.waitForTimeout(300);
 const t2=await themeRow();
 check('LABEL changes on toggle', t2 && /Dark mode/.test(t2.label), t2&&t2.label);
 check('GLYPH changes on toggle', t2 && t2.glyph!==t1.glyph, 'sun='+t1.glyph+' moon='+t2.glyph);
 check('the interface actually changed theme', t2 && t2.theme==='dark', t2&&t2.theme);
 check('the menu stayed open', t2!==null);
 check('the action is announced to a screen reader', t2 && /switch to light/i.test(t2.aria||''), t2&&t2.aria);
 await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
 await openMenu();
 const t3=await themeRow();
 check('reopening the menu still shows the right state', t3 && /Dark mode/.test(t3.label), t3&&t3.label);
 await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);

 // ---- item 4: FLIP ----
 const h=await pg.evaluate(()=>{const r=document.querySelectorAll('.tk-drag')[0].getBoundingClientRect();
   return{x:r.x+r.width/2,y:r.y+r.height/2};});
 const hs=await pg.evaluate(()=>[...document.querySelectorAll('.tk-rowcard')].map(c=>c.getBoundingClientRect().height));
 await pg.mouse.move(h.x,h.y); await pg.mouse.down();
 await pg.mouse.move(h.x,h.y+hs[1]+hs[2],{steps:8});
 await pg.waitForTimeout(60);
 const mid=await pg.evaluate(()=>{
   const cards=[...document.querySelectorAll('.tk-rowcard')];
   const lifted=cards.find(c=>c.getAttribute('data-drag')==='lift');
   const moved=cards.filter(c=>c!==lifted&&getComputedStyle(c).transform!=='none');
   const s=moved[0]?getComputedStyle(moved[0]):null;
   return {displacedAnimating:moved.length,
     transition:s?s.transitionProperty+' '+s.transitionDuration+' '+s.transitionTimingFunction:'',
     liftedTransition:lifted?getComputedStyle(lifted).transitionProperty:'',
     radius:s?s.borderRadius:'', inset:s?/inset/.test(s.boxShadow):false};});
 check('displaced rows are animating', mid.displacedAnimating>0, JSON.stringify(mid.displacedAnimating));
 check('they animate TRANSFORM only', /transform/.test(mid.transition)&&!/top|height|margin/.test(mid.transition), mid.transition);
 check('the spring curve and duration are within the ceiling',
   /0\.22, 1, 0\.36, 1/.test(mid.transition)&&/0\.22s/.test(mid.transition), mid.transition);
 check('the DRAGGED row does not animate', !/transform/.test(mid.liftedTransition), mid.liftedTransition||'(none)');
 check('corners and shadow hold MID-ANIMATION', mid.radius==='10px'&&mid.inset, 'radius='+mid.radius+' inset='+mid.inset);
 await pg.mouse.up(); await pg.waitForTimeout(800);
 check('no JS faults', errs.length===0, errs[0]);

 // ---- reduced motion ----
 const r2=await boot(b,true);
 const h2=await r2.pg.evaluate(()=>{const r=document.querySelectorAll('.tk-drag')[0].getBoundingClientRect();
   return{x:r.x+r.width/2,y:r.y+r.height/2};});
 const hs2=await r2.pg.evaluate(()=>[...document.querySelectorAll('.tk-rowcard')].map(c=>c.getBoundingClientRect().height));
 const b4=await r2.pg.evaluate(()=>[...document.querySelectorAll('.tk-grid .tk-rowcard [data-c="0"]')].map(e=>e.textContent.trim()));
 await r2.pg.mouse.move(h2.x,h2.y); await r2.pg.mouse.down();
 await r2.pg.mouse.move(h2.x,h2.y+hs2[1]+hs2[2],{steps:8}); await r2.pg.waitForTimeout(60);
 /* Displaced rows are ALWAYS moved by transform now — that is the mechanism,
    not the animation. Under reduced motion they move without a transition, so
    the transition is what to assert on. */
 const rm=await r2.pg.evaluate(()=>[...document.querySelectorAll('.tk-rowcard')]
   .filter(c=>c.getAttribute('data-drag')!=='lift'
     && getComputedStyle(c).transform!=='none'
     /* Playwright's reduced-motion emulation forces transition-duration to
        1e-06s on everything, so "not 0s" is not the test — "long enough to
        see" is. Anything under 10ms is instantaneous. */
     && parseFloat(getComputedStyle(c).transitionDuration) > 0.01).length);
 await r2.pg.mouse.up(); await r2.pg.waitForTimeout(700);
 const af=await r2.pg.evaluate(()=>[...document.querySelectorAll('.tk-grid .tk-rowcard [data-c="0"]')].map(e=>e.textContent.trim()));
 const rmDetail=await r2.pg.evaluate(()=>[...document.querySelectorAll('.tk-rowcard')]
   .map((c,i)=>({i,lift:c.getAttribute('data-drag'),tr:getComputedStyle(c).transitionDuration,
     prop:getComputedStyle(c).transitionProperty,xf:getComputedStyle(c).transform!=='none'}))
   .filter(x=>x.tr!=='0s'));
 console.log('    reduced-motion detail:', JSON.stringify(rmDetail));
 check('prefers-reduced-motion: rows move without a transition', rm===0, rm+' still transitioning');
 check('prefers-reduced-motion: the reorder still happens', JSON.stringify(af)!==JSON.stringify(b4), JSON.stringify(af));

 console.log('\n'+out.filter(Boolean).length+'/'+out.length+' checks passed');
 await b.close();
})();
