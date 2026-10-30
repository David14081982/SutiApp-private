"""Incremental criterion update from the published isolated checkout; never uses root registry."""
import copy,hashlib,importlib.util,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
TARGET=ROOT/'.tmp/cash-flow-consolidated/release'
BASE='183177cdb7b46668c70090cc737fc8cb75ad569c'
SCOPE='H-FLUJO-EFECTIVO-CRITERIO-001'
FILES=[
 'app/cash-flow-report.jsx','app/cash-flow-export.js',
 'supabase/functions/reports-jc/cash-flow.mjs','supabase/functions/reports-jc/cash-flow-google.mjs',
 'supabase/functions/reports-jc/cash-flow-consolidated.mjs','supabase/functions/reports-jc/cash-flow-contracts.mjs',
 'supabase/functions/reports-jc/cash-flow-investors.mjs',
 'supabase/migrations/20261030000400_reports_jc_cash_flow_investor_criteria.sql',
 'supabase/migrations/20261030000500_reports_jc_cash_flow_criteria_savings.sql',
 'supabase/migrations/20261030000600_reports_jc_cash_flow_savings_query.sql'
]
if not all((ROOT/f).is_file() for f in FILES):raise SystemExit('SCOPED_SOURCE_MISSING')
if subprocess.check_output(['git','-C',str(TARGET),'rev-parse','HEAD'],text=True).strip()!=BASE:raise SystemExit('PUBLISHED_BASE_MISMATCH')
spec=importlib.util.spec_from_file_location('registry',TARGET/'scripts/generate-architecture-registry.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
main=json.loads(m.MAIN.read_text('utf-8-sig'));code=json.loads(m.PARTS['code'].read_text('utf-8-sig'));data=json.loads(m.PARTS['data'].read_text('utf-8-sig'))
facts={**code['facts'],**data['facts']};fps=dict(main['freshness']['tracked_files']);overrides=m.load_overrides()
original=json.loads(subprocess.check_output(['git','-C',str(TARGET),'show',BASE+':docs/architecture/architecture-overrides.json'],text=True,encoding='utf8'))
for node in overrides['nodes']:
 if node.get('name')=='CashFlowContractualQueryEngine' and node.get('type')=='service':
  node['properties']['contract_source']='Official live HISTORIAL P V2 / requests; original linked approval terms take priority; no PDF, hash or documentary-certification gate; local classification JSON is not a runtime authority'
  node['properties']['evidence']='supabase/functions/reports-jc/cash-flow-contracts.mjs; scripts/test-cash-flow-criteria-contracts.mjs'
 if node.get('name')=='CashFlowReportModule' and node.get('type')=='admin_screen':
  node['properties']['authority']='Read-only derivation of official registered Supabase savings/investors/contract terms and Google HISTORIAL P V2; owner accepts recorded values; no parallel financial authority'
  node['properties']['unknown']='Only genuinely absent data or impossible calculations remain undetermined; recorded amounts and known subtotals remain visible; no bank balance inference'
changed=[(a['type'],a['name']) for a,b in zip(original['nodes'],overrides['nodes']) if a!=b]
assert set(changed)=={('service','CashFlowContractualQueryEngine'),('admin_screen','CashFlowReportModule')}
for table in ['investors_private.investors','investors_private.imports']:
 relation={'from':'public.get_admin_reports_jc_cash_flow_investors','from_type':'rpc','to':table,'to_type':'table','type':'READS'}
 if relation not in overrides['relationships']:
  overrides['relationships'].append(relation)
relation={'from':'public.get_admin_reports_jc_cash_flow','from_type':'rpc','to':'public.savings_workspace_receipts','to_type':'rpc','type':'CALLS'}
if relation not in overrides['relationships']:overrides['relationships'].append(relation)
new_relationships=[r for r in overrides['relationships'] if r not in original['relationships']]
assert overrides['relationships'][:len(original['relationships'])]==original['relationships']
# Preserve baseline key/array order, pretty indentation and LF; no unrelated formatting change.
m.OVERRIDES.write_text(json.dumps(overrides,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
decision_rel='docs/DECISIONS.md';decision=TARGET/decision_rel
before=decision.read_text(encoding='utf8')
append='\n\n### H-FLUJO-EFECTIVO-CRITERIO-001 \u2014 valores oficiales para el reporte, 2026-10-30\n\nEl propietario confirma que los valores registrados en las fuentes oficiales son\nv\xe1lidos para el Reporte Flujo de efectivo. No se exige una segunda certificaci\xf3n\ndocumental, PDF, hash de transferencia ni un estado de revisi\xf3n aprobado para\nconsultar importes existentes. La conciliaci\xf3n y las correcciones posteriores\ncorresponden al \xe1rea responsable; el reporte no modifica los datos originales.\n\nSupabase conserva la autoridad de Ahorro, Inversores y condiciones originales\nenlazadas; HISTORIAL P V2 conserva A/B y sus condiciones registradas. El reporte\ndistingue importes registrados, c\xe1lculos contractuales y obligaciones futuras.\nS\xf3lo un dato realmente ausente o un c\xe1lculo imposible queda sin determinar;\nlos importes conocidos y sus subtotales permanecen visibles en pantalla y Excel.\n\nLas condiciones originales enlazadas prevalecen sobre un residual legacy\nincorrecto. Se conservan tarifas hist\xf3ricas 0/10/15, la regla general del\n30 de marzo de 2026, las excepciones registradas y los per\xedodos de n\xf3mina de\nlos adelantos. No se reclasifican proyecciones como cobros ni se duplica un\nretiro al mostrar su componente de rendimiento. Esta decisi\xf3n s\xf3lo cambia\nel criterio de consulta del reporte: no activa el motor, no altera Apps Script,\ntriggers, cuotas, saldos ni autoridades productivas.\n'
if SCOPE not in before:decision.write_text(before.rstrip()+append,encoding='utf8',newline='\n')
override_rel='docs/architecture/architecture-overrides.json'
files=FILES+[decision_rel,override_rel]
preserved={f:copy.deepcopy(v) for f,v in facts.items() if f not in files};source_hashes={}
for f in files:
 source_root=TARGET if f in [decision_rel,override_rel,'app/cash-flow-report.jsx','app/cash-flow-export.js'] else ROOT
 path=source_root/f
 previous=m.ROOT;m.ROOT=source_root
 fact=m.analyze_file(path,overrides);m.ROOT=previous
 if f in FILES:fact['domain']='finance'
 facts[f]=fact;fps[f]=hashlib.sha256(path.read_bytes()).hexdigest();source_hashes[f]=fps[f]
assert all(facts[f]==v for f,v in preserved.items())
built=m.build_registry(facts,fps,overrides)
built[0]['freshness'].update({'status':'STALE','scope':SCOPE,'scope_status':'FRESH','scope_files':files,'note':'Scoped criterion and direct read-adapter changes only. Published unrelated facts/fingerprints preserved; no global scan or global freshness claim.'})
m.save_registry(*built)
paths=[m.MAIN,*m.PARTS.values(),m.OVERRIDES,decision]
manifest={'status':'PASS','scope':SCOPE,'baseCommit':BASE,'candidateSourceHashes':source_hashes,'updatedFiles':[{'path':p.relative_to(TARGET).as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in paths],'unrelatedFactsPreserved':len(preserved),'changedSemanticNodes':changed,'newRelationships':new_relationships,'existingRelationshipsPreserved':True,'rootRegistryTouched':False,'globalRescan':False,'productionWrites':0,'testsExecuted':False}
out=ROOT/'docs/qa/evidence/cash-flow-criteria/registry-manifest.json';out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
print(json.dumps({k:v for k,v in manifest.items() if k not in ['candidateSourceHashes','updatedFiles']},ensure_ascii=True))
