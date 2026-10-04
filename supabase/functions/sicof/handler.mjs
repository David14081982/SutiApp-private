import {readSicofLoanSource} from './loan-source.mjs';
import {readCachedSicofSource,refreshCachedSicofSource,requireCurrentSicofSource} from './source-cache.mjs';
import {analyzeSicofLoans} from './loan-calculation.mjs';
import {calculateSicof,validateSettings,validateCalculationInputs,ENGINE_VERSION,date,fingerprint} from './engine.mjs';
import {decorateLoans,behaviorFor,makeReports,workspaceView,buildContinuousSavingsReport,compactWorkspace} from './projection.mjs';
import {exportSicofReport} from './exports.mjs';
import {createSimulationSeed,validateSimulationBasis} from './simulation.mjs';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const fields={LOAD:['from','to'],WORKSPACE:['settings','costs','bank','compact','refresh_source','simulation'],CALCULATE:['settings','costs','bank'],BEHAVIOR:['affiliate_ids'],SAVE_SCENARIO:['settings','costs','bank','fingerprint','key','title','simulation_basis'],ARCHIVE_SCENARIO:['id','key'],SAVE_PREFERENCES:['texts','tabOrder','key'],EXPORT:['kind','settings','costs','bank','fingerprint','filters','from','to','simulation_basis']};
async function rpc(client,name,args) {const r=await client.rpc(name,args);if(r.error)throw Error(r.error.message||'SICOF_RPC_FAILED');return r.data;}
function requireContext(context,actor) {if(!context||context.actor!==actor||!context.session)throw Error('SICOF_CONTEXT_CHANGED');return context;}
function decodeBytes(base64){return Uint8Array.from(atob(base64.replace(/\s/g,'')),c=>c.charCodeAt(0));}
function encodeBytes(bytes){let out='';for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(out);}
// The continuous workbook always reaches the server's current day. The existing
// interval report keeps its own cutoff. Read bounded windows through the same
// authorized RPC so the export continues working beyond its 1098-day limit.
export async function readContinuousReportContext(user,selected,actor){
  const first='2026-07-01',cutoff=selected.today;date(cutoff);
  if(cutoff<first)return selected;
  if(selected.from<=first&&selected.as_of===cutoff)return selected;
  const day=86400000,add=(value,n)=>new Date(Date.parse(value+'T00:00:00Z')+n*day).toISOString().slice(0,10);
  const windows=[];
  for(let start=first;start<=cutoff;){const end=add(start,1098)<cutoff?add(start,1098):cutoff;windows.push({p_from:start,p_to:end});start=add(end,1);}
  const sameScope=c=>{
    requireContext(c.context,actor);
    if(JSON.stringify(c.context)!==JSON.stringify(selected.context)||c.today!==cutoff||!c.can_export||
      c.report?.id!==selected.report?.id||c.report?.sha256!==selected.report?.sha256)throw Error('SICOF_CONTEXT_CHANGED');
  };
  const snapshots=[];
  for(const args of windows){
    const c=await rpc(user,'get_admin_sicof_context',args);sameScope(c);
    if(c.from!==args.p_from||c.to!==args.p_to||c.as_of!==args.p_to)throw Error('SICOF_REPORT_RANGE_CHANGED');
    snapshots.push(c);
  }
  const latest=snapshots.at(-1);
  if(snapshots.length===1)return latest;
  // A multi-window export must not combine observations that changed during
  // collection. No silent replacement by an older snapshot is permitted.
  for(let i=0;i<windows.length;i++){
    const fresh=await rpc(user,'get_admin_sicof_context',windows[i]);sameScope(fresh);
    if(fresh.fingerprint!==snapshots[i].fingerprint||JSON.stringify(fresh.participants)!==JSON.stringify(snapshots[i].participants))throw Error('SICOF_SOURCE_CHANGED');
  }
  const people=new Map(latest.participants.map(p=>[p.id,{...p,history:[]}]));
  for(const c of snapshots){
    if(c.participants.length!==people.size)throw Error('SICOF_SOURCE_CHANGED');
    for(const p of c.participants){
      const current=people.get(p.id);
      if(!current||p.folio!==current.folio||p.affiliate_id!==current.affiliate_id||p.certified_as_of!==current.certified_as_of||p.identity_resolved!==current.identity_resolved||p.certified!==current.certified)throw Error('SICOF_SOURCE_CHANGED');
      current.history.push(...p.history);
    }
  }
  return {...latest,from:first,participants:[...people.values()]};
}
export async function dispatchSicof(body,authorization,dependencies) {
  const {createUserClient,createServiceClient,env,ExcelJS}=dependencies;
  const user=createUserClient(authorization),auth=await user.auth.getUser();
  if(auth.error||!auth.data?.user)throw Error('SICOF_AUTH_REQUIRED');
  const actor=auth.data.user.id;
  if(!body||!Object.prototype.hasOwnProperty.call(fields,body.action)||Object.keys(body).some(k=>k!=='action'&&!fields[body.action].includes(k)))throw Error('SICOF_COMMAND_INVALID');
  if('compact' in body&&typeof body.compact!=='boolean')throw Error('SICOF_COMMAND_INVALID');
  if('refresh_source' in body&&typeof body.refresh_source!=='boolean')throw Error('SICOF_COMMAND_INVALID');
  if('simulation' in body&&typeof body.simulation!=='boolean')throw Error('SICOF_COMMAND_INVALID');
  const sourceReader=dependencies.sourceReader||(()=>readCachedSicofSource(dependencies));
  if(body.action==='BEHAVIOR'){
    if(!Array.isArray(body.affiliate_ids)||body.affiliate_ids.length<1||body.affiliate_ids.length>100||body.affiliate_ids.some(id=>!uuid(id)))throw Error('SICOF_SUBJECTS_INVALID');
    const context=await rpc(user,'get_admin_sicof_behavior_context',{p_affiliate_ids:body.affiliate_ids});requireContext(context.context,actor);
    const source=await (dependencies.sourceReader||readSicofLoanSource)(env),analysis=decorateLoans(analyzeSicofLoans(source,{from:'1900-01-01',to:context.today,as_of:context.today}));
    const fresh=await rpc(user,'get_admin_sicof_behavior_context',{p_affiliate_ids:body.affiliate_ids});
    if(JSON.stringify(fresh)!==JSON.stringify(context))throw Error('SICOF_CONTEXT_CHANGED');
    return {context:context.context,data:Object.fromEntries(context.subjects.map(subject=>[subject.affiliate_id,behaviorFor(subject,analysis)]))};
  }
  const settings=body.settings?validateSettings(body.settings):null;
  if(body.action==='WORKSPACE'&&!settings)throw Error('SICOF_SETTINGS_REQUIRED');
  const today=dependencies.today?dependencies.today():new Intl.DateTimeFormat('en-CA',{timeZone:'America/Hermosillo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  // A client supplies only the original read bounds, never a trusted context or
  // result. Re-read that same authorized context before checking its fingerprint.
  const basis=Object.hasOwn(body,'simulation_basis')?validateSimulationBasis(body.simulation_basis,settings,today):null;
  if(basis&&body.action==='EXPORT'&&body.kind==='final_ahorro')throw Error('SICOF_SIMULATION_RANGE_REQUIRED');
  let from=settings?.periodIni||body.from||today.slice(0,4)+'-01-01',to=settings?.periodFin||body.to||today;
  date(from);date(to);
  // Report selectors change only the read interval; no historical values are
  // reassigned or credited by selecting a different reporting period.
  if(body.action==='EXPORT'&&body.kind==='final_ahorro'&&body.filters?.semester&&!body.filters?.year)throw Error('SICOF_REPORT_FILTER_INVALID');
  if(body.action==='EXPORT'&&body.kind==='final_ahorro'&&body.filters?.year){
    if(!/^\d{4}$/.test(String(body.filters.year))||!['','1','2'].includes(String(body.filters.semester||'')))throw Error('SICOF_REPORT_FILTER_INVALID');
    const year=String(body.filters.year),semester=String(body.filters.semester||'');from=year+(semester==='2'?'-07-01':'-01-01');to=year+(semester==='1'?'-06-30':'-12-31');
  }
  const ctx=await rpc(user,'get_admin_sicof_context',{p_from:basis?.from||from,p_to:basis?.to||to});requireContext(ctx.context,actor);
  if(basis){
    validateSimulationBasis(basis,settings,ctx.today);
    if(ctx.from!==basis.from||ctx.to!==basis.to||ctx.today!==basis.today||ctx.as_of!==basis.as_of)throw Error('SICOF_CONTEXT_CHANGED');
  }
  // Only an already authorized SICOF consultation can request a shared refresh.
  // The claim decides whether a refresh is already running or in cooldown.
  if(body.action==='WORKSPACE'&&body.refresh_source)await refreshCachedSicofSource(dependencies,true);
  if(body.action==='SAVE_PREFERENCES'){
    if(!ctx.can_configure)throw Error('SICOF_ADMIN_DENIED');
    return {context:ctx.context,data:await rpc(user,'admin_save_sicof_preferences',{p_value:{labels:body.texts,tab_order:body.tabOrder},p_key:body.key||crypto.randomUUID()})};
  }
  if(body.action==='ARCHIVE_SCENARIO'){
    if(!ctx.can_configure||!uuid(body.id))throw Error('SICOF_ADMIN_DENIED');
    return {context:ctx.context,data:await rpc(user,'admin_archive_sicof_scenario',{p_scenario_id:body.id,p_key:body.key||crypto.randomUUID()})};
  }
  if(body.action==='EXPORT'&&!ctx.can_export)throw Error('SICOF_EXPORT_DENIED');
  if(body.action==='SAVE_SCENARIO'&&(!ctx.can_configure||!uuid(body.key)))throw Error('SICOF_ADMIN_DENIED');
  const sourceResponse=(data,source)=>{
    // Recheck after calculation, compaction or XLSX/base64 creation. No second
    // source query: an observation that expires during CPU work is not returned.
    requireCurrentSicofSource(source,dependencies);
    return {context:ctx.context,data};
  };
  async function exportResult(calculation,analysis,source){
    // Supported simulation ranges share the cutoff and complete participant
    // facts, but report labels and interval totals must use the chosen dates.
    const reportContext=basis&&body.kind!=='base_calculo'?{...ctx,from,to}:ctx;
    let templateBytes;
    if(body.kind==='final_ahorro'){
      if(!ctx.report?.id)throw Error('SICOF_HISTORICAL_REPORT_NOT_IMPORTED');
      const template=await rpc(user,'get_admin_sicof_report_template',{p_report_id:ctx.report.id});
      templateBytes=decodeBytes(template.template_base64);
      const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',templateBytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
      if(digest!==template.sha256||template.sha256!==ctx.report.sha256)throw Error('SICOF_TEMPLATE_CHANGED');
    }
    const reports=body.kind==='base_calculo'?null:makeReports(reportContext);
    const continuous=body.kind==='final_ahorro'&&!body.filters?.historical?
      buildContinuousSavingsReport(await readContinuousReportContext(user,ctx,actor)):null;
    const excel=ExcelJS||await dependencies.loadExcelJS();
    const exportContext=body.kind==='base_calculo'?{}:{...reportContext,historical_report:ctx.report,report:reports?.finalReport,continuous_report:continuous};
    const exported=await exportSicofReport({kind:body.kind,calculation,context:exportContext,loans:analysis,source:body.kind==='base_calculo'?source:undefined,filters:body.filters||{},templateBytes,ExcelJS:excel});
    return sourceResponse({base64:encodeBytes(new Uint8Array(exported.bytes)),content_type:exported.contentType,filename:exported.filename},source);
  }
  // Savings reports remain available independently of the loan-source outage.
  if(body.action==='EXPORT'&&body.kind==='final_ahorro')return exportResult(null,null);
  if(body.action==='EXPORT'&&body.kind==='base_calculo'){
    if(!settings)throw Error('SICOF_SETTINGS_REQUIRED');
    const inputs=validateCalculationInputs({settings,costs:body.costs,bank:body.bank});
    const source=await sourceReader(env);
    // The existing fingerprint seals inputs and the current live context plus
    // the shared source observation within the authorized five-minute lifetime,
    // not the derived distribution. Reconstruct it identically without building
    // loan histories, participant allocations or reports for a raw A:O export.
    const currentFingerprint=await fingerprint({engine:ENGINE_VERSION,...inputs,context:ctx.fingerprint,loans:source.source_fingerprint});
    if(body.fingerprint!==currentFingerprint)throw Error('SICOF_SOURCE_CHANGED');
    return exportResult({...inputs,engine_version:ENGINE_VERSION,fingerprint:currentFingerprint},{source_fingerprint:source.source_fingerprint},source);
  }
  let analysis,source;
  try {source=await sourceReader(env);analysis=decorateLoans(analyzeSicofLoans(source,{from,to,as_of:ctx.today}));}
  catch(error){
    if(!['LOAD','WORKSPACE'].includes(body.action))throw error;
    const workspace=workspaceView(ctx,null);
    if(error?.sourceState)workspace.source={...workspace.source,...error.sourceState,status:'UNAVAILABLE'};
    const data={workspace,result:null,calculation_error:error?.sourceState?error.message:'SICOF_LOAN_SOURCE_UNAVAILABLE'};
    return {context:ctx.context,data:body.action==='WORKSPACE'?(body.compact?compactWorkspace(data):data):workspace};
  }
  const workspace=()=>{const view=workspaceView(ctx,analysis);if(source.cache_meta)view.source={...view.source,...source.cache_meta,status:source.cache_meta.state};return view;};
  if(body.action==='LOAD')return sourceResponse(workspace(),source);
  if(!settings)throw Error('SICOF_SETTINGS_REQUIRED');
  const result=calculateSicof(ctx,analysis,{settings,costs:body.costs,bank:body.bank});
  result.fingerprint=await fingerprint({engine:result.engine_version,settings:result.settings,costs:result.costs,bank:result.bank,context:ctx.fingerprint,loans:analysis.source_fingerprint});
  // One authorized observation supplies both UI and calculation. Supabase
  // savings remain live; source metadata identifies the shared Google copy.
  if(body.action==='WORKSPACE'){
    const data={workspace:workspace(),result};
    if(body.simulation)data.simulation=createSimulationSeed(ctx,analysis,source,dependencies.now?dependencies.now():Date.now());
    return sourceResponse(body.compact?compactWorkspace(data):data,source);
  }
  if(body.action==='CALCULATE')return sourceResponse(result,source);
  if(body.fingerprint!==result.fingerprint)throw Error('SICOF_SOURCE_CHANGED');
  if(body.action==='EXPORT')return exportResult(result,analysis,source);
  if(body.action==='SAVE_SCENARIO'){
    let saveContext=ctx,saveResult=result;
    if(basis&&(from!==basis.from||to!==basis.to)){
      // The SQL writer independently rechecks the canonical context for the
      // actual saved period. Never pass it the broader simulation seed's hash.
      const fresh=await rpc(user,'get_admin_sicof_context',{p_from:from,p_to:to});requireContext(fresh.context,actor);
      if(!fresh.can_configure)throw Error('SICOF_ADMIN_DENIED');
      const financialContext=value=>({context:value.context,today:value.today,as_of:value.as_of,participants:value.participants,periods:value.periods});
      if(fresh.from!==from||fresh.to!==to||await fingerprint(financialContext(fresh))!==await fingerprint(financialContext(ctx)))throw Error('SICOF_CONTEXT_CHANGED');
      saveContext=fresh;saveResult=calculateSicof(fresh,analysis,{settings,costs:body.costs,bank:body.bank});
      saveResult.fingerprint=await fingerprint({engine:saveResult.engine_version,settings:saveResult.settings,costs:saveResult.costs,bank:saveResult.bank,context:fresh.fingerprint,loans:analysis.source_fingerprint});
    }
    requireCurrentSicofSource(source,dependencies);
    const data=await rpc(createServiceClient(),'service_save_sicof_scenario',{p_actor:actor,p_session:saveContext.context.session,p_effective_affiliate:saveContext.context.effective_affiliate,
      p_key:body.key,p_title:body.title||'Escenario '+from+' a '+to,p_parameters:{from,to,settings:saveResult.settings,costs:saveResult.costs,bank:saveResult.bank},
      p_result:saveResult,p_context_fingerprint:saveContext.fingerprint,p_source_fingerprint:analysis.source_fingerprint});
    return {context:ctx.context,data};
  }
  throw Error('SICOF_COMMAND_INVALID');
}
