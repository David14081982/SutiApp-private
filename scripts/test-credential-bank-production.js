'use strict';
// Published credential acceptance; no bank values, tokens or PII in output.
const fs=require('fs'),path=require('path'),assert=require('assert').strict,crypto=require('crypto');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/credential-bank-isolation-20260911');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
async function main(){
  const base=process.argv[2]||'https://sutiapp.com/',e={};
  for(const line of fs.readFileSync(process.env.SUTIAPP_ENV_FILE||path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)e[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
  const expected=JSON.parse(fs.readFileSync(path.join(out,'release-preparation.json'),'utf8'));
  const htmlResponse=await fetch(base,{signal:AbortSignal.timeout(30000)});assert(htmlResponse.ok);const html=await htmlResponse.text();
  const bundlePath=html.match(/src="(app\/bundle\.js\?v=[^"]+)"/)[1];assert.equal(bundlePath,'app/bundle.js?v='+expected.bundleVersion);
  const response=await fetch(new URL(bundlePath,base),{signal:AbortSignal.timeout(30000)});assert(response.ok);assert.equal(sha(Buffer.from(await response.arrayBuffer())),expected.bundleSha256);
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-http2','--disable-quic']});
  const report={status:'PASS',url:base,bundleVersion:expected.bundleVersion,bundleSha256:expected.bundleSha256,checks:[],bankWrites:0};
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(45000);
    let broadReads=0,selfReads=0;
    page.on('request',r=>{const url=r.url();if(/\/rest\/v1\/affiliate_bank_accounts(?:\?|$)/.test(url))broadReads++;if(url.includes('/rpc/list_current_deposit_accounts'))selfReads++;if(/\/rpc\/(save_affiliate_bank_account|set_primary_affiliate_bank_account|delete_affiliate_bank_account)/.test(url))report.bankWrites++;});
    await page.addLocatorHandler(page.getByRole('button',{name:'Ahora no',exact:true}),b=>b.click());
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.locator('input[type=email]').fill(e.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(e.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
    await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated');
    async function verify(label){
      await page.getByRole('button',{name:'Credencial',exact:true}).click();await page.waitForSelector('[data-banking-phase=ready]');
      const proof=await page.evaluate(async()=>{
        const db=window.SutiSupabase.getClient(),identity=await db.rpc('get_effective_affiliate_id'),result=await window.BankAccountRepository.listDeposit();
        if(identity.error)throw Error('IDENTITY_READ_FAILED');
        const ids=[...document.querySelectorAll('[data-bank-account-id]')].map(n=>n.dataset.bankAccountId).sort();
        return {ownOnly:result.every(r=>r.affiliate_id===identity.data),exactCards:JSON.stringify(ids)===JSON.stringify(result.map(r=>r.id).sort()),cards:ids.length};
      });assert(proof.ownOnly&&proof.exactCards);assert.equal(broadReads,0);report.checks.push({label,...proof});
    }
    await verify('admin credential');await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated');await verify('authenticated refresh');
    assert(selfReads>=2);assert.equal(report.bankWrites,0);report.broadBankReads=broadReads;report.selfReads=selfReads;
    fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'production.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
  }finally{await browser.close();}
}
main().catch(e=>{console.error(JSON.stringify({status:'FAIL',error:e.message}));process.exitCode=1});
