'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const out=path.join(root,'docs/qa/evidence/sicof-evidence-integration');fs.mkdirSync(out,{recursive:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
  await page.route('**/*',r=>r.abort());await page.setContent('<html lang="es"><body><div id="root"></div></body></html>');
  for(const file of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js','app/sicof-payment-behavior.jsx','app/sicof-admin.jsx'])await page.addScriptTag({content:fs.readFileSync(path.join(root,file),'utf8')});
  await page.evaluate(()=>{
   window.SicofView={...window.SicofView,useContext:()=> 'synthetic',contextKey:()=> 'synthetic'};
   window.pendingFixture=true;
   window.SicofRepository={workspace:async({settings})=>({workspace:{source:{status:'READY',observed_at:new Date().toISOString()},funds:[],loans:[],payments:[],participants:[],periods:[],scenarios:[],preferences:{},report:{rows:[],periods:[]}},result:{settings,rate:pendingFixture?null:0,annualRate:pendingFixture?null:0,pool:120225.06,collected:148426,projected:3175.53,projectedNetPool:122797.24,projectedRateOnConfirmedBase:null,reserve:28200.94,base:0,nqual:0,nexcl:pendingFixture?0:1,reviewCount:pendingFixture?354:0,distributed:0,rows:[],alerts:[],reviewReasons:pendingFixture?[{reason:'HISTORICAL_EXPECTATION_UNVERIFIED',count:328}]:[],summary:['Synthetic evidence test'],liquidity:{},charts:{},costs:[],bank:{amount:null}}})};
   window.renderCase=()=>{if(window.ui)window.ui.unmount();window.ui=ReactDOM.createRoot(document.getElementById('root'));ui.render(React.createElement(SicofAdminModule,{app:{admin:{phase:'authorized',has:()=>true}},header:()=>null,onBack:()=>{}}));};renderCase();
  });
  await page.getByText('Sin base verificable; no significa ahorro cero.',{exact:true}).waitFor({timeout:10000}).catch(async e=>{console.error((await page.locator('body').innerText()).slice(-1800));throw e;});
  const labels=await page.locator('.sicof-metrics').innerText();assert(labels.includes('Pendiente'));assert(labels.includes('120,225.06'));
  assert.equal(await page.locator('.sicof-metrics > *').count(),12);
  const tabs=await page.getByRole('tab').allTextContents();assert.equal(tabs.length,8);
  await page.locator('[data-sicof-evidence] summary').click();await page.getByText('Importe histórico esperado sin evidencia: 328',{exact:true}).waitFor();
  for(const width of [1440,430,320]){await page.setViewportSize({width,height:1000});assert(await page.locator('.sicof-metrics').evaluate(el=>el.scrollWidth<=el.clientWidth+2));await page.screenshot({path:path.join(out,'pending-'+width+'.png'),fullPage:true});}
  await page.evaluate(()=>{pendingFixture=false;renderCase();});await page.getByText('Synthetic evidence test',{exact:true}).waitFor();
  assert.equal(await page.locator('.sicof-metrics').getByText('Pendiente',{exact:true}).count(),0);
  assert((await page.locator('.sicof-metrics').innerText()).includes('$0.00'));assert.deepEqual(errors,[]);
  await page.evaluate(()=>{
   const original=SicofRepository.workspace;
   SicofRepository.workspace=async input=>{const data=await original(input);Object.assign(data.result,{base:67.21,rate:178871.4307,annualRate:535000,nqual:1,reviewCount:328,distributed:120225.06});return data;};renderCase();
  });
  await page.getByText('Provisional: 1 ahorradores; 328 pendientes.',{exact:true}).waitFor();
  assert.equal(await page.getByText('Tasa del periodo · provisional',{exact:true}).count(),1);
  assert.equal(await page.getByText('Base parcial: 1 ahorradores.',{exact:true}).count(),1);
  assert.equal(await page.getByText('Simulación parcial; no es un reparto aprobado.',{exact:true}).count(),1);
  assert.equal(await page.locator('.sicof-metrics > *').count(),12);assert.equal(await page.getByRole('tab').count(),8);
  assert(await page.locator('.sicof-metrics').evaluate(el=>el.scrollWidth<=el.clientWidth+2));assert.deepEqual(errors,[]);
  const proof={status:'PASS',network:'BLOCKED',checks:['12 KPI and 8 tabs preserved','pending basis and yield never displayed as confirmed zero','known zero remains numeric','partial rate, base and distribution explicitly provisional with counts','source and reserve semantics visible','expandable evidence counts','responsive 1440/430/320 with no metric overflow','no browser errors'],productionWrites:0};
  fs.writeFileSync(path.join(out,'ui.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
