'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert').strict;
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const out=path.join(root,'docs/qa/evidence/requests-workflow-google-sync-20260908');
async function main(){
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const errors=[],results=[];
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
    await page.setContent('<style>:root{--surface:#fff;--surface-2:#edf0f5;--bg:#f4f5f8;--hairline:#ddd;--ink:#162040;--ink-2:#475473;--ink-3:#8290ad;--guinda:#a80035;--guinda-50:#fff0f5;--grad-guinda-soft:#a80035}*{box-sizing:border-box}body{font-family:Arial;margin:0}button{font:inherit}</style><div id="root"></div>');
    for(const f of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({content:read(f)});
    await page.evaluate(()=>{
      window.Icon=()=>null;window.TopBar=()=>null;window.authListeners=new Set();window.authState={phase:'authenticated',session:{user:{id:'user-a'},access_token:'isolated-a'},affiliate:{id:'affiliate-a'}};
      window.AffiliateAuth={getState:()=>authState,subscribe:fn=>{authListeners.add(fn);return()=>authListeners.delete(fn);}};
      window.__context=id=>{authState=id?{phase:'authenticated',session:{user:{id:'user-'+id},access_token:'isolated-'+id},affiliate:{id:'affiliate-'+id}}:{phase:'anonymous'};authListeners.forEach(fn=>fn());};
      window.channels=[];window.__reads=0;window.__response=[];window.__hold=false;window.__pending=[];window.__error=false;
      window.ProgramRequestRepository={listHistory:async()=>{__reads++;if(__hold)return new Promise((resolve,reject)=>__pending.push({resolve,reject}));if(__error)throw Error('ISOLATED_NETWORK_FAILURE');return structuredClone(__response);}};
      const client={channel:()=>{const channel={callback:null,on(_event,_filter,fn){this.callback=fn;return this;},subscribe(){channels.push(this);return this;}};return channel;},removeChannel:channel=>{channels=channels.filter(c=>c!==channel);}};
      window.SutiSupabase={getClient:()=>client};window.__refresh=()=>channels.forEach(c=>c.callback());
      window.__set=(family,status)=>{const terminal=['approved','rejected','cancelled'].includes(status);const failure=['rejected','cancelled'].includes(status);__response=[{id:'request-1',folio:'QA-001',program_id:family,request_type:family==='prestamo'?'quote':'benefit',created_at:'2026-09-08T10:00:00.000Z',status,requested_amount:5000,requested_term:2,requested_term_semantics:'quincenal',productoNombre:family==='membership'?'Membresía de prueba':family==='puertas'?'Servicio de puertas':'Préstamo de prueba',decision_comment:failure?'Motivo real registrado por Finanzas':null,company_notes:'Texto del solicitante que no es un rechazo',workflow_state:{available:true,workflow_name:'Flujo '+family,workflow_version:7,active_note:terminal?null:'Revisión registrada',stages:[{id:'sent',label:'Solicitud enviada',state:'done',date:'2026-09-08T10:00:00.000Z'},{id:'review',label:family==='puertas'?'Validación del servicio':'Revisión de documentos',state:terminal?'done':'current',date:'2026-09-08T11:00:00.000Z'},{id:failure?'rejected':'approved',label:failure?'Solicitud rechazada':'Autorización',state:terminal?'done':'upcoming',date:terminal?'2026-09-08T12:00:00.000Z':null},...(!failure&&family==='puertas'?[{id:'delivery',label:'Entrega del servicio',state:'upcoming'}]:[])]}}];};
      __set('prestamo','in_review');window.app={push:()=>{},back:()=>window.__render('history'),setTab:()=>{},toast:()=>{}};
    });
    for(const f of ['app/private-resource-demand.js','app/ui.jsx','app/operations-store.jsx','app/screens-historial.jsx'])await page.addScriptTag({content:read(f)});
    await page.evaluate(()=>{window.root=ReactDOM.createRoot(document.getElementById('root'));window.__render=screen=>root.render(React.createElement(screen==='history'?HistorialScreen:TrackingScreen,{app,params:{s:{sourceId:'request-1',estado:'revision',tipo:'STALE ROUTE OBJECT'}}}));__render('tracking');});
    await page.getByText('Préstamo de prueba',{exact:true}).waitFor();assert.equal(await page.getByText('STALE ROUTE OBJECT').count(),0);
    for(const family of ['prestamo','membership','puertas']){
      for(const status of ['in_review','approved','rejected','cancelled']){
        await page.evaluate(({family,status})=>{__set(family,status);__refresh();},{family,status});
        const label={in_review:'En revisión',approved:'Aprobada',rejected:'Rechazada',cancelled:'Cancelada'}[status];await page.getByText(label,{exact:true}).waitFor();
        assert.equal(await page.getByText('EN CURSO',{exact:true}).count(),status==='in_review'?1:0);
        if(['rejected','cancelled'].includes(status)){await page.getByText('Motivo real registrado por Finanzas',{exact:true}).waitFor();assert.equal(await page.getByText('Texto del solicitante que no es un rechazo',{exact:true}).count(),0);}
        if(family==='puertas'&&!['rejected','cancelled'].includes(status))await page.getByText('Entrega del servicio',{exact:true}).waitFor();
        results.push({test:family+' '+status+' updates open tracking from persisted projection',result:'PASS'});
      }
    }
    await page.evaluate(()=>{__set('prestamo','approved');window.dispatchEvent(new Event('focus'));});await page.getByText('Aprobada',{exact:true}).waitFor();results.push({test:'foreground recovery without realtime delivery',result:'PASS'});
    for(const viewport of [{width:390,height:844},{width:768,height:1024},{width:1440,height:1000}]){
      await page.setViewportSize(viewport);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'history-'+viewport.width+'.png')});results.push({test:'tracking no horizontal overflow '+viewport.width,result:'PASS'});
    }
    // Hold an old identity's response while the authenticated context changes.
    await page.evaluate(()=>{__hold=true;__refresh();});await page.waitForFunction(()=>__pending.length===1);
    await page.evaluate(()=>{__context('b');});await page.waitForFunction(()=>__pending.length===2);
    assert.equal(await page.getByText('Préstamo de prueba',{exact:true}).count(),0,'old identity leaked during refresh');
    await page.evaluate(()=>{__pending[0].resolve(__response);__pending[1].resolve([]);__hold=false;});
    await page.getByText('La solicitud no está disponible en tu historial.',{exact:true}).waitFor();assert.equal(await page.getByText('Préstamo de prueba',{exact:true}).count(),0);assert.equal(await page.evaluate(()=>channels.length),1);
    results.push({test:'identity switch discards late private response and replaces subscription',result:'PASS'});
    await page.evaluate(()=>{__context(null);});assert.equal(await page.evaluate(()=>channels.length),0);assert.equal(await page.evaluate(()=>operationsStore.all().length),0);results.push({test:'logout clears private state and realtime channel',result:'PASS'});
    await page.evaluate(()=>{__error=true;__context('a');});await page.getByText('No pudimos actualizar el seguimiento.',{exact:true}).waitFor();
    await page.evaluate(()=>{__error=false;__set('membership','submitted');});await page.getByRole('button',{name:'Reintentar',exact:true}).click();await page.getByText('Enviada',{exact:true}).waitFor();
    results.push({test:'failed read is explicit and retry rereads canonical status',result:'PASS'});
    await page.evaluate(()=>__render('history'));await page.getByText('Membresía de prueba',{exact:true}).first().waitFor();
    await page.evaluate(()=>{__set('membership','approved');window.dispatchEvent(new Event('suti:request-changed'));});await page.getByText('Aprobada',{exact:true}).waitFor();
    results.push({test:'history list receives same mutation invalidation and preserves filters',result:'PASS'});
    await page.evaluate(()=>root.unmount());assert.equal(await page.evaluate(()=>channels.length),0);assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'candidate-browser.json'),JSON.stringify({status:'PASS',environment:'isolated actual React screens and store',results,errors},null,2)+'\n');console.log(JSON.stringify({status:'PASS',cases:results.length,errors}));
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
