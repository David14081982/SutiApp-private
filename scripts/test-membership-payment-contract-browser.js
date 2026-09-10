'use strict';
// Isolated browser harness: real components, controlled RPC responses, no request submissions.
const fs=require('fs'),path=require('path'),assert=require('assert').strict;
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/membership-payment-contract-20260910');
const target=process.env.SUTIAPP_MEMBERSHIP_TEST_URL||'http://127.0.0.1:8767/';
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-gpu','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(target,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.MembershipApplicationScreen&&window.ReactDOM);
    await page.evaluate(()=>{
      document.getElementById('root').style.display='none';
      const host=document.createElement('div');host.id='membership-test';host.style.cssText='position:fixed;inset:0';document.body.appendChild(host);
      window.membershipTestRoot=ReactDOM.createRoot(host);
      window.membershipStore={get:()=>({id:'offering',empresa:'Membresía de prueba',concepto:'Prueba aislada',monto:99999,pagos:99})};
      window.DocumentWorkflowRepository={requirements:async()=>[],listSelfDocuments:async()=>[]};
      window.ProgramTermsRepository={current:async()=>({id:'terms'})};
      window.ProgramRequestRepository={newIdempotencyKey:()=> 'isolated-key',createMembership:async v=>{window.testSubmission=v;throw Error(window.testSubmitError||'ISOLATED_DO_NOT_SEND');}};
      window.MembershipRepository={paymentQuote:async()=>{
        if(window.testQuoteError)throw Error(window.testQuoteError);
        return {contract_version:'MEMBERSHIP_PAYMENT_V1',quote_hash:'a'.repeat(64),financialResult:window.testFinancial};
      }};
      window.mountMembershipTest=(key)=>window.membershipTestRoot.render(React.createElement(window.MembershipApplicationScreen,{key,params:{id:'offering'},app:{affiliate:{phone_raw:'6621234567',rfc_raw:'XAXX010101000',curp_raw:'GODE561231HDFRRN09'},back:()=>{window.testBack=true;}}}));
    });
    const cases=[];
    for(const width of [390,1440]){
      await page.setViewportSize({width,height:900});
      for(const [total,n,period] of [[200,2,'quincenal'],[350,2,'mensual'],[1100,2,'quincenal'],[123.45,4,'mensual']]){
        const regular=Math.round(total/n*100)/100,last=Math.round((total-regular*(n-1))*100)/100;
        await page.evaluate(({total,n,period,regular,last,key})=>{
          window.testQuoteError='';window.testFinancial={total,amount:total,paymentCount:n,paymentPeriod:period,paymentPerPeriod:regular,lastPayment:last,administrativeFeePerPayment:15,administrativeFeeTotal:15*n};window.mountMembershipTest(key);
        },{total,n,period,regular,last,key:width+':'+total});
        await page.waitForSelector('[data-membership-phase="ready"]');
        assert.equal(await page.locator('[data-membership-total]').getAttribute('data-membership-total'),String(total));
        assert.equal(await page.locator('[data-membership-installments]').getAttribute('data-membership-installments'),String(n));
        assert.equal(await page.locator('[data-membership-payment-period]').getAttribute('data-membership-payment-period'),period);
        assert.equal(await page.locator('[data-membership-fortnight]').getAttribute('data-membership-fortnight'),String(regular));
        assert.equal(await page.locator('[data-membership-included-fees]').getAttribute('data-membership-included-fees'),String(15*n));
        assert(await page.locator('.mr-figures').textContent().then(t=>t.includes(period==='mensual'?'Cada mes':'Cada quincena')));
        for(const selector of ['.mr-hero','.mr-figures','.mr-tracker','.mr-data','.mr-privacy','.mr-footer'])assert.equal(await page.locator('#membership-test '+selector).count(),1);
        assert.equal(await page.locator('[data-membership-submit]').isEnabled(),true);
        if(width===390&&total===350)await page.screenshot({path:path.join(out,'monthly-390.png')});
        cases.push({width,total,payments:n,period,status:'PASS'});
      }
    }
    // The selected server quote accompanies confirmation; stale conditions require another click.
    await page.evaluate(()=>{window.testSubmitError='MEMBERSHIP_CONDITIONS_CHANGED';window.testFinancial={...window.testFinancial,total:350,amount:350,paymentCount:2,paymentPerPeriod:175,lastPayment:175,administrativeFeeTotal:30};});
    await page.locator('[data-membership-submit]').click();
    await page.waitForFunction(()=>document.querySelector('.mr-alert')?.textContent.includes('condiciones de la membresía cambiaron'));
    assert.equal(await page.evaluate(()=>window.testSubmission.paymentQuoteHash),'a'.repeat(64));
    assert.equal(await page.locator('[data-membership-total]').getAttribute('data-membership-total'),'350');
    for(const code of ['authority unavailable','MEMBERSHIP_PAYROLL_CATEGORY_UNRESOLVED','MEMBERSHIP_INCLUDED_FEES_EXCEED_TOTAL']){
      await page.evaluate(code=>{window.testQuoteError=code;window.mountMembershipTest('failure:'+code);},code);
      await page.waitForSelector('[data-membership-phase="error"]');
      assert.equal(await page.locator('[data-membership-submit]').isDisabled(),true);
      assert.equal(await page.locator('.mr-figure-value').first().innerText(),'—');
      assert.equal(await page.locator('.mr-retry').count(),1);
    }
    assert.deepEqual(errors,[]);
    const result={status:'PASS',environment:'ISOLATED_BROWSER_HARNESS',cases,sectionsPreserved:true,staleQuoteRecovery:true,failClosed:true,productionWrites:0,pageErrors:0};
    fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
  }catch(e){await page.screenshot({path:path.join(out,'browser-failure.png')}).catch(()=>{});throw e;}
  finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
