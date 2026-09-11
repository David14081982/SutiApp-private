'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert').strict;
const {chromium,webkit}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/text-size-small-20260911/navigation');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const names={home:['Inicio','Inic'],financiera:['Finanzas','Fina'],convenios:['Convenios','Conv'],historial:['Historial','Hist'],credencial:['Credencial','Cred'],admin:['Admin','Admi']};
const sizes={small:12.25,normal:14,large:16.1,largest:18.9};
async function settled(page,size){
 await page.locator('[data-nav-text-size="'+size+'"]').waitFor();
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
}
async function metrics(page){return page.evaluate(()=>{
 const nav=document.querySelector('[data-app-bottom-nav]'),nr=nav.getBoundingClientRect();
 return {horizontalOverflow:document.documentElement.scrollWidth>innerWidth,navOverflow:nav.scrollWidth>nav.clientWidth+1,paddingBottom:getComputedStyle(nav).paddingBottom,buttons:[...nav.querySelectorAll('[data-app-tab]')].map(b=>{
  const label=b.querySelector('span'),s=getComputedStyle(label),br=b.getBoundingClientRect(),lr=label.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(label);const tr=range.getBoundingClientRect(),icon=b.firstElementChild.getBoundingClientRect();
  // Independent DOM measurement of the complete label at active weight.
  const probe=document.createElement('span');probe.textContent=b.getAttribute('aria-label');Object.assign(probe.style,{position:'fixed',visibility:'hidden',fontFamily:s.fontFamily,fontSize:s.fontSize,fontWeight:'700',letterSpacing:s.letterSpacing,whiteSpace:'nowrap'});document.body.append(probe);const fullWidth=probe.getBoundingClientRect().width;probe.remove();
  return {id:b.dataset.appTab,label:label.textContent,aria:b.getAttribute('aria-label'),title:b.title,active:b.getAttribute('aria-current'),width:br.width,height:br.height,font:parseFloat(s.fontSize),line:parseFloat(s.lineHeight),labelHeight:lr.height,whiteSpace:s.whiteSpace,overflow:s.overflow,lines:range.getClientRects().length,textLeft:tr.left,textRight:tr.right,left:br.left,right:br.right,fullWidth,iconWidth:icon.width,iconOffset:(icon.left+icon.right-br.left-br.right)/2,labelOffset:(tr.left+tr.right-br.left-br.right)/2,navLeft:nr.left,navRight:nr.right};
 })};
});}
function validate(m,size){
 assert.equal(m.horizontalOverflow,false,'document overflow');assert.equal(m.navOverflow,false,'nav overflow');
 const widths=m.buttons.map(b=>b.width);assert(Math.max(...widths)-Math.min(...widths)<.6,'tabs must be uniform');
 for(const b of m.buttons){
  assert.equal(b.aria,names[b.id][0]);assert.equal(b.title,names[b.id][0]);assert.equal(b.whiteSpace,'nowrap');assert.equal(b.lines,1,'wrapped label '+b.id);
  assert(b.labelHeight<=b.line+1);assert(b.textLeft>=b.left-.6&&b.textRight<=b.right+.6,'overflow/clipping '+JSON.stringify(b));
  assert(b.left>=b.navLeft-.6&&b.right<=b.navRight+.6);assert(b.width>=47.5&&b.height>=47.5,'small target');
  assert(Math.abs(b.font-sizes[size])<.05,'font size changed');assert(Math.abs(b.iconOffset)<.6&&Math.abs(b.labelOffset)<.6,'off-center');
  assert(Math.abs(b.line/b.font-(size==='small'?1.45:1.4))<.01,'line-height proportion');
  assert.equal(b.iconWidth,b.active?46:40,'changed icon geometry');assert.equal(b.overflow,'visible','clipping workaround');
  const short=size==='largest'||b.fullWidth>b.width-1;assert.equal(b.label,names[b.id][short?1:0],'full name must survive while it fits');
 }
 for(let i=1;i<m.buttons.length;i++)assert(m.buttons[i-1].textRight<=m.buttons[i].textLeft,'overlapping labels');
}
async function mount(page){
 await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@500;700&display=swap"><style>'+read('SutiApp.html').match(/<style>([\s\S]*?)<\/style>/)[1]+'</style><style>'+read('app/text-size.css')+'</style><div id="root"></div>');
 for(const f of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js','app/icons.jsx'])await page.addScriptTag({content:read(f)});
 const s=read('app/app.jsx');await page.addScriptTag({content:s.slice(s.indexOf('  const TABS = ['),s.indexOf('  // ---------- NOTIFICATIONS ----------'))+'window.QA_BottomNav=BottomNav;'});
 await page.evaluate(()=>{
  const h=React.createElement;window.Res=({resKey,...p})=>h(Icon,{...p,name:({home:'home',financiera:'wallet',convenios:'tag',historial:'receipt',credencial:'idcard',admin:'shield'})[resKey.split('.')[1]]});
  window.qaRoot=ReactDOM.createRoot(document.getElementById('root'));
  function Fixture({size,showAdmin,hidden=[],adminOnly=false}){
   const [tab,setTab]=React.useState(adminOnly?'admin':'home');window.adminStore={tabHidden:id=>hidden.includes(id)};
   return h('div',{'data-text-size':tab==='admin'?undefined:size,style:{position:'absolute',inset:0,display:'flex',flexDirection:'column',fontFamily:'var(--font)'}},h('main',{style:{flex:1,padding:24}},'Contenido de prueba'),h(QA_BottomNav,{tab,textSize:size,showAdmin,adminOnly,setTab:id=>{window.lastTab=id;setTab(id);}}));
  }
  window.renderQA=props=>qaRoot.render(h(Fixture,{key:props.showAdmin+'-'+props.adminOnly,...props}));
 });
}
async function run(){
 fs.mkdirSync(out,{recursive:true});const results=[],errors=[];let checks=0;
 for(const [engine,type,opts]of [['chromium',chromium,{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}],['webkit',webkit,{}]]){
  const browser=await type.launch({headless:true,...opts});try{
   const page=await browser.newPage({viewport:{width:320,height:568},hasTouch:true,reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',r=>/https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(r.request().url())?r.continue():r.abort());
   await mount(page);
   for(const showAdmin of [false,true])for(const width of [320,360,375,390,430])for(const size of Object.keys(sizes)){
    await page.setViewportSize({width,height:568});await page.evaluate(props=>renderQA(props),{size,showAdmin});await settled(page,size);await page.evaluate(()=>document.fonts.ready);await settled(page,size);
    const first=await metrics(page);validate(first,size);checks++;
    for(const b of first.buttons){await page.locator('[data-app-tab="'+b.id+'"]').click();await settled(page,size);assert.equal(await page.evaluate(()=>lastTab),b.id);validate(await metrics(page),size);checks++;}
    if(showAdmin)assert.equal(await page.locator('[data-text-size]').count(),0,'Admin content must remain outside affiliate typography/portal scope');
    results.push({engine,width,size,tabs:first.buttons.length,labels:first.buttons.map(b=>b.label),status:'PASS'});
    if(showAdmin&&width===320)await page.screenshot({path:path.join(out,engine+'-320-'+size+'.png')});
   }
   // Preference update, resize, filter and one-tab Admin distributions stay reactive.
   await page.evaluate(()=>renderQA({size:'largest',showAdmin:true,hidden:['convenios']}));await settled(page,'largest');assert.equal((await metrics(page)).buttons.length,5);validate(await metrics(page),'largest');checks++;
   await page.evaluate(()=>renderQA({size:'normal',showAdmin:true,adminOnly:true}));await settled(page,'normal');assert.equal((await metrics(page)).buttons.length,1);validate(await metrics(page),'normal');checks++;
   // Missing web font remains readable without changing font size.
   await page.addStyleTag({content:':root { --font: system-ui; }'});await page.evaluate(()=>renderQA({size:'largest',showAdmin:true}));await settled(page,'largest');await page.setViewportSize({width:320,height:568});await settled(page,'largest');validate(await metrics(page),'largest');checks++;
   console.log(engine+' PASS');
  }finally{await browser.close();}
 }
 assert.deepEqual(errors,[]);const result={status:'PASS',scenarios:results.length,checks,results,errors,backendRequests:0,businessWrites:0,physicalDevices:false,fullNamesPreservedWhileTheyFit:true,fontSizes:sizes};fs.writeFileSync(path.join(out,'focal.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({status:'PASS',scenarios:results.length,checks}));
}
module.exports={names,sizes,metrics,validate,settled};
if(require.main===module)run().catch(e=>{console.error(e.stack);process.exitCode=1;});
