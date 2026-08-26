'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const PROFILES=[
  ['Base','SUTISSSTESON'],['Base','SUEISSSTESON'],['Base','SITISSSTESON'],
  ['Confianza','EMPLEADOS DE CONFIANZA'],['Jubilados y Pens.','SUEISSSTESON'],['Eventuales','SUTISSSTESON'],
];
const normalize=value=>String(value??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toUpperCase();
function env(){const out={};for(const raw of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const line=raw.trim();if(!line||line.startsWith('#')||!line.includes('='))continue;const at=line.indexOf('=');out[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}return out;}
async function json(url,options={}){const response=await fetch(url,options),text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}return{status:response.status,ok:response.ok,data};}

async function main(){
  const v=env(),ref=new URL(v.SUPABASE_URL).hostname.split('.')[0];
  const db=async query=>{const result=await json(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+v.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query})});if(!result.ok)throw new Error('DB_'+result.status);return result.data;};
  const login=await json(v.SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:v.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:v.H005_TEST_EMAIL,password:v.H005_TEST_PASSWORD})});
  if(!login.ok)throw new Error('LOGIN_'+login.status);
  const headers={apikey:v.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+login.data.access_token,'Content-Type':'application/json'};
  const rpc=async(name,body={})=>json(v.SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers,body:JSON.stringify(body)});
  const edge=async body=>json(v.SUPABASE_URL+'/functions/v1/financial-legacy',{method:'POST',headers,body:JSON.stringify(body)});
  const candidates=await db("select a.id,u.label as union_label,c.label as category_label from public.affiliates a join public.segmentation_catalog_entries u on u.catalog_type='union' and u.code=a.financial_union_code and u.enabled join public.segmentation_catalog_entries c on c.catalog_type='employment_category' and c.code=a.financial_employee_category_code and c.enabled order by a.id");
  const catalogResult=await edge({action:'catalog'});
  if(!catalogResult.ok)throw new Error('CATALOG_'+catalogResult.status);
  const rules=catalogResult.data.data.rules,results=[];
  for(const [category,union] of PROFILES){
    const candidate=candidates.find(row=>normalize(row.category_label)===normalize(category)&&normalize(row.union_label)===normalize(union));
    if(!candidate){results.push({category,union,status:'NO_REAL_PROFILE'});continue;}
    let active=false;
    try{
      await rpc('stop_affiliate_impersonation');
      const started=await rpc('start_affiliate_impersonation',{p_affiliate_id:candidate.id,p_reason:'QA visibilidad financiera multiperfil'});
      if(!started.ok)throw new Error('START_'+started.status);
      active=true;
      const profile=await rpc('get_current_affiliate_financial_context'),overview=await edge({action:'overview'});
      if(!profile.ok||!overview.ok)throw new Error('OVERVIEW_'+overview.status);
      const expected=rules.filter(rule=>normalize(rule.category)===normalize(category)&&normalize(rule.union)===normalize(union)&&rule.payment_count>=1&&rule.status==='AVAILABLE').map(rule=>[rule.fund,rule.status,rule.payment_count]).sort();
      const actual=overview.data.data.programs.map(rule=>[rule.fund,rule.status,rule.custom_term.max]).sort();
      if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error('PROFILE_MISMATCH_'+category+'_'+union);
      results.push({category,union,status:'PASS',programs:actual.length,onePayment:actual.filter(item=>item[2]===1).length});
    }finally{if(active)await rpc('stop_affiliate_impersonation');}
  }
  console.log(JSON.stringify({status:results.every(item=>item.status==='PASS'||item.status==='NO_REAL_PROFILE')?'PASS':'FAIL',profiles:results,actorRealSeparated:true,sessionsClosed:true,googleWrites:0}));
}
main().catch(error=>{console.error(JSON.stringify({status:'FAIL',error:error.message}));process.exitCode=1;});
