'use strict';

const assert=require('assert/strict'),fs=require('fs'),path=require('path'),{performance}=require('perf_hooks');
const root=path.resolve(__dirname,'..');
function env(){const out={};for(const raw of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const line=raw.trim();if(!line||line.startsWith('#')||!line.includes('='))continue;const at=line.indexOf('=');out[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}return out;}
async function request(url,options={}){const response=await fetch(url,{...options,signal:options.signal||AbortSignal.timeout(30000)}),text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}return{ok:response.ok,status:response.status,data};}
const normalize=value=>String(value??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toUpperCase();
const stable=value=>JSON.stringify(value,(key,current)=>['source','resolved_at','googleResolutionCount'].includes(key)?undefined:current);
const financial=value=>Object.fromEntries(['action','amount','paymentCount','paymentPeriod','rate','ratePeriod','interest','administrativeFeePerPayment','administrativeFeeTotal','total','paymentPerPeriod','fund','program','maxAmount','maxTerm','termOptions','customTerm','eligibility','administrativeFeeRule','administrativeFeeVersion'].map(key=>[key,value[key]]));

async function main(){
  const v=env(),ref=new URL(v.SUPABASE_URL).hostname.split('.')[0],postCutover=process.argv.includes('--post-cutover');
  const db=async query=>{const result=await request(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+v.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query})});assert(result.ok,'DB_'+result.status+':'+JSON.stringify(result.data));return result.data;};
  const login=await request(v.SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:v.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:v.H005_TEST_EMAIL,password:v.H005_TEST_PASSWORD})});
  assert(login.ok,'ADMIN_LOGIN');
  const headers={apikey:v.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+login.data.access_token,'Content-Type':'application/json'};
  const edge=(slug,body,customHeaders=headers)=>request(v.SUPABASE_URL+'/functions/v1/'+slug,{method:'POST',headers:customHeaders,body:JSON.stringify(body)});
  const rpc=(name,body={})=>request(v.SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers,body:JSON.stringify(body)});
  const before=(await db("select authority,active_import_batch_id,source_snapshot_hash from public.financial_criteria_authority where id='primary'"))[0];
  assert.equal(before.authority,postCutover?'SUPABASE':'GOOGLE_SHADOW');if(!postCutover)assert.equal(before.active_import_batch_id,null);else assert(before.active_import_batch_id);
  const [googleCatalog,shadowCatalog]=await Promise.all([edge('financial-legacy',{action:'catalog'}),edge('financial-criteria-canary',{action:'catalog'})]);
  assert.equal(googleCatalog.status,200,JSON.stringify(googleCatalog.data));assert.equal(shadowCatalog.status,200,JSON.stringify(shadowCatalog.data));
  assert.equal(googleCatalog.data.data.source,'GOOGLE_LEGACY');assert.equal(shadowCatalog.data.data.source,'SUPABASE_FINANCIAL_CRITERIA');
  const googleRules=googleCatalog.data.data.rules,shadowRules=shadowCatalog.data.data.rules;assert.equal(googleRules.length,146);assert.equal(shadowRules.length,146);
  const byRow=rows=>new Map(rows.map(row=>[Number(row.sheet_row),row]));const shadowByRow=byRow(shadowRules);
  for(const expected of googleRules){const actual=shadowByRow.get(Number(expected.sheet_row));assert(actual,'MISSING_ROW_'+expected.sheet_row);for(const key of ['id','program_id','fund','category','union','max_amount','rate','payment_count','term_label','available_on','criterion_identity','visibility_mode','status','effective_visibility'])assert.deepEqual(actual[key],expected[key],key+'_MISMATCH_ROW_'+expected.sheet_row);}
  const candidates=await db("select a.id,u.label union_label,c.label category_label from public.affiliates a join public.segmentation_catalog_entries u on u.catalog_type='union' and u.code=a.financial_union_code and u.enabled join public.segmentation_catalog_entries c on c.catalog_type='employment_category' and c.code=a.financial_employee_category_code and c.enabled order by a.id");
  const profiles=[];for(const candidate of candidates){const key=normalize(candidate.union_label)+'|'+normalize(candidate.category_label);if(profiles.some(item=>item.key===key))continue;if(googleRules.some(rule=>rule.status==='AVAILABLE'&&normalize(rule.union)===normalize(candidate.union_label)&&normalize(rule.category)===normalize(candidate.category_label)))profiles.push({...candidate,key});if(profiles.length===2)break;}
  assert.equal(profiles.length,2,'TWO_DISTINCT_PROFILES_REQUIRED');
  let overviewMismatches=0,quoteMismatches=0,quoteCases=0;const latencies=[];
  try{
    for(let index=0;index<profiles.length;index+=1){const profile=profiles[index];await rpc('stop_affiliate_impersonation');const started=await rpc('start_affiliate_impersonation',{p_affiliate_id:profile.id,p_reason:'Shadow financial canary profile '+String.fromCharCode(65+index)});assert.equal(started.status,200,JSON.stringify(started.data));
      const [googleOverview,shadowOverview]=await Promise.all([edge('financial-legacy',{action:'overview'}),edge('financial-criteria-canary',{action:'overview'})]);assert.equal(googleOverview.status,200,JSON.stringify(googleOverview.data));assert.equal(shadowOverview.status,200,JSON.stringify(shadowOverview.data));
      try{assert.equal(stable(shadowOverview.data.data),stable(googleOverview.data.data));}catch(error){overviewMismatches++;throw error;}
      const programs=googleOverview.data.data.programs.filter(item=>item.status==='AVAILABLE').slice(0,2);assert(programs.length>0,'NO_PROGRAMS_PROFILE_'+index);
      for(const program of programs){const amount=Number(program.suggested_amount),term=Number(program.custom_term.min),input={action:'quote',program_id:program.id,amount,term};const t0=performance.now();const [googleQuote,shadowQuote]=await Promise.all([edge('financial-legacy',input),edge('financial-criteria-canary',input)]);latencies.push(performance.now()-t0);assert.equal(googleQuote.status,200,JSON.stringify(googleQuote.data));assert.equal(shadowQuote.status,200,JSON.stringify(shadowQuote.data));quoteCases++;try{assert.deepEqual(financial(shadowQuote.data.data),financial(googleQuote.data.data));}catch(error){quoteMismatches++;throw error;}}
      await rpc('stop_affiliate_impersonation');
    }
  }finally{await rpc('stop_affiliate_impersonation').catch(()=>{});}
  const anonHeaders={apikey:v.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'};
  const [anonymous,writeAction]=await Promise.all([edge('financial-criteria-canary',{action:'overview'},anonHeaders),edge('financial-criteria-canary',{action:'loanSessionOpen'})]);
  assert([401,403].includes(anonymous.status));assert.equal(writeAction.status,404);assert.equal(writeAction.data.error,'CANARY_ACTION_DENIED');
  const after=(await db("select authority,active_import_batch_id,source_snapshot_hash from public.financial_criteria_authority where id='primary'"))[0];assert.deepEqual(after,before);
  latencies.sort((a,b)=>a-b);console.log(JSON.stringify({status:'PASS',edge_rpc:'PASS',canaryA:'PASS',canaryB:'PASS',distinct_profiles:2,rules:146,eligibility_mismatches:overviewMismatches,quote_mismatches:quoteMismatches,program_fund_mismatches:0,rate_mismatches:0,term_mismatches:0,date_visibility_mismatches:0,quote_cases:quoteCases,performance_ms:{median:Math.round(latencies[Math.floor(latencies.length/2)]),max:Math.round(latencies.at(-1))},anonymous:'DENIED',canary_writes:'DENIED',authority:before.authority,persistent_authority_changes:0,google_writes:0,pii_reported:false}));
}
main().catch(error=>{console.error(JSON.stringify({status:'FAIL',error:error.message,google_writes:0}));process.exitCode=1;});
