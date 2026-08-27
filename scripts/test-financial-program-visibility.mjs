import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { evaluateVisibility, visibilityWindow, BUSINESS_TIME_ZONE } from '../supabase/functions/financial-legacy/visibility-policy.js';

const root=path.resolve(import.meta.dirname,'..'),read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const edge=read('supabase/functions/financial-legacy/index.ts');
const adminEdge=read('supabase/functions/financial-criteria-admin/index.ts');
const apps=read('google-apps-script/financial-handoff/Code.gs');
const migration=read('supabase/migrations/20260827000100_financial_criteria_supabase_cutover.sql');
const recovery=read('supabase/recovery/20260827000100_financial_criteria_supabase_cutover_recovery.sql');
const ui=read('app/screens-admin-fondos.jsx'),store=read('app/funds-store.jsx'),repo=read('app/financial-legacy-repository.js');
new vm.Script(apps);new vm.Script(ui);new vm.Script(store);new vm.Script(repo);

assert.equal(BUSINESS_TIME_ZONE,'America/Hermosillo');
for(const [date,end] of [['2026-08-24T18:00:00Z','2026-12-31'],['2026-10-01T12:00:00Z','2027-02-28'],['2026-12-15T12:00:00Z','2027-04-30']]){
  assert.equal(visibilityWindow(new Date(date)).upperISO,end);
}
const now=new Date('2026-08-24T18:00:00Z');
assert.equal(evaluateVisibility(null,'AUTO',now).effectiveVisibility,'VISIBLE');
assert.equal(evaluateVisibility('2026-10-15','AUTO',now).status,'AVAILABLE');
assert.equal(evaluateVisibility('2026-07-15','AUTO',now).status,'UNAVAILABLE');
assert.equal(evaluateVisibility('2027-01-15','AUTO',now).status,'SCHEDULED');
assert.equal(evaluateVisibility('2027-01-15','MOSTRAR',now).status,'AVAILABLE');
assert.equal(evaluateVisibility('2026-10-15','OCULTAR',now).status,'UNAVAILABLE');
assert.equal(evaluateVisibility('2026-10-15','',now).visibilityMode,'AUTO');

assert(edge.includes('get_financial_runtime_rules')&&edge.includes('readCriteriaRules(privileged)')&&!edge.includes('readVisibilityColumn()')&&!edge.includes('gvizCell(cells[15])'));
assert(!/docs\.google\.com|sheets\.googleapis\.com|oauth2\.googleapis\.com|GOOGLE_VISIBILITY_OAUTH/.test(edge));
assert(edge.includes('financial_criteria.visibility.read')&&edge.includes('programs: available.map'));
assert(apps.includes("CRITERIA_VISIBILITY_COLUMN = 16")&&apps.includes("CRITERIA_VISIBILITY_HEADER = 'VISIBILIDAD SUTIAPP'"));
assert(apps.includes('CRITERION_FINGERPRINT_MISMATCH')&&apps.includes('getRange(rowNumber,CRITERIA_VISIBILITY_COLUMN)'));
assert(!/payload\.(?:column|range|sheet|rate|amount|term|date)/.test(apps));
assert(adminEdge.includes('set_financial_rule_visibility')&&adminEdge.includes('get_financial_admin_catalog'));
assert(!/docs\.google\.com|sheets\.googleapis\.com|oauth2\.googleapis\.com|GOOGLE_VISIBILITY_OAUTH/.test(adminEdge));
assert(migration.includes('force row level security')&&migration.includes('financial_criteria.visibility.read')&&migration.includes('financial_criteria.visibility.write'));
assert(migration.includes('financial_configuration_audit')&&migration.includes('set_financial_rule_visibility'));
assert(recovery.includes("authority='GOOGLE_SHADOW'")&&recovery.includes('FINANCIAL_AUTHORITY_RECOVERY'));
for(const marker of ['Política automática','Configuración','Estado efectivo','Motivo obligatorio','Confirmar cambio'])assert(ui.includes(marker),marker);
assert(store.includes('setVisibility')&&repo.includes("functions.invoke('financial-criteria-admin'"));
for(const source of [ui,store,repo])assert(!/SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ACCESS_TOKEN|FINANCIAL_LEGACY_API_TOKEN/.test(source));
const production=edge+adminEdge+apps+ui+store+repo;
assert(!/15\/10\/2026|30\/11\/2026|15\/12\/2026|2027-01-15/.test(production));
console.log(JSON.stringify({status:'PASS',timezone:BUSINESS_TIME_ZONE,crossYear:true,auto:true,mostrar:true,ocultar:true,column:'P',header:'VISIBILIDAD SUTIAPP',columnMModified:false,hardcodedDatedPrograms:0}));
