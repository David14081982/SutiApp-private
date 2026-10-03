import {readSicofLoanSource} from './loan-source.mjs';
import {analyzeSicofLoans} from './loan-calculation.mjs';
import {calculateSicof,validateSettings,date,fingerprint} from './engine.mjs';
import {decorateLoans,behaviorFor,makeReports,workspaceView} from './projection.mjs';
import {exportSicofReport} from './exports.mjs';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const fields={LOAD:['from','to'],CALCULATE:['settings','costs','bank'],BEHAVIOR:['affiliate_ids'],SAVE_SCENARIO:['settings','costs','bank','fingerprint','key','title'],ARCHIVE_SCENARIO:['id','key'],SAVE_PREFERENCES:['texts','tabOrder','key'],EXPORT:['kind','settings','costs','bank','fingerprint','filters','from','to']};
async function rpc(client,name,args) {const r=await client.rpc(name,args);if(r.error)throw Error(r.error.message||'SICOF_RPC_FAILED');return r.data;}
function requireContext(context,actor) {if(!context||context.actor!==actor||!context.session)throw Error('SICOF_CONTEXT_CHANGED');return context;}
function decodeBytes(base64){return Uint8Array.from(atob(base64.replace(/\s/g,'')),c=>c.charCodeAt(0));}
function encodeBytes(bytes){let out='';for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(out);}
export async function dispatchSicof(body,authorization,dependencies) {
  const {createUserClient,createServiceClient,env,ExcelJS}=dependencies;
  const user=createUserClient(authorization),auth=await user.auth.getUser();
  if(auth.error||!auth.data?.user)throw Error('SICOF_AUTH_REQUIRED');
  const actor=auth.data.user.id;
  if(!body||!Object.prototype.hasOwnProperty.call(fields,body.action)||Object.keys(body).some(k=>k!=='action'&&!fields[body.action].includes(k)))throw Error('SICOF_COMMAND_INVALID');
  const sourceReader=dependencies.sourceReader||readSicofLoanSource;
  if(body.action==='BEHAVIOR'){
    if(!Array.isArray(body.affiliate_ids)||body.affiliate_ids.length<1||body.affiliate_ids.length>100||body.affiliate_ids.some(id=>!uuid(id)))throw Error('SICOF_SUBJECTS_INVALID');
    const context=await rpc(user,'get_admin_sicof_behavior_context',{p_affiliate_ids:body.affiliate_ids});requireContext(context.context,actor);
    const source=await sourceReader(env),analysis=decorateLoans(analyzeSicofLoans(source,{from:'1900-01-01',to:context.today,as_of:context.today}));
    const fresh=await rpc(user,'get_admin_sicof_behavior_context',{p_affiliate_ids:body.affiliate_ids});
    if(JSON.stringify(fresh)!==JSON.stringify(context))throw Error('SICOF_CONTEXT_CHANGED');
    return {context:context.context,data:Object.fromEntries(context.subjects.map(subject=>[subject.affiliate_id,behaviorFor(subject,analysis)]))};
  }
  const settings=body.settings?validateSettings(body.settings):null;
  const today=dependencies.today?dependencies.today():new Intl.DateTimeFormat('en-CA',{timeZone:'America/Hermosillo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  let from=settings?.periodIni||body.from||today.slice(0,4)+'-01-01',to=settings?.periodFin||body.to||today;
  date(from);date(to);
  // Report selectors change only the read interval; no historical values are
  // reassigned or credited by selecting a different reporting period.
  if(body.action==='EXPORT'&&body.kind==='final_ahorro'&&body.filters?.semester&&!body.filters?.year)throw Error('SICOF_REPORT_FILTER_INVALID');
  if(body.action==='EXPORT'&&body.kind==='final_ahorro'&&body.filters?.year){
    if(!/^\d{4}$/.test(String(body.filters.year))||!['','1','2'].includes(String(body.filters.semester||'')))throw Error('SICOF_REPORT_FILTER_INVALID');
    const year=String(body.filters.year),semester=String(body.filters.semester||'');from=year+(semester==='2'?'-07-01':'-01-01');to=year+(semester==='1'?'-06-30':'-12-31');
  }
  const ctx=await rpc(user,'get_admin_sicof_context',{p_from:from,p_to:to});requireContext(ctx.context,actor);
  if(body.action==='SAVE_PREFERENCES'){
    if(!ctx.can_configure)throw Error('SICOF_ADMIN_DENIED');
    return {context:ctx.context,data:await rpc(user,'admin_save_sicof_preferences',{p_value:{labels:body.texts,tab_order:body.tabOrder},p_key:body.key||crypto.randomUUID()})};
  }
  if(body.action==='ARCHIVE_SCENARIO'){
    if(!ctx.can_configure||!uuid(body.id))throw Error('SICOF_ADMIN_DENIED');
    return {context:ctx.context,data:await rpc(user,'admin_archive_sicof_scenario',{p_scenario_id:body.id,p_key:body.key||crypto.randomUUID()})};
  }
  if(body.action==='EXPORT'&&!ctx.can_export)throw Error('SICOF_EXPORT_DENIED');
  async function exportResult(calculation,analysis){
    let templateBytes;
    if(body.kind==='final_ahorro'){
      if(!ctx.report?.id)throw Error('SICOF_HISTORICAL_REPORT_NOT_IMPORTED');
      const template=await rpc(user,'get_admin_sicof_report_template',{p_report_id:ctx.report.id});
      templateBytes=decodeBytes(template.template_base64);
      const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',templateBytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
      if(digest!==template.sha256||template.sha256!==ctx.report.sha256)throw Error('SICOF_TEMPLATE_CHANGED');
    }
    const reports=makeReports(ctx);
    const exported=await exportSicofReport({kind:body.kind,calculation,context:{...ctx,historical_report:ctx.report,report:reports.finalReport},loans:analysis,filters:body.filters||{},templateBytes,ExcelJS});
    return {context:ctx.context,data:{base64:encodeBytes(new Uint8Array(exported.bytes)),content_type:exported.contentType,filename:exported.filename}};
  }
  // Savings reports remain available independently of the loan-source outage.
  if(body.action==='EXPORT'&&body.kind==='final_ahorro')return exportResult(null,null);
  let analysis;
  try {analysis=decorateLoans(analyzeSicofLoans(await sourceReader(env),{from,to,as_of:ctx.today}));}
  catch(error){if(body.action!=='LOAD')throw error;return {context:ctx.context,data:workspaceView(ctx,null)};}
  if(body.action==='LOAD')return {context:ctx.context,data:workspaceView(ctx,analysis)};
  if(!settings)throw Error('SICOF_SETTINGS_REQUIRED');
  const result=calculateSicof(ctx,analysis,{settings,costs:body.costs,bank:body.bank});
  result.fingerprint=await fingerprint({engine:result.engine_version,settings:result.settings,costs:result.costs,bank:result.bank,context:ctx.fingerprint,loans:analysis.source_fingerprint});
  if(body.action==='CALCULATE')return {context:ctx.context,data:result};
  if(body.fingerprint!==result.fingerprint)throw Error('SICOF_SOURCE_CHANGED');
  if(body.action==='EXPORT')return exportResult(result,analysis);
  if(body.action==='SAVE_SCENARIO'){
    if(!ctx.can_configure||!uuid(body.key))throw Error('SICOF_ADMIN_DENIED');
    const data=await rpc(createServiceClient(),'service_save_sicof_scenario',{p_actor:actor,p_session:ctx.context.session,p_effective_affiliate:ctx.context.effective_affiliate,
      p_key:body.key,p_title:body.title||'Escenario '+from+' a '+to,p_parameters:{from,to,settings:result.settings,costs:result.costs,bank:result.bank},
      p_result:result,p_context_fingerprint:ctx.fingerprint,p_source_fingerprint:analysis.source_fingerprint});
    return {context:ctx.context,data};
  }
  throw Error('SICOF_COMMAND_INVALID');
}
