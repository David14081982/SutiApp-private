'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium,webkit}=require(process.env.SUTIAPP_PLAYWRIGHT_MODULE || 'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const webkitRun=process.env.SUTIAPP_TEST_BROWSER==='webkit';
const out=process.env.SUTIAPP_TEST_EVIDENCE_DIR||path.join(require('os').tmpdir(),'sutiapp-beneficiaries-v2');fs.mkdirSync(out,{recursive:true});
const sourceRoot=process.argv[2]||'.',label=process.argv[2]?'release':'workspace';
async function main(){
 const browser=await (webkitRun?webkit:chromium).launch(webkitRun?{headless:true}:{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.abort());await page.setContent('<html><body style="margin:0"><div id="root" data-text-size="normal"></div></body></html>');
  const shell=fs.readFileSync(path.join(sourceRoot,'SutiApp.html'),'utf8');
  for(const style of shell.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g))await page.addStyleTag({content:style[1]});
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
  await page.locator('[data-savings-detail="beneficiaries"]').click();
  const flow=page.locator('.ben-v2');
  await flow.getByText('Persona de prueba',{exact:true}).waitFor();
  await flow.getByText(/Parentesco por confirmar/).waitFor();
  assert.equal(await flow.locator('[data-beneficiaries-balance]').getAttribute('data-beneficiaries-balance'),'1000');
  await flow.getByRole('button',{name:/Persona de prueba/}).click();
  await page.getByRole('dialog').getByText(/No acreditan la aceptación individual/).waitFor();
  await page.getByRole('button',{name:'Cerrar detalle',exact:true}).click();
  await page.screenshot({path:out+'/summary.png'});
  await flow.getByRole('button',{name:'Cambiar beneficiarios',exact:true}).click();
  await page.getByLabel('Nombre completo',{exact:true}).fill('Nombre actualizado');
  await page.getByLabel('Porcentaje',{exact:true}).fill('75');
  assert(await page.getByRole('button',{name:'Revisar cambios'}).isDisabled(),'partial distribution cannot confirm complete designation');
  await page.getByRole('button',{name:'Agregar beneficiario',exact:true}).click();
  await page.getByLabel('Nombre completo',{exact:true}).nth(1).fill('Segunda persona');
  await page.getByLabel('Porcentaje',{exact:true}).nth(1).fill('26');
  assert(await page.getByRole('button',{name:'Revisar cambios'}).isDisabled());
  await page.getByRole('alert').waitFor();
  await page.getByRole('group',{name:'Parentesco de beneficiario 2'}).getByRole('button',{name:'Hijo(a)',exact:true}).click();
  await page.getByLabel('Porcentaje',{exact:true}).nth(1).fill('25');
  await page.getByRole('button',{name:'Bajar 5 por ciento'}).nth(1).click();
  assert.equal(await page.getByLabel('Porcentaje',{exact:true}).nth(1).inputValue(),'20');
  await page.getByRole('button',{name:'Subir 5 por ciento'}).nth(1).click();
  assert.equal(await page.getByLabel('Porcentaje con deslizador').nth(1).inputValue(),'25');
  await page.getByLabel('Porcentaje con deslizador').nth(1).fill('10');
  await page.getByRole('button',{name:'Darle el 15% restante'}).nth(1).click();
  assert.equal(await page.getByLabel('Porcentaje',{exact:true}).nth(1).inputValue(),'25');
  await page.getByRole('button',{name:'Agregar beneficiario',exact:true}).click();
  await page.getByLabel('Nombre completo',{exact:true}).nth(2).fill('Tercera persona');
  await page.getByRole('button',{name:/Repartir en partes iguales/}).click();
  assert.deepEqual(await page.getByLabel('Porcentaje',{exact:true}).evaluateAll(es=>es.map(e=>e.value)),['33.33','33.33','33.34']);
  await page.getByRole('button',{name:'Quitar beneficiario 3',exact:true}).click();
  await page.getByRole('button',{name:'Quitar',exact:true}).click();
  await page.getByRole('button',{name:/Repartir en partes iguales/}).click();
  assert.deepEqual(await page.getByLabel('Porcentaje',{exact:true}).evaluateAll(es=>es.map(e=>e.value)),['50','50']);
  await page.getByRole('button',{name:'Revisar cambios'}).click();
  assert.equal(await page.evaluate(()=>calls.length),0,'review never persists');
  async function sign(touch=false){
   await page.getByRole('button',{name:/Firmar aquí/}).click();
   const canvas=page.getByRole('dialog').locator('canvas');await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox();
   if(touch&&!webkitRun){const cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+25,y:box.y+40}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+100,y:box.y+80}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
   else{await page.mouse.move(box.x+30,box.y+50);await page.mouse.down();await page.mouse.move(box.x+70,box.y+80,{steps:8});await page.mouse.move(box.x+130,box.y+40,{steps:8});await page.mouse.up();}
   await page.getByRole('button',{name:'Guardar firma',exact:true}).click();
   assert(await page.getByRole('button',{name:'Confirmar beneficiarios'}).isDisabled(),'consent is independent');
   await page.getByRole('checkbox').check();
  }
  await sign();
  await page.getByRole('button',{name:'Volver a editar'}).click();
  await page.getByLabel('Porcentaje',{exact:true}).nth(1).fill('45');
  await page.getByRole('button',{name:'Darle el 5% restante'}).nth(1).click();
  await page.getByRole('button',{name:'Revisar cambios'}).click();
  assert.equal(await page.getByRole('button',{name:/Firma capturada/}).count(),0,'edit invalidates signed distribution');
  await sign(true);
  await page.screenshot({path:out+'/review.png'});
  await page.evaluate(()=>fail=true);
  await page.getByRole('button',{name:'Confirmar beneficiarios'}).click();await page.getByRole('alert').waitFor();
  await page.getByRole('button',{name:'Confirmar beneficiarios'}).click();await page.getByRole('button',{name:'Entendido'}).waitFor();
  const savedCalls=await page.evaluate(()=>calls);
  assert.equal(savedCalls.length,2);assert.equal(savedCalls[0].key,savedCalls[1].key);
  assert.equal(savedCalls[1].rows.reduce((n,r)=>n+r.percentage,0),100);
  assert(savedCalls[1].authorization.signature.startsWith('data:image/png;base64,'));
  assert.equal(savedCalls[1].authorization.versionId,'v1');assert.equal(savedCalls[1].rows[0].relationship,null);
  assert.equal(savedCalls[1].rows[1].relationship,'Hijo(a)');assert.equal(await page.evaluate(()=>versions[0].version_id),'v1');
  await page.getByRole('button',{name:'Entendido'}).click();
  await flow.getByRole('button',{name:/Nombre actualizado/}).click();
  await page.getByRole('button',{name:'Ver firma',exact:true}).click();await page.getByRole('alert').waitFor();
  await page.getByRole('button',{name:'Cerrar detalle',exact:true}).click();
  await page.getByRole('button',{name:'Volver a Ahorro'}).click();
  await page.evaluate(()=>{readFail=true;identity='owner-b';mount();});await page.getByText('Revisar',{exact:true}).waitFor();
  await page.locator('[data-savings-detail="beneficiaries"]').click();await page.getByRole('alert').waitFor();
  assert.equal(await page.getByRole('button',{name:'Cambiar beneficiarios',exact:true}).count(),0);
  await page.evaluate(()=>{readFail=false;record={...record,beneficiaries:[],signatures:[],pending_count:2};});
  await page.getByRole('button',{name:'Reintentar',exact:true}).click();await page.getByText(/registros anteriores pendientes/).waitFor();
  await page.getByText('No hay beneficiarios registrados.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Cambiar beneficiarios',exact:true}).click();
  assert(await page.getByRole('button',{name:'Revisar cambios'}).isDisabled(),'empty cannot confirm');
  await page.getByLabel('Nombre completo',{exact:true}).fill('Persona sintética con nombre completo largo para verificar accesibilidad');
  await page.getByRole('group').getByRole('button',{name:'Hermano(a)',exact:true}).click();
  const matrix=[];
  for(const [width,height,size] of [[320,568,'normal'],[320,568,'largest'],[390,844,'large'],[412,915,'normal'],[430,932,'largest'],[1440,900,'normal']]){
   await page.setViewportSize({width,height});await page.evaluate(size=>document.getElementById('root').setAttribute('data-text-size',size),size);
   for(const stage of ['editor','review']){
    if(stage==='review')await page.getByRole('button',{name:'Revisar cambios'}).click();
    assert(await flow.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'flow overflow '+width+' '+size+' '+stage);
    assert(await flow.locator('.scroll').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'content overflow '+width+' '+size+' '+stage);
    const footer=await flow.locator('.bar').boundingBox();assert(footer.y>=0&&footer.y+footer.height<=height+1,'footer reachable');
    matrix.push({width,height,size,stage,status:'PASS'});
    if(stage==='review')await page.getByRole('button',{name:'Volver a editar'}).click();
   }
  }
  await page.setViewportSize({width:320,height:568});await page.evaluate(()=>document.getElementById('root').setAttribute('data-text-size','largest'));
  await page.screenshot({path:out+'/editor-small-largest.png'});
  await page.getByRole('button',{name:/Firmar aquí/}).click();
  assert(await page.getByRole('button',{name:'Guardar firma'}).isDisabled());
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.getByRole('button',{name:'Seguir editando'}).click();
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();await page.getByRole('button',{name:'Descartar cambios'}).click();
  await page.getByText('No hay beneficiarios registrados.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>versions.length),1,'one new fixture version; original retained');
  assert.deepEqual(errors,[]);
  const proof={status:'PASS',realWrites:0,textSizeMatrix:matrix,compiledBundle:!!process.env.SUTIAPP_TEST_BUNDLE_PATH,checks:['entry and real balance projection','summary/detail/empty/error','add/edit/remove confirmation','percentage input/slider/steps/rest','equal shares exact rounding','100 required and >100 rejected','whole-designation signature and independent consent','edit invalidates signature','same-key retry','version refresh','context switch','pending notice','normal/large/largest','touch signature','cancel keeps saved record']};
  proof.engine=webkitRun?'WebKit desktop (not physical iOS)':'Chrome desktop with touch emulation';
  if(webkitRun)proof.checks=proof.checks.filter(c=>c!=='touch signature');
  fs.writeFileSync(out+'/browser-'+label+(webkitRun?'-webkit':'')+'.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
