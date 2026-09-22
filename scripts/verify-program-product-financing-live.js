'use strict';
// Production acceptance: real reads and ordinary ephemeral simulation sessions only.
// Never confirm a request, save a product, or call Google.
const fs=require('fs'),path=require('path'),assert=require('assert').strict,crypto=require('crypto');
const {sql,root}=require('./program-product-financing-admin');
const out=path.join(root,'docs/qa/evidence/program-product-financing-20260922');
const v={};for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const at=line.indexOf('=');if(at>0&&!line.startsWith('#'))v[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}
async function request(route,token,body){const r=await fetch(v.SUPABASE_URL+route,{method:body===undefined?'GET':'POST',headers:{apikey:v.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
async function login(alias){const r=await request('/auth/v1/token?grant_type=password',null,{email:v[alias+'_EMAIL'],password:v[alias+'_PASSWORD']});assert.equal(r.status,200,'LOGIN_'+alias);return r.data.access_token;}
async function edge(token,body){const r=await request('/functions/v1/financial-legacy',token,body);assert.equal(r.status,200,'EDGE_'+body.action+'_'+r.status+'_'+String(r.data.error||''));return r.data.data;}
async function main(){
 const admin=await login('H005_TEST');
 const options=await request('/rest/v1/rpc/get_program_product_financing_options',admin,{});assert.equal(options.status,200);assert(options.data.some(x=>x.type==='union'));assert(options.data.some(x=>x.type==='employment_category'));
 const denials=[];for(const token of [null]){const r=await request('/rest/v1/rpc/get_program_product_financing_options',token,{});assert([401,403].includes(r.status));denials.push(r.status);}
 const denied=await request('/rest/v1/rpc/resolve_program_product_financing',admin,{p_item_id:'00000000-0000-0000-0000-000000000000',p_affiliate_id:'00000000-0000-0000-0000-000000000000',p_base_rule:{},p_price:1});assert([401,403].includes(denied.status));
 const overview=await edge(admin,{action:'loanSessionOpen'}),caja=overview.programs.find(x=>x.program_id==='caja');assert(caja,'CAJA_ELIGIBLE');
 const items=await request('/rest/v1/program_catalog_items?select=id,price_cash,financing_config&enabled=eq.true&sold=eq.false&commercial_mode=eq.PAYROLL_FIXED&price_cash=gt.0&order=price_cash.asc&limit=1',admin);assert.equal(items.status,200);const item=items.data[0];assert(item);assert.equal(item.financing_config,null);
 const open=await edge(admin,{action:'programPaymentSessionOpen',program_item_id:item.id});assert.equal(open.status,'READY');assert.equal(open.program.rate,caja.rate);assert.equal(open.financingConditions.rate_source,'CAJA_CHICA');assert.equal(open.financingConditions.fund_program_id,'caja');
 const down=open.minimumDownPayment,term=open.program.allowed_terms[0]||open.program.custom_term.min;
 const quote=await edge(admin,{action:'programPaymentSessionQuote',snapshot_id:open.loanSession.id,down_payment:down,term});
 const ordinary=await edge(admin,{action:'loanSessionQuote',snapshot_id:overview.loanSession.id,program_id:caja.id,amount:quote.financedAmount,term});
 const financial=ordinary.financialResult||ordinary;
 for(const key of ['rate','interest','total','paymentCount','paymentPerPeriod'])assert.equal(quote.financialResult[key],financial[key],'INHERITED_'+key);
 assert.equal(quote.financingConditions.rate_source,'CAJA_CHICA');assert.equal(quote.googleResolutionCount,0);assert.equal(quote.minimumDownPayment,Math.max(0,Math.ceil((Number(item.price_cash)-caja.max_amount)*100)/100));
 const installed=(await sql("select (select count(*)::integer from program_catalog_items where financing_config is not null) configured_items,has_function_privilege('authenticated','public.confirm_program_product_financing(jsonb,jsonb,jsonb)','execute') browser_confirm,has_function_privilege('authenticated','public.resolve_program_product_financing(uuid,uuid,jsonb,numeric)','execute') browser_resolve,has_column_privilege('authenticated','public.program_catalog_items','financing_config','update') browser_update,(select count(*)::integer from program_financing_private.function_backup where applied_definition=pg_get_functiondef(signature::regprocedure)) exact_writer_backup"))[0];
 assert.equal(installed.configured_items,0);assert.equal(installed.browser_confirm,false);assert.equal(installed.browser_resolve,false);assert.equal(installed.browser_update,false);assert.equal(installed.exact_writer_backup,1);
 const report={status:'PASS',verifiedAt:new Date().toISOString(),adminOptions:options.data.length,denials:[...denials,denied.status],inheritedRate:caja.rate,rateSource:quote.financingConditions.rate_source,sameCajaQuote:true,minimumPreserved:true,installed,businessWrites:0,ephemeralSimulationSessions:2,googleWrites:0,requestConfirmation:'NOT EXECUTED',customRates:'ISOLATED TESTS ONLY',sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'supabase/functions/financial-legacy/index.ts'))).digest('hex')};
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'backend-live.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
