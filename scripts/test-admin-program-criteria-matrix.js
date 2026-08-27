'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const screen=read('app/screens-admin-fondos.jsx'),store=read('app/funds-store.jsx'),repository=read('app/financial-legacy-repository.js');
const edge=read('supabase/functions/financial-legacy/index.ts'),adminEdge=read('supabase/functions/financial-criteria-admin/index.ts');
const policy=read('supabase/functions/financial-legacy/visibility-policy.js'),migration=read('supabase/migrations/20260827000100_financial_criteria_supabase_cutover.sql');
const bundle=read('app/bundle.js');[screen,store,repository].forEach(source=>new vm.Script(source));

for(const token of ['min-width: 1024px','data-admin-program-criteria-matrix','Configuración financiera','Reglas / criterios','Programas','Fondos','Autoridad Supabase','pcmx-skeleton','@media(min-width:1280px)','@media(min-width:1440px)','Buscar criterios de programas','Agrupar por programa','ArrowDown','ArrowUp']) assert(screen.includes(token),'screen contract missing: '+token);
for(const token of ['ProgramEditor','FundEditor','RuleEditor','Guardar borrador','Publicar después de guardar el borrador','financial_programs.write','financial_rules.write','financial_rules.publish','financial_rates.write','data-financial-rule-edit','data-financial-rule-create']) assert(screen.includes(token),'controlled Admin missing: '+token);
for(const label of ['Disponible','Programado','No disponible','Automático','Mostrar excepcionalmente','Ocultar','Programa y regla','Condiciones financieras','Vigencia, visibilidad y estado','Posible duplicado','Posible conflicto']) assert(screen.includes(label),label+' missing');
assert.doesNotMatch(screen,/Google no respondió|autoridad Google|PRODUCTIVE_GOOGLE_CONTROLLED/);
assert.match(screen,/!desktop && editing/);assert.match(screen,/function RuleRow/);assert.match(screen,/function VisibilityEditor/);

for(const token of ['FinancialLegacyRepository.listCriteriaCatalog()','FinancialLegacyRepository.getFinancialAdminCatalog()','adminCatalog: () => adminCatalog','saveProgram','saveFund','saveRuleDraft','publishRule','readOnly: false']) assert(store.includes(token),'store contract missing: '+token);
assert.doesNotMatch(store,/localStorage|sessionStorage|\bDATA\b/);
for(const token of ['getFinancialAdminCatalog','saveFinancialProgram','saveFinancialFund','saveFinancialRuleDraft','publishFinancialRule','previewFinancialRuleImpact']) assert(repository.includes(token),'repository contract missing: '+token);
for(const token of ['get_financial_runtime_rules','SUPABASE_FINANCIAL_CRITERIA','readCriteriaRules(privileged)','financial_union_code','financial_employee_category_code']) assert(edge.includes(token),'Edge contract missing: '+token);
assert.doesNotMatch(edge,/docs\.google\.com|sheets\.googleapis\.com|oauth2\.googleapis\.com|GOOGLE_VISIBILITY_OAUTH/);
for(const token of ['set_financial_rule_visibility','get_financial_admin_catalog','SUPABASE']) assert(adminEdge.includes(token),'Admin Edge contract missing: '+token);
assert.doesNotMatch(adminEdge,/docs\.google\.com|sheets\.googleapis\.com|oauth2\.googleapis\.com|GOOGLE_VISIBILITY_OAUTH/);
for(const token of ['financial_programs','financial_funds','financial_rules','financial_configuration_audit','force row level security','save_financial_rule_draft','publish_financial_rule','preview_financial_rule_impact']) assert(migration.includes(token),'migration contract missing: '+token);
assert(policy.includes('America/Hermosillo')&&policy.includes('AVAILABLE')&&policy.includes('SCHEDULED')&&policy.includes('UNAVAILABLE'));
assert(bundle.includes('data-admin-program-criteria-matrix'));
console.log('Admin financial programs/funds/rules static contract PASS');
