'use strict';
// Explicit, scoped release operations. Never writes business data or Google.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict'), {pathToFileURL} = require('node:url');
const {environment, query} = require('./inspect-loan-history');
const root = path.resolve(__dirname, '..'), area = path.join(root, '.tmp/loan-authorization-order');
const candidate = path.join(area, 'candidate'), baseline = path.join(area, 'baseline');
const evidence = path.join(root, 'docs/qa/evidence/loan-authorization-order');
const runtimeFile = 'financial-legacy/loan-capacity.mjs';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const read = file => fs.readFileSync(file, 'utf8');
const json = file => JSON.parse(read(file));
function save(dir, name, value) {
  const file = path.join(dir, name); fs.mkdirSync(path.dirname(file), {recursive:true});
  fs.writeFileSync(file, Buffer.isBuffer(value) || typeof value === 'string' ? value : JSON.stringify(value, null, 2)+'\n');
}
function report(name, value) { save(evidence, name+'.json', value); console.log(JSON.stringify(value)); }
async function remote(suffix, options={}) {
  const env = environment();
  const response = await fetch('https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0]+suffix,
    {...options, headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,...options.headers}, signal:AbortSignal.timeout(180000)});
  if (!response.ok) throw Error('MANAGEMENT_HTTP_'+response.status);
  return Buffer.from(await response.arrayBuffer());
}
async function metadata() { return JSON.parse(await remote('/functions/financial-legacy')); }
function manifest(folder) {
  return json(path.join(area,'source-receipt.json')).files.map(({file}) => ({file,sha256:sha(fs.readFileSync(path.join(folder,'supabase/functions',file)))}));
}
async function capture() {
  const common = (await query(`select jsonb_build_object('now',clock_timestamp(),
    'funds',(select jsonb_agg(jsonb_build_object('id',id,'name',name,'code',code,'program_id',program_id)) from public.financial_funds),
    'rules',(select jsonb_agg(jsonb_build_object('id',id,'fund_id',fund_id,'criterion_identity',coalesce(legacy_criterion_identity,'SUPABASE_RULE:'||id::text))) from public.financial_rules),
    'state',(select jsonb_build_object('enabled',enabled,'status',status,'source_updated_at',source_updated_at,'last_error_code',last_error_code) from loan_history_private.state where id)) result`))[0].result;
  const records = await query(`select a.id affiliate_id,a.numero_control,
    (select count(*) from public.affiliates d where not d.is_archived and d.numero_control=a.numero_control) identity_count,
    o.source,o.is_current,(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'folio',r.folio,'program_id',r.program_id,
    'criterion_identity',r.financial_submission_snapshot->>'criterion_identity','requested_amount',r.requested_amount,
    'status',r.status,'approved_at',r.financial_approved_at,'financial',r.financial_processing_status is not null and r.rental_start is null)
    order by r.created_at,r.id),'[]') from public.program_requests r where r.affiliate_id=a.id) requests
    from public.affiliates a left join loan_history_private.observations o on o.folio=a.numero_control and o.is_current
    where not a.is_archived and a.numero_control in ('4547','7803') order by a.numero_control`);
  assert.equal(records.length,2); for (const r of records) {assert.equal(Number(r.identity_count),1);assert(r.is_current);assert.deepEqual(r.source.issues,[]);}
  assert.equal(common.state.status,'READY');assert(common.state.enabled);
  return {common,records};
}
async function main() {
  const mode=process.argv[2];
  if (mode==='live') {
    const env=environment(),key=env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY;
    assert(key&&env.H005_TEST_EMAIL&&env.H005_TEST_PASSWORD,'CONTROLLED_ACCOUNT_CONFIG_REQUIRED');
    let token,actor;const cases=[];
    const call=async(endpoint,body)=>{
      assert(['/auth/v1/token?grant_type=password','/auth/v1/logout?scope=local',
        '/rest/v1/rpc/get_impersonation_context','/rest/v1/rpc/start_affiliate_impersonation',
        '/rest/v1/rpc/stop_affiliate_impersonation','/rest/v1/rpc/get_effective_affiliate_id',
        '/rest/v1/rpc/resolve_current_loan_snapshot_quote','/functions/v1/financial-legacy'].includes(endpoint));
      if(endpoint==='/functions/v1/financial-legacy')assert.equal(body.action,'loanSessionOpen');
      const response=await fetch(env.SUPABASE_URL+endpoint,{method:'POST',headers:{apikey:key,
        ...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json',Origin:'https://sutiapp.com'},
        body:JSON.stringify(body||{}),signal:AbortSignal.timeout(60000)});
      const result=await response.json().catch(()=>null);
      if(!response.ok)throw Error('LIVE_HTTP_'+response.status+'_'+String(result?.error||result?.code||'').replace(/[^A-Z0-9_]/g,'').slice(0,100));
      return result;
    };
    const context=async()=>{const value=await call('/rest/v1/rpc/get_impersonation_context');return Array.isArray(value)?value[0]||null:value;};
    const targets=json(path.join(area,'target-after-private.json')).records;
    try {
      const auth=await call('/auth/v1/token?grant_type=password',{email:env.H005_TEST_EMAIL,password:env.H005_TEST_PASSWORD});
      token=auth.access_token;actor=auth.user.id;assert(/^[0-9a-f-]{36}$/.test(actor));
      const active=await query("select count(*)::int n from public.impersonation_sessions where actor_real_auth_user_id='"+actor+"'::uuid and ended_at is null and expires_at>now()");
      assert.equal(active[0].n,0,'EXISTING_OPERATOR_ASSISTANCE');
      assert.equal(await context(),null,'EXISTING_SESSION_CONTEXT');
      for(const target of targets) {
        const reason='H-LOAN-AUTHORIZATION-DATE-ORDER-001 verification '+target.numero_control+' '+Date.now();
        let sessionId,attempted=false;const result={control:target.numero_control,status:'FAIL'};
        cases.push(result);
        try {
          attempted=true;
          const started=await call('/rest/v1/rpc/start_affiliate_impersonation',{p_affiliate_id:target.affiliate_id,p_reason:reason});
          sessionId=(Array.isArray(started)?started[0]:started)?.session_id;assert(sessionId);
          const active=await context();assert.equal(active.actor_real_auth_user_id,actor);assert.equal(active.usuario_contexto_affiliate_id,target.affiliate_id);
          assert.equal(await call('/rest/v1/rpc/get_effective_affiliate_id'),target.affiliate_id);
          const opened=await call('/functions/v1/financial-legacy',{action:'loanSessionOpen'}),overview=opened.data;
          assert(overview?.loanSession?.id&&Array.isArray(overview.programs),'LIVE_SESSION_NOT_READY');
          const eligible=overview.programs.filter(p=>p.status==='AVAILABLE');
          for(const p of eligible) {
            for(const field of ['available_amount','max_amount','pending_amount','reserved_amount'])assert(Number.isFinite(p[field])&&p[field]>=0);
            const expected=['GLOBAL','INDIVIDUAL'].includes(p.capacity_exemption)?p.max_amount:Math.max(0,p.max_amount-p.pending_amount-p.reserved_amount);
            assert.equal(Math.round(p.available_amount*100),Math.round(expected*100),'CAPACITY_FORMULA_CHANGED');
          }
          const p=eligible.find(p=>p.available_amount>0&&p.available_amount>=Number(p.min_amount));assert(p,'NO_REQUESTABLE_FUND');
          const amount=Math.min(p.available_amount,Math.max(Number(p.min_amount),Number(p.suggested_amount)||Number(p.min_amount)));
          const term=p.allowed_terms?.find(t=>Number.isInteger(t)&&t>0)||Number(p.custom_term?.min);
          const quote=await call('/rest/v1/rpc/resolve_current_loan_snapshot_quote',{p_snapshot_id:overview.loanSession.id,p_program_id:p.id,p_amount:amount,p_term:term});
          assert.equal(quote.amount,amount);assert.equal(quote.paymentCount,term);assert.equal(quote.fund,p.fund);assert(Number.isFinite(quote.total));
          save(area,'live-'+target.numero_control+'-private.json',{overview,quote});
          Object.assign(result,{status:'PASS',sessionOpened:true,quoteResolved:true,capacityFormulaPreserved:true,visibleFunds:eligible.length});
        } finally {
          if(attempted) {
            const active=await context();
            if(active) {
              assert.equal(active.actor_real_auth_user_id,actor);assert.equal(active.usuario_contexto_affiliate_id,target.affiliate_id);
              assert.equal(active.reason,reason);if(sessionId)assert.equal(active.session_id,sessionId);
              await call('/rest/v1/rpc/stop_affiliate_impersonation');
            }
            assert.equal(await context(),null,'ASSISTANCE_CLEANUP_FAILED');result.assistanceClosed=true;
          }
        }
      }
    } finally {
      if(token)await call('/auth/v1/logout?scope=local').catch(()=>{});
      report('live-accounts',{status:cases.length===2&&cases.every(x=>x.status==='PASS'&&x.assistanceClosed)?'PASS':'FAIL',
        cases,requestSubmissions:0,businessWrites:0,technicalWrites:'Two audited assistance sessions and existing ephemeral quote snapshots'});
    }
    return;
  }
  if (mode==='global') {
    const label=process.argv[3];assert(['local','pages'].includes(label));
    const cp=require('node:child_process'),build=json(path.join(root,'.tmp/document-release/build-result.json'));
    const expected='eebab0a561344a3e358b9be0a283a6f4c7fe59857c078cbdcf4a2a18f94b7d20';
    assert.equal(sha(fs.readFileSync(path.join(build.site,'app/bundle.js'))),expected,'LOCAL_FRONTEND_DRIFT');
    const log=path.join(area,'global-'+label+'.log'),fd=fs.openSync(log,'w');
    const child=cp.spawn(process.execPath,['scripts/test-global-image-regression-production-live.js'],{
      cwd:root,windowsHide:true,stdio:['ignore',fd,fd],env:{...process.env,
      SUTIAPP_IMAGE_E2E_URL:label==='local'?'https://sutiapp.com/SutiApp.html':'https://david14081982.github.io/SutiApp-private/',
      ...(label==='local'?{SUTIAPP_IMAGE_CANDIDATE_DIR:build.site}:{}),
      SUTIAPP_IMAGE_EXPECTED_BUNDLE_SHA256:expected,
      SUTIAPP_IMAGE_PDF_FIXTURE:read(path.join(root,'.tmp/document-release/image-pdf-fixture.json'))}});
    fs.closeSync(fd);
    const exit=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
    report('global-'+label,{status:exit===0?'PASS':'FAIL',exit,logSha256:sha(fs.readFileSync(log)),
      expectedFrontendSha256:expected,localBuild:label==='local',businessWrites:0});
    if(exit){console.log(read(log).slice(-2000));process.exitCode=1;}return;
  }
  if (mode==='prepare') {
    assert(!fs.existsSync(path.join(area,'source-receipt.json')),'BASELINE_EXISTS');
    const directory=path.join(root,'docs/qa/evidence/document-release');
    const receipt=json(path.join(directory,fs.readdirSync(directory).filter(f=>f.startsWith('edge-deploy-financial-legacy-')).sort().at(-1)));
    assert.equal(receipt.version,70);save(area,'source-receipt.json',receipt);
    for (const f of receipt.files) {
      let bytes=fs.readFileSync(path.join(root,'.tmp/document-release/supabase/functions',f.file));
      if (sha(bytes)!==f.sha256 && f.file==='_shared/document-integration.mjs')
        bytes=Buffer.from(bytes.toString().replace("'EXPEDIENTE','AFFILIATE_FILE','REQUEST'","'EXPEDIENTE','REQUEST'"));
      assert.equal(sha(bytes),f.sha256,'DEPLOYED_SOURCE_MISMATCH '+f.file);
      save(baseline,'supabase/functions/'+f.file,bytes);save(candidate,'supabase/functions/'+f.file,bytes);
    }
    for (const file of ['scripts/test-loan-historical-resolution.js','scripts/test-loan-available-credit.js','scripts/test-loan-available-credit-edge.js','app/history-loans-repository.js']) {
      const bytes=fs.readFileSync(path.join(root,'.tmp/document-release',file));save(candidate,file,bytes);save(baseline,file,bytes);
    }
    report('prepared',{status:'PASS',files:manifest(baseline),sourceChanges:0,productionWrites:0});return;
  }
  if (mode==='baseline') {
    const before=await metadata(),body=await remote('/functions/financial-legacy/body'),after=await metadata();
    const receipt=json(path.join(area,'source-receipt.json'));
    assert.equal(before.version,receipt.version);assert.equal(after.version,before.version);assert.equal(before.verify_jwt,true);
    assert.equal(sha(body),receipt.artifactSha256,'LIVE_ARTIFACT_DRIFT');
    save(baseline,'metadata.json',before);save(baseline,'body.eszip',body);
    const data=await capture();save(area,'target-before-private.json',data);
    report('baseline',{status:'PASS',version:before.version,verifyJwt:before.verify_jwt,artifactSha256:sha(body),
      observedAt:data.common.now,sourceUpdatedAt:data.common.state.source_updated_at,targets:data.records.length,productionWrites:0});return;
  }
  if (mode==='targets' || mode==='verify') {
    if(mode==='verify') {
      const deployed=json(path.join(evidence,'deployed.json')),current=await metadata();
      assert.equal(current.version,deployed.version);assert.equal(current.verify_jwt,true);assert.equal(current.status,'ACTIVE');
      const body=await remote('/functions/financial-legacy/body');save(area,'deployed.eszip',body);
      const source=read(path.join(candidate,'supabase/functions',runtimeFile));
      const embedded=body.includes(Buffer.from(source))||body.includes(Buffer.from(JSON.stringify(source).slice(1,-1)));
      assert(embedded,'DEPLOYED_CHANGED_SOURCE_NOT_FOUND');
      report('deployed-source',{status:'PASS',version:current.version,artifactSha256:sha(body),changedSourceEmbedded:true,
        files:manifest(candidate),productionWrites:0});
      save(area,'target-after-private.json',await capture());
    }
    const {common,records}=json(path.join(area,mode==='verify'?'target-after-private.json':'target-before-private.json'));
    const old=await import(pathToFileURL(path.join(baseline,'supabase/functions',runtimeFile)));
    const next=await import(pathToFileURL(path.join(candidate,'supabase/functions',runtimeFile)));
    const results=[];
    for(const row of records) {
      const source={...row.source,folio:row.numero_control},runtime={funds:common.funds,rules:common.rules,requests:row.requests};
      const identity={affiliate_id:row.affiliate_id,numero_control:row.numero_control},before=JSON.stringify({source,runtime});
      let originalError;try{old.projectLoanCapacity(source,runtime,common.now,identity);}catch(e){originalError={code:e.message,reason:e.reason,loan:e.obligation_id};}
      assert.equal(originalError?.reason,'LOAN_STATUS_UNRESOLVED');
      const projection=next.projectLoanCapacity(source,runtime,common.now,identity);
      assert.equal(JSON.stringify({source,runtime}),before,'INPUT_MUTATION');
      // Compare to the former diagnostic counterfactual. Only the date predicate
      // changes; existing debt, deduplication and every output field must match.
      const isolated=structuredClone(source),origin=isolated.requests.find(x=>x.id===originalError.loan);
      origin.date=isolated.loans.find(x=>x.id===originalError.loan).authorized;
      assert.deepEqual(projection,old.projectLoanCapacity(isolated,runtime,common.now,identity));
      results.push({control:row.numero_control,before:originalError,after:'PASS',fullDebtPreserved:true,inputsUnchanged:true});
    }
    report(mode==='verify'?'production-projection':'target-replay',{status:'PASS',observedAt:common.now,results,productionWrites:0});return;
  }
  if (mode==='compile' || mode==='deploy') {
    const original=json(path.join(baseline,'metadata.json')),current=await metadata();
    assert.equal(current.version,original.version,'CONCURRENT_DEPLOYMENT');assert.equal(current.verify_jwt,original.verify_jwt);
    assert.equal(sha(await remote('/functions/financial-legacy/body')),sha(fs.readFileSync(path.join(baseline,'body.eszip'))),'LIVE_ARTIFACT_DRIFT');
    const entries=manifest(candidate),before=manifest(baseline);
    assert.deepEqual(entries.filter((f,i)=>f.sha256!==before[i].sha256).map(f=>f.file),[runtimeFile]);
    for(const test of ['focused-tests','projection-tests','edge-tests','target-replay'])assert.equal(json(path.join(evidence,test+'.json')).status,'PASS');
    if(mode==='deploy')assert.deepEqual(json(path.join(evidence,'compiled.json')).files,entries,'COMPILED_SOURCE_DRIFT');
    const form=new FormData();form.append('metadata',JSON.stringify({name:'financial-legacy',slug:'financial-legacy',entrypoint_path:'financial-legacy/index.ts',verify_jwt:current.verify_jwt}));
    const env=environment();
    for(const f of entries) {
      const source=read(path.join(candidate,'supabase/functions',f.file));
      for(const [key,value]of Object.entries(env))if(value&&value.length>10&&/PASSWORD|SECRET|SERVICE_ROLE|ACCESS_TOKEN/i.test(key))assert(!source.includes(value),'SECRET_IN_PAYLOAD');
      form.append('file',new Blob([source],{type:f.file.endsWith('.ts')?'application/typescript':'application/javascript'}),f.file);
    }
    const result=JSON.parse(await remote('/functions/deploy?slug=financial-legacy'+(mode==='compile'?'&bundleOnly=true':''),{method:'POST',body:form}));
    save(area,mode+'-receipt-private.json',result);
    const after=await metadata();assert.equal(after.version,mode==='compile'?current.version:result.version);assert.equal(after.verify_jwt,true);
    report(mode==='compile'?'compiled':'deployed',{status:'PASS',version:after.version,previousVersion:current.version,files:entries,
      compileOnly:mode==='compile',businessWrites:0,productionDeployments:mode==='deploy'?1:0});return;
  }
  throw Error('MODE_INVALID');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
