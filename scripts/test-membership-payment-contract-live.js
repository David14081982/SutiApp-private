'use strict';
// Read-only authenticated contract probe. Never submits requests or writes Google.
const fs=require('fs'),path=require('path'),assert=require('assert').strict;
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/membership-payment-contract-20260910');
const target=process.env.SUTIAPP_MEMBERSHIP_TEST_URL||'https://david14081982.github.io/SutiApp-private/';
const env=Object.fromEntries(fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/).filter(s=>s.trim()&&!s.trim().startsWith('#')&&s.includes('=')).map(s=>{const i=s.indexOf('=');return [s.slice(0,i).trim(),s.slice(i+1).trim().replace(/^['"]|['"]$/g,'')];}));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({serviceWorkers:'block'});await page.goto(target,{waitUntil:'domcontentloaded'});
  await page.locator('input[type="email"]').fill(env.H005_TEST_EMAIL);
  await page.locator('input[type="password"]').fill(env.H005_TEST_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated');
  const result=await page.evaluate(async()=>{
   const all=await window.MembershipRepository.list(),quotes=[];
   for(const m of all.filter(m=>m.enabled)){
    const q=await window.MembershipRepository.paymentQuote(m.id),f=q.financialResult;
    if(f.amount!==m.monto||f.total!==m.monto||f.paymentCount!==m.pagos||f.rate!==0||f.interest!==0||f.administrativeFeeTotal!==15*m.pagos||f.capital!==m.monto-15*m.pagos||f.fund!=='Vales y membresias')throw Error('LIVE_QUOTE_MISMATCH');
    quotes.push({company:m.empresa,amount:f.amount,total:f.total,payments:f.paymentCount,period:f.paymentPeriod,feesIncluded:f.administrativeFeeTotal,capital:f.capital});
   }
   return {status:'PASS',catalogCount:quotes.length,quotes};
  });
  assert(result.catalogCount>0);
  const anonymous=await fetch(env.SUPABASE_URL+'/rest/v1/rpc/get_current_membership_payment_quote',{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_membership_offering_id:'00000000-0000-4000-8000-000000000001'})});
  assert(!anonymous.ok);result.anonymousDenied=true;result.requestWrites=0;result.googleWrites=0;
  result.environment=target.startsWith('http://127.')?'LOCAL_CANDIDATE_LIVE_BACKEND':'PRODUCTION';
  fs.writeFileSync(path.join(out,'live-'+(result.environment==='PRODUCTION'?'production':'local')+'.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
