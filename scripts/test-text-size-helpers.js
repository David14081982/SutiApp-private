'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),privateDir='C:/tmp/sutiapp-text-size-private';
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
function env(){const e={};for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)e[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}return e;}
async function serve(){
 const e=env(),site=path.join(privateDir,'site-'+Date.now());
 const output=cp.execFileSync(process.execPath,[path.join(root,'scripts/build-pages-site.js'),site],{cwd:root,env:{...process.env,SUTIAPP_SUPABASE_URL:e.SUPABASE_URL,SUTIAPP_SUPABASE_PUBLISHABLE_KEY:e.SUPABASE_PUBLISHABLE_KEY},encoding:'utf8'});
 const server=http.createServer((req,res)=>{const p=path.resolve(site,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!p.startsWith(site+path.sep)&&p!==site){res.writeHead(403);return res.end();}const f=p===site?path.join(site,'index.html'):p;try{res.setHeader('Content-Type',f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':f.endsWith('.png')?'image/png':'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(8080,'127.0.0.1',resolve));return {server,url:'http://localhost:8080/',build:JSON.parse(output)};
}
async function login(page,url){const e=env();await page.goto(url,{waitUntil:'domcontentloaded'});try{await page.locator('input[type=email]').fill(e.H005_TEST_EMAIL);}catch(error){console.log('LOGIN_DOM '+(await page.locator('body').innerText()).slice(0,500));throw error;}await page.locator('input[type=password]').fill(e.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:60000});await page.locator('[data-text-size]').waitFor();await page.waitForTimeout(2200);}
async function inspect(page){return page.evaluate(()=>{
 const root=document.querySelector('[data-text-size]');const rr=root.getBoundingClientRect(), issues=[];
 const dialog=[...root.querySelectorAll('[role="dialog"]')].filter(e=>e.getBoundingClientRect().height>0&&e.getAttribute('aria-hidden')!=='true').at(-1);
 if(dialog){const r=dialog.getBoundingClientRect();if(r.top<0||r.bottom>innerHeight+2||r.top>innerHeight||r.bottom<0)issues.push({type:'dialog-outside-viewport'});}
 const route=[...root.querySelectorAll('[data-app-route]:not([aria-hidden="true"])')].at(-1);
 const visible=e=>{const c=getComputedStyle(e),r=e.getBoundingClientRect();if(dialog&&!dialog.contains(e))return false;if(!dialog&&route&&!route.contains(e))return false;if(!r.width||!r.height||c.visibility==='hidden'||c.display==='none'||Number(c.opacity)===0||e.closest('[aria-hidden="true"],svg,.su-visually-hidden,.su-odometer-track'))return false;let p=e;while(p&&p!==root){const s=getComputedStyle(p);if(Number(s.opacity)===0)return false;p=p.parentElement;}return true;};
 const identify=e=>({tag:e.tagName,cls:typeof e.className==='string'?e.className:'',style:e.getAttribute('style')?.slice(0,600),test:e.getAttribute('data-app-tab')||e.getAttribute('data-affiliate-field')||'',text:(e.textContent||'').trim().slice(0,70)});
 for(const e of root.querySelectorAll('*')){if(!visible(e))continue;const r=e.getBoundingClientRect(),s=getComputedStyle(e);const direct=[...e.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim());
  if((direct.length||e.tagName==='BUTTON'||e.matches('.su-odometer'))&&(r.left<rr.left-2||r.right>rr.right+2)) {let p=e.parentElement,carousel=false;while(p&&p!==root){const ps=getComputedStyle(p);if(['auto','scroll'].includes(ps.overflowX)||p.hasAttribute('data-convenios-ad')||p.hasAttribute('data-home-banner')){carousel=true;break;}p=p.parentElement;}if(!carousel)issues.push({type:'outside-viewport',...identify(e),bounds:[r.left,r.right,rr.left,rr.right]});}
  if(e.matches('.su-odometer')){if(!e.getAttribute('aria-label'))issues.push({type:'missing-money-label',...identify(e)});if(e.scrollWidth>e.clientWidth+2)issues.push({type:'money-overflow',...identify(e)});}
  if(direct.length){if(parseFloat(s.fontSize)<13.9)issues.push({type:'small',...identify(e),size:s.fontSize});
   if(e.scrollWidth>e.clientWidth+2&&e.clientWidth>0&&s.display!=='inline'&&!['auto','scroll'].includes(s.overflowX))issues.push({type:'text-overflow',...identify(e),width:e.clientWidth,scroll:e.scrollWidth});
   for(const n of direct){const range=document.createRange();range.selectNodeContents(n);for(const tr of range.getClientRects()){let p=e;while(p&&p!==root){const ps=getComputedStyle(p),pr=p.getBoundingClientRect();if((ps.overflowX==='hidden'||ps.overflowX==='clip')&&(tr.left<pr.left-2||tr.right>pr.right+2)) {issues.push({type:'clipped-x',...identify(e),parent:identify(p),bounds:[tr.left,tr.right,pr.left,pr.right]});break;}if((ps.overflowY==='hidden'||ps.overflowY==='clip')&&(tr.top<pr.top-2||tr.bottom>pr.bottom+2)){issues.push({type:'clipped-y',...identify(e),parent:identify(p)});break;}if(['auto','scroll'].includes(ps.overflowY)||['auto','scroll'].includes(ps.overflowX))break;p=p.parentElement;}}}
  }
  if(e.tagName==='BUTTON'&&r.top>=0&&r.bottom<=innerHeight&&(r.width<47.5||r.height<47.5))issues.push({type:'target',...identify(e),width:r.width,height:r.height});
 }
 const textRects=[];
 for(const e of root.querySelectorAll('.su-odometer')){if(!visible(e))continue;const r=e.getBoundingClientRect();textRects.push({e,left:r.left,right:r.right,top:r.top,bottom:r.bottom});let p=e.parentElement;while(p&&p!==root){const s=getComputedStyle(p),pr=p.getBoundingClientRect();if(['hidden','clip'].includes(s.overflowX)&&(r.left<pr.left-2||r.right>pr.right+2))issues.push({type:'money-clipped',...identify(e)});if(['auto','scroll'].includes(s.overflowY))break;p=p.parentElement;}}
 for(const e of root.querySelectorAll('*')){if(!visible(e))continue;for(const n of e.childNodes){if(n.nodeType!==3||!n.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(n);for(const box of range.getClientRects()){
   let clip={left:Math.max(0,box.left),right:Math.min(innerWidth,box.right),top:Math.max(0,box.top),bottom:Math.min(innerHeight,box.bottom)},p=e.parentElement;
   while(p){const ps=getComputedStyle(p),pr=p.getBoundingClientRect();if(ps.overflowX!=='visible'){clip.left=Math.max(clip.left,pr.left);clip.right=Math.min(clip.right,pr.right);}if(ps.overflowY!=='visible'){clip.top=Math.max(clip.top,pr.top);clip.bottom=Math.min(clip.bottom,pr.bottom);}p=p.parentElement;}
   if(clip.right-clip.left>2&&clip.bottom-clip.top>2){const hit=document.elementFromPoint((clip.left+clip.right)/2,(clip.top+clip.bottom)/2),header=hit&&hit.closest('.su-topbar,.sav-hero');if(header&&!header.contains(e))continue;textRects.push({e,...clip});}
 }}}
 for(let i=0;i<textRects.length;i++)for(let j=i+1;j<textRects.length;j++){const a=textRects[i],b=textRects[j];if(a.e===b.e||a.e.contains(b.e)||b.e.contains(a.e))continue;
  if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2){
   const pa=a.e.closest('[role="dialog"],.su-app-scroll,.sav-scroll,.sav-sheet'),pb=b.e.closest('[role="dialog"],.su-app-scroll,.sav-scroll,.sav-sheet');if(pa!==pb)continue;
   issues.push({type:'text-overlap',...identify(a.e),other:identify(b.e)});
  }
 }
 return {viewport:innerWidth,scale:root.dataset.textSize,bodyOverflow:document.documentElement.scrollWidth>innerWidth,issues};
});}
module.exports={root,privateDir,chromium,env,serve,login,inspect};
if(require.main===module)serve().then(value=>console.log(JSON.stringify({url:value.url,build:value.build}))).catch(error=>{console.error(error.message);process.exitCode=1;});
