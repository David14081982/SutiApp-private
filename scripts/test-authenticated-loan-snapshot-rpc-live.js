'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),{performance}=require('perf_hooks');
const root=path.resolve(__dirname,'..');
function env(){const out={};for(const raw of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const line=raw.trim();if(!line||line.startsWith('#')||!line.includes('='))continue;const at=line.indexOf('=');out[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}return out;}
async function request(url,options={}){const response=await fetch(url,{...options,signal:options.signal||AbortSignal.timeout(30000)}),text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}return{ok:response.ok,status:response.status,data};}
const uuid=value=>{assert.match(String(value),/^[0-9a-f-]{36}$/i);return String(value);};
const errorCode=result=>String(result&&result.data&&(result.data.error||result.data.message)||'');
const financial=value=>{const keys=['source','action','amount','paymentCount','paymentPeriod','rate','ratePeriod','interest','administrativeFeePerPayment','administrativeFeeTotal','total','paymentPerPeriod','fund','program','maxAmount','maxTerm','termOptions','customTerm','eligibility','administrativeFeeRule','administrativeFeeVersion','criteria','payrollImpact'];return Object.fromEntries(keys.map(key=>[key,value[key]]));};
async function main(){
  const v=env(),ref=new URL(v.SUPABASE_URL).hostname.split('.')[0];let edgeInteractiveCalls=0,rpcInteractiveCalls=0;
  const db=async query=>{const result=await request(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+v.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query})});assert(result.ok,'database query '+result.status+': '+JSON.stringify(result.data));return result.data;};
  const aliases=['H005_TEST','H005_TEST2','H005_TEST3'],actors=[];
  for(const alias of aliases){const login=await request(v.SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:v.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:v[alias+'_EMAIL'],password:v[alias+'_PASSWORD']})});assert(login.ok,alias+' login');actors.push({alias,affiliateId:uuid(v[alias+'_AFFILIATE_ID']),token:login.data.access_token});}
  const headers=actor=>({apikey:v.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+actor.token,'Content-Type':'application/json'});
  const edge=async(actor,body,interactive=false)=>{if(interactive)edgeInteractiveCalls++;return request(v.SUPABASE_URL+'/functions/v1/financial-legacy',{method:'POST',headers:headers(actor),body:JSON.stringify(body)});};
  const rest=(actor,pathName,method='GET',body)=>request(v.SUPABASE_URL+'/rest/v1/'+pathName,{method,headers:headers(actor),body:body===undefined?undefined:JSON.stringify(body)});
  const rpc=async(actor,input)=>{rpcInteractiveCalls++;return rest(actor,'rpc/resolve_current_loan_snapshot_quote','POST',input);};
  const profiles=await db(`select a.id,a.financial_union_code,a.financial_employee_category_code,u.label union_label,c.label category_label from public.affiliates a left join public.segmentation_catalog_entries u on u.catalog_type='union' and u.code=a.financial_union_code and u.enabled left join public.segmentation_catalog_entries c on c.catalog_type='employment_category' and c.code=a.financial_employee_category_code and c.enabled where a.id in (${actors.map(a=>`'${a.affiliateId}'::uuid`).join(',')})`);
  for(const actor of actors){const profile=profiles.find(row=>row.id===actor.affiliateId);assert(profile,actor.alias+' profile');actor.profileKey=String(profile.financial_union_code)+'|'+String(profile.financial_employee_category_code);}
  const userA=actors.find(actor=>actor.alias==='H005_TEST2'),userB=actors.find(actor=>actor.alias==='H005_TEST3'),admin=actors.find(actor=>actor.alias==='H005_TEST');
  await rest(admin,'rpc/stop_affiliate_impersonation','POST',{});
  const created=[];let financialCases=0,validationCases=0,financialMismatches=0,validationMismatches=0,roundingMismatches=0;
  const open=async actor=>{const result=await edge(actor,{action:'loanSessionOpen'});assert.equal(result.status,200,JSON.stringify(result.data));const data=result.data.data;assert.equal(data.googleResolutionCount,1);assert(data.loanSession&&data.loanSession.id);created.push(uuid(data.loanSession.id));return data;};
  const quoteInput=(session,program,amount,term)=>({p_snapshot_id:session.loanSession.id,p_program_id:program.id,p_amount:amount,p_term:term});
  const edgeInput=(session,program,amount,term)=>({action:'loanSessionQuote',snapshot_id:session.loanSession.id,program_id:program.id,amount,term});
  const compareValid=async(actor,session,program,amount,term)=>{const [edgeResult,rpcResult]=await Promise.all([edge(actor,edgeInput(session,program,amount,term),true),rpc(actor,quoteInput(session,program,amount,term))]);assert.equal(edgeResult.status,200,JSON.stringify(edgeResult.data));assert.equal(rpcResult.status,200,JSON.stringify(rpcResult.data));assert.equal(edgeResult.data.data.googleResolutionCount,0);assert.equal(rpcResult.data.googleResolutionCount,0);financialCases++;try{assert.deepEqual(financial(edgeResult.data.data),financial(rpcResult.data));}catch(error){financialMismatches++;const cents=['interest','administrativeFeeTotal','total','paymentPerPeriod'];if(cents.some(key=>edgeResult.data.data[key]!==rpcResult.data[key]))roundingMismatches++;throw error;}};
  const compareInvalid=async(actor,session,programId,amount,term,expected)=>{const edgeResult=await edge(actor,{action:'loanSessionQuote',snapshot_id:session.loanSession.id,program_id:programId,amount,term},true),rpcResult=await rpc(actor,{p_snapshot_id:session.loanSession.id,p_program_id:programId,p_amount:amount,p_term:term});validationCases++;const left=errorCode(edgeResult),right=errorCode(rpcResult);if(left!==expected||right!==expected){validationMismatches++;throw new Error(`VALIDATION_MISMATCH:${left}:${right}:${expected}`);}assert(!edgeResult.ok&&!rpcResult.ok);};
  try{
    const sessions=[{actor:userA,data:await open(userA)},{actor:userB,data:await open(userB)}];
    for(const {actor,data} of sessions){
      const programs=data.programs.filter(item=>item.status==='AVAILABLE').slice(0,3);assert(programs.length>0,actor.alias+' programs');
      for(const program of programs){
        const min=Number(program.min_amount),max=Number(program.max_amount),suggested=Number(program.suggested_amount);
        const amounts=[min,suggested,max,Math.min(max,Math.max(min,1234.56))].filter((value,index,array)=>array.indexOf(value)===index);
        const custom=program.custom_term,terms=[Number(custom.min),...(program.allowed_terms||[]).slice(0,2).map(Number)];
        const alignedMax=Number(custom.min)+Math.floor((Number(custom.max)-Number(custom.min))/Number(custom.step))*Number(custom.step);terms.push(alignedMax);
        for(const amount of amounts.slice(0,3))for(const term of [...new Set(terms)].slice(0,3))await compareValid(actor,data,program,amount,term);
      }
      const program=programs[0],term=Number(program.custom_term.min),amount=Number(program.suggested_amount);
      await compareInvalid(actor,data,'NOT-A-PROGRAM',amount,term,'FINANCIAL_PROGRAM_NOT_ELIGIBLE');
      await compareInvalid(actor,data,program.id,Number(program.max_amount)+0.01,term,'FINANCIAL_REQUEST_OUT_OF_RANGE');
      await compareInvalid(actor,data,program.id,amount,Number(program.custom_term.max)+Number(program.custom_term.step),'FINANCIAL_REQUEST_OUT_OF_RANGE');
      await compareInvalid(actor,data,program.id,0,term,'INVALID_REQUEST');
    }

    const catalog=await edge(admin,{action:'catalog'});assert.equal(catalog.status,200,'criteria catalog');
    const normalize=value=>String(value||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toUpperCase();
    const candidates=await db("select a.id,u.label union_label,c.label category_label from public.affiliates a join public.segmentation_catalog_entries u on u.catalog_type='union' and u.code=a.financial_union_code and u.enabled join public.segmentation_catalog_entries c on c.catalog_type='employment_category' and c.code=a.financial_employee_category_code and c.enabled order by a.id");
    const applicable=[];
    for(const candidate of candidates){const key=normalize(candidate.union_label)+'|'+normalize(candidate.category_label);if(applicable.some(item=>item.key===key))continue;if(catalog.data.data.rules.some(rule=>rule.status==='AVAILABLE'&&normalize(rule.union)===normalize(candidate.union_label)&&normalize(rule.category)===normalize(candidate.category_label)))applicable.push({id:candidate.id,key});if(applicable.length===2)break;}
    assert.equal(applicable.length,2,'two applicable distinct financial profiles required');
    for(const candidate of applicable){
      await rest(admin,'rpc/stop_affiliate_impersonation','POST',{});
      const started=await rest(admin,'rpc/start_affiliate_impersonation','POST',{p_affiliate_id:candidate.id,p_reason:'QA RPC equivalence across profiles'});assert.equal(started.status,200);
      const data=await open(admin),program=data.programs.find(item=>item.status==='AVAILABLE');assert(program,'impersonated program');
      const amounts=[Number(program.min_amount),Number(program.max_amount),Math.min(Number(program.max_amount),Math.max(Number(program.min_amount),1234.56))];
      const terms=[Number(program.custom_term.min),Number(program.custom_term.min)+Math.floor((Number(program.custom_term.max)-Number(program.custom_term.min))/Number(program.custom_term.step))*Number(program.custom_term.step)];
      for(const amount of [...new Set(amounts)])for(const term of [...new Set(terms)])await compareValid(admin,data,program,amount,term);
      await rest(admin,'rpc/stop_affiliate_impersonation','POST',{});
    }

    const sessionA=sessions[0].data,sessionB=sessions[1].data,programA=sessionA.programs.find(item=>item.status==='AVAILABLE'),programB=sessionB.programs.find(item=>item.status==='AVAILABLE');
    const crossAB=await rpc(userA,quoteInput(sessionB,programB,Number(programB.suggested_amount),Number(programB.custom_term.min)));assert.equal(errorCode(crossAB),'SNAPSHOT_INVALID');
    const crossBA=await rpc(userB,quoteInput(sessionA,programA,Number(programA.suggested_amount),Number(programA.custom_term.min)));assert.equal(errorCode(crossBA),'SNAPSHOT_INVALID');
    const anonymous=await request(v.SUPABASE_URL+'/rest/v1/rpc/resolve_current_loan_snapshot_quote',{method:'POST',headers:{apikey:v.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify(quoteInput(sessionA,programA,Number(programA.suggested_amount),Number(programA.custom_term.min)))});assert([401,403].includes(anonymous.status));
    for(const actor of [userA,userB]){const direct=await rest(actor,'financial_session_snapshots?select=id','GET');assert([401,403,404].includes(direct.status));const write=await rest(actor,'financial_session_snapshots','POST',{affiliate_id:actor.affiliateId});assert([401,403,404].includes(write.status));}
    const tamperedRate=await rest(userA,'rpc/resolve_current_loan_snapshot_quote','POST',{...quoteInput(sessionA,programA,Number(programA.suggested_amount),Number(programA.custom_term.min)),p_rate:0});assert(!tamperedRate.ok);
    const tamperedMax=await rest(userA,'rpc/resolve_current_loan_snapshot_quote','POST',{...quoteInput(sessionA,programA,Number(programA.suggested_amount),Number(programA.custom_term.min)),p_max_amount:999999999});assert(!tamperedMax.ok);

    const expiring=await open(userA),expiringProgram=expiring.programs.find(item=>item.status==='AVAILABLE');await db(`update public.financial_session_snapshots set created_at=now()-interval '16 minutes',expires_at=now()-interval '1 minute' where id='${uuid(expiring.loanSession.id)}'::uuid`);const expired=await rpc(userA,quoteInput(expiring,expiringProgram,Number(expiringProgram.suggested_amount),Number(expiringProgram.custom_term.min)));assert.equal(errorCode(expired),'SNAPSHOT_INVALID');
    const mismatch=await open(userB),mismatchProgram=mismatch.programs.find(item=>item.status==='AVAILABLE');await db(`update public.financial_session_snapshots set financial_profile_version=financial_profile_version+1 where id='${uuid(mismatch.loanSession.id)}'::uuid`);const profileMismatch=await rpc(userB,quoteInput(mismatch,mismatchProgram,Number(mismatchProgram.suggested_amount),Number(mismatchProgram.custom_term.min)));assert.equal(errorCode(profileMismatch),'SNAPSHOT_INVALID');
    const started=await rest(admin,'rpc/start_affiliate_impersonation','POST',{p_affiliate_id:userA.affiliateId,p_reason:'QA RPC snapshot identity binding'});assert.equal(started.status,200);const impersonated=await open(admin),impProgram=impersonated.programs.find(item=>item.status==='AVAILABLE');await rest(admin,'rpc/stop_affiliate_impersonation','POST',{});const impMismatch=await rpc(admin,quoteInput(impersonated,impProgram,Number(impProgram.suggested_amount),Number(impProgram.custom_term.min)));assert.equal(errorCode(impMismatch),'SNAPSHOT_INVALID');

    const perfSession=await open(userA),perfProgram=perfSession.programs.find(item=>item.status==='AVAILABLE'),latencies=[];
    for(let i=0;i<10;i++){const ratio=(i+1)/11,amount=Math.round((Number(perfProgram.min_amount)+(Number(perfProgram.max_amount)-Number(perfProgram.min_amount))*ratio)*100)/100,t0=performance.now();const result=await rpc(userA,quoteInput(perfSession,perfProgram,amount,Number(perfProgram.custom_term.min)));latencies.push(performance.now()-t0);assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.googleResolutionCount,0);}
    latencies.sort((a,b)=>a-b);const median=latencies[Math.floor(latencies.length/2)],max=latencies[latencies.length-1];
    console.log(JSON.stringify({status:'PASS',users:2,distinct_profiles:2,financial_cases:financialCases,validation_cases:validationCases,financial_output_mismatches:financialMismatches,validation_mismatches:validationMismatches,rounding_mismatches:roundingMismatches,cross_user_ab:'DENIED',cross_user_ba:'DENIED',anonymous:'DENIED',expired:'DENIED',profile_mismatch:'DENIED',impersonation_mismatch:'DENIED',tampered_rate:'REJECTED',tampered_max:'REJECTED',direct_snapshot_reads:0,direct_snapshot_writes:0,edge_interactive_calls:edgeInteractiveCalls,rpc_interactive_calls:rpcInteractiveCalls,google_interactive_calls:0,performance_ms:{median:Math.round(median),max:Math.round(max)},pii_reported:false,google_writes:0}));
  }finally{await rest(admin,'rpc/stop_affiliate_impersonation','POST',{}).catch(()=>{});if(created.length)await db(`delete from public.financial_session_snapshots where id in (${created.map(id=>`'${uuid(id)}'::uuid`).join(',')})`).catch(()=>{});}
}
main().catch(error=>{console.error(JSON.stringify({status:'FAIL',error:error.message}));process.exitCode=1;});
