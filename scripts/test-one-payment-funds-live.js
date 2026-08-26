'use strict';
const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
function env(){const out={};for(const raw of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const line=raw.trim();if(!line||line.startsWith('#')||!line.includes('='))continue;const at=line.indexOf('=');out[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}return out;}
async function json(url,options={}){const response=await fetch(url,options),text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}return{status:response.status,ok:response.ok,data};}
async function main(){
  const v=env();
  const login=await json(v.SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:v.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:v.H005_TEST_EMAIL,password:v.H005_TEST_PASSWORD})});
  if(!login.ok)throw new Error('LOGIN_'+login.status);
  const headers={apikey:v.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+login.data.access_token,'Content-Type':'application/json'};
  const overview=await json(v.SUPABASE_URL+'/functions/v1/financial-legacy',{method:'POST',headers,body:JSON.stringify({action:'overview'})});
  if(!overview.ok)throw new Error('OVERVIEW_'+overview.status);
  const funds=overview.data.data.programs.filter(item=>item.status==='AVAILABLE'&&item.custom_term&&item.custom_term.min===1&&item.custom_term.max===1);
  if(!funds.length)throw new Error('ONE_PAYMENT_FUNDS_NOT_EXPOSED');
  const verified=[];
  for(const fund of funds){
    if(fund.allowed_terms.length!==0)throw new Error('ONE_PAYMENT_SUGGESTIONS_MUST_BE_EMPTY_'+fund.id);
    const amount=Math.min(1000,fund.max_amount);
    const quote=await json(v.SUPABASE_URL+'/functions/v1/financial-legacy',{method:'POST',headers,body:JSON.stringify({action:'quote',program_id:fund.id,amount,term:1})});
    if(!quote.ok||quote.data.data.paymentCount!==1||quote.data.data.customTerm.max!==1)throw new Error('ONE_PAYMENT_QUOTE_FAILED_'+fund.id);
    verified.push({fund:fund.fund,max:fund.max_amount,rate:fund.rate,paymentCount:quote.data.data.paymentCount,paymentPerPeriod:quote.data.data.paymentPerPeriod});
  }
  console.log(JSON.stringify({status:'PASS',googleWrites:0,onePaymentFunds:verified.length,verified}));
}
main().catch(error=>{console.error(JSON.stringify({status:'FAIL',error:error.message}));process.exitCode=1;});
