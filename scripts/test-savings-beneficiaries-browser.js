'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_MODULE || 'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const out=process.env.SUTIAPP_TEST_EVIDENCE_DIR||'docs/qa/evidence/savings-beneficiaries-frontend-20260920';fs.mkdirSync(out,{recursive:true});
const sourceRoot=process.argv[2]||'.',label=process.argv[2]?'release':'workspace';
async function main(){
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.abort());await page.setContent('<html><body style="margin:0"><div id="root" data-text-size="normal"></div></body></html>');
  await page.addStyleTag({content:'*{box-sizing:border-box}body{font-family:Arial,sans-serif;--wine:#701832;--ink:#17212d;--muted:#596273;--line:#ddd;--surface:#fff}'+fs.readFileSync(path.join(sourceRoot,'app/text-size.css'),'utf8')});
  for(const f of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js','app/icons.jsx','app/signature.jsx','app/savings-request-form.jsx','app/screens-savings.jsx']){let content=fs.readFileSync(path.join(sourceRoot,f),'utf8');if(process.env.SUTIAPP_TEST_BUNDLE_PATH&&!f.includes('/vendor/')){const bundle=fs.readFileSync(process.env.SUTIAPP_TEST_BUNDLE_PATH,'utf8'),marker='/* @@file '+path.basename(f)+' */',start=bundle.indexOf(marker),end=bundle.indexOf('/* @@file ',start+marker.length);assert(start>=0,'compiled chunk '+f);content=bundle.slice(start,end<0?undefined:end);}await page.addScriptTag({content});}
  await page.evaluate(()=>{
   window.versions=[];window.calls=[];window.fail=false;window.readFail=false;window.identity='owner-a';window.identityListeners=[];
   let key=0;window.crypto.randomUUID=()=>`isolated-key-${++key}`;
   window.record={version_id:'v1',can_edit:true,beneficiaries:[{id:'b1',full_name:'Persona de prueba',relationship:null,percentage:100}],signatures:[{status:'MISSING'}],pending_count:0};
   window.dashboard={participant:{id:'p'},balances:{capital:900,yield_amount:100,total:1000,available:1000},annual:[{year:2026,capital:900,yield:100,closed:false}],enrollment:{status:'Ahorrando',current_contribution_amount:500,frequency:'TWICE_MONTHLY',enrollment_started_at:'2026-01-15'},actions:{WITHDRAW:false,CHANGE_AMOUNT:false,TERMINATE:false,JOIN:false},write_capabilities:{requests:false,beneficiaries:false},history:[],withdrawals:[],beneficiaries:[],requests:[],upcoming:[]};
   window.SavingsRepository={getSelfIdentityKey:()=>identity,clearSelfCache:()=>{},getJoinContext:async()=>({can_join:false}),getBeneficiaries:async()=>{if(readFail)throw Error('NETWORK');return structuredClone(record);},replaceBeneficiaries:async(rows,key,authorization)=>{calls.push({rows,key,authorization});if(fail){fail=false;throw Error('NETWORK');}versions.push(structuredClone(record));record={...record,version_id:'v'+(versions.length+1),beneficiaries:rows.map((r,i)=>({...r,id:'new-'+i})),signatures:[{status:'STORED',path:'private/test.png'}]};},getBeneficiarySignature:async()=>{throw Error('NETWORK');}};
   window.useSavingsStore=()=>({state:()=>({self:dashboard,selfPhase:'ready'}),loadSelf:async()=>{}});
   window.SavingsBalanceReadModel={select:s=>({status:'ready',value:s.self.balances.total,label:'$1,000.00'})};
   window.root=ReactDOM.createRoot(document.getElementById('root'));window.mount=()=>root.render(React.createElement(SavingsScreen,{app:{back:()=>{}}}));mount();
  });
  await page.getByText('1 registrados',{exact:true}).waitFor();
  assert(await page.locator('[data-savings-action="WITHDRAW"]').isDisabled());
  await page.screenshot({path:out+'/savings-390.png'});
  await page.locator('[data-savings-detail="beneficiaries"]').click();await page.getByText('Persona de prueba',{exact:true}).waitFor();
  await page.getByText(/Parentesco por confirmar/).waitFor();await page.getByRole('button',{name:'Actualizar beneficiarios',exact:true}).click();
  await page.getByLabel('Nombre completo',{exact:true}).fill('Nombre actualizado');await page.getByLabel('Porcentaje',{exact:true}).fill('75');
  assert.equal(await page.getByRole('button',{name:'Revisar beneficiarios'}).isDisabled(),false);
  await page.getByRole('button',{name:'Agregar beneficiario'}).click();await page.getByLabel('Nombre completo',{exact:true}).nth(1).fill('Segunda persona');await page.getByLabel('Porcentaje',{exact:true}).nth(1).fill('26');
  assert(await page.getByRole('button',{name:'Revisar beneficiarios'}).isDisabled());await page.getByRole('alert').waitFor();
  await page.getByLabel('Parentesco (opcional)',{exact:true}).nth(1).fill('Hija');await page.getByLabel('Porcentaje',{exact:true}).nth(1).fill('25');await page.getByRole('button',{name:'Revisar beneficiarios'}).click();
  assert(await page.getByRole('button',{name:'Confirmar beneficiarios'}).isDisabled());
  async function sign(){const canvas=page.locator('canvas');await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox();await page.mouse.move(box.x+30,box.y+50);await page.mouse.down();await page.mouse.move(box.x+70,box.y+80,{steps:8});await page.mouse.move(box.x+130,box.y+40,{steps:8});await page.mouse.up();assert(await page.getByRole('button',{name:'Confirmar beneficiarios'}).isDisabled(),'consent required independently of signature');await page.getByRole('checkbox').check();}
  await sign();assert.equal(await page.getByRole('button',{name:'Confirmar beneficiarios'}).isDisabled(),false);
  await page.getByLabel('Porcentaje',{exact:true}).nth(1).fill('20');assert.equal(await page.locator('canvas').count(),0,'editing invalidates signature/review');
  await page.getByRole('button',{name:'Revisar beneficiarios'}).click();assert(await page.getByRole('button',{name:'Confirmar beneficiarios'}).isDisabled());
  await sign();await page.screenshot({path:out+'/signature-390.png'});await page.evaluate(()=>fail=true);
  await page.getByRole('button',{name:'Confirmar beneficiarios'}).click();await page.getByRole('alert').waitFor();
  await page.getByRole('button',{name:'Confirmar beneficiarios'}).click();await page.getByRole('button',{name:'Entendido'}).waitFor();
  const calls=await page.evaluate(()=>calls);assert.equal(calls.length,2);assert.equal(calls[0].key,calls[1].key);assert.equal(calls[1].rows.reduce((n,r)=>n+r.percentage,0),95);assert(calls[1].authorization.signature.startsWith('data:image/png;base64,'));assert.equal(calls[1].authorization.versionId,'v1');assert.equal(calls[1].rows[0].relationship,null);assert.equal(calls[1].rows[1].relationship,'Hija');assert.equal(await page.evaluate(()=>versions[0].version_id),'v1');
  await page.getByRole('button',{name:'Entendido'}).click();await page.getByText('Nombre actualizado',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Ver firma',exact:true}).click();await page.getByRole('alert').waitFor();
  await page.getByRole('button',{name:'Actualizar beneficiarios',exact:true}).click();
  await page.getByRole('button',{name:'Quitar de esta propuesta'}).first().click();await page.getByRole('button',{name:'Quitar de esta propuesta'}).first().click();
  await page.getByRole('button',{name:'Revisar beneficiarios'}).click();await sign();await page.getByRole('button',{name:'Confirmar beneficiarios'}).click();await page.getByRole('button',{name:'Entendido'}).click();await page.getByText('No hay beneficiarios registrados.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Cerrar',exact:true}).click();
  await page.evaluate(()=>{readFail=true;identity='owner-b';mount();});await page.getByText('Revisar',{exact:true}).waitFor();
  await page.locator('[data-savings-detail="beneficiaries"]').click();await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('button',{name:'Actualizar beneficiarios',exact:true}).count(),0);
  await page.evaluate(()=>{readFail=false;record={...record,pending_count:2};});await page.getByRole('button',{name:'Reintentar',exact:true}).click();await page.getByText(/registros anteriores pendientes/).waitFor();
  // New entry/relogin reads the authoritative fixture again; no browser business cache.
  await page.evaluate(()=>{root.unmount();document.getElementById('root').replaceChildren();root=ReactDOM.createRoot(document.getElementById('root'));identity='owner-b-new-session';mount();});
  await page.getByText('0 registrados',{exact:true}).waitFor();await page.locator('[data-savings-detail="beneficiaries"]').click();await page.getByText('No hay beneficiarios registrados.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Actualizar beneficiarios',exact:true}).click();await page.getByRole('button',{name:'Agregar beneficiario'}).click();await page.getByLabel('Nombre completo',{exact:true}).fill('Persona sintetica mobile');await page.getByLabel('Parentesco (opcional)',{exact:true}).fill('Hermana');await page.getByLabel('Porcentaje',{exact:true}).fill('100');await page.getByRole('button',{name:'Revisar beneficiarios'}).click();
  const matrix=[];
  for(const width of [320,390,1440])for(const size of ['normal','large','largest']){await page.setViewportSize({width,height:900});await page.evaluate(size=>document.getElementById('root').setAttribute('data-text-size',size),size);await page.waitForTimeout(80);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert(await page.locator('[data-savings-sheet="edit-beneficiaries"]').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'sheet overflow '+width+' '+size);await page.getByRole('button',{name:'Confirmar beneficiarios'}).scrollIntoViewIfNeeded();await page.screenshot({path:out+'/form-'+width+'-'+size+'.png'});matrix.push({width,size,status:'PASS'});}
  await sign();await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);assert(await page.getByRole('button',{name:'Confirmar beneficiarios'}).isDisabled(),'orientation invalidates cleared canvas signature');
  // Touch input on the real signature canvas.
  const canvas=page.locator('canvas');await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox(),cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+25,y:box.y+40}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+100,y:box.y+80}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
  await page.getByText('Firma capturada',{exact:true}).waitFor();assert(await page.getByRole('button',{name:'Confirmar beneficiarios'}).isDisabled());await page.getByRole('checkbox').check();assert.equal(await page.getByRole('button',{name:'Confirmar beneficiarios'}).isDisabled(),false);
  const callsBeforeClear=await page.evaluate(()=>calls.length);await page.getByRole('button',{name:'Borrar',exact:true}).click();assert(await page.getByRole('button',{name:'Confirmar beneficiarios'}).isDisabled());assert.equal(await page.evaluate(()=>calls.length),callsBeforeClear,'clear signature must not submit');
  assert.equal(await page.evaluate(()=>versions.length),2,'two saved fixture versions; original history retained');

  assert.deepEqual(errors,[]);const proof={status:'PASS',realWrites:0,textSizeMatrix:matrix,compiledBundle:!!process.env.SUTIAPP_TEST_BUNDLE_PATH,viewports:[320,390,1440],checks:['existing financial controls remain disabled','read/edit/add/remove','total <=100','signature and consent','edit invalidates signature','retry same key','saved version refresh','missing historical signature','source/signature errors','context switch','pending notice','normal/large/largest','relogin/remount','historical versions preserved','touch signature','resize invalidates signature','clear does not submit']};
  fs.writeFileSync(out+'/browser-'+label+'.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
