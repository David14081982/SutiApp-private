'use strict';
// Structural build guard, NOT a permission store. Supabase remains authoritative.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function between(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a+start.length);assert(a>=0&&b>a,'SOURCE_STRUCTURE_CHANGED: '+start);return text.slice(a,b);}
function sourceInventory(overrides={}){
 const source=overrides.admin||read('app/screens-admin.jsx');
 const moduleSource=between(source,'  const MODULES =','  const ADMIN_DESKTOP_BREAKPOINT');
 const mapSource=between(source,'  const MODULE_PERMISSION =','  const MODULE_BADGE =');
 const context={};vm.runInNewContext(moduleSource+mapSource+';this.out={modules:MODULES,permissions:MODULE_PERMISSION,sections:SECTION_MODULE,groups:ADMIN_DESKTOP_GROUPS};',context,{timeout:1000});
 const app=overrides.app||read('app/app.jsx');
 const routeText=between(app,'    const tabScreen =','    const PushedScreen =');
 const routes=[...routeText.matchAll(/\b([a-z_]+)\s*:/g)].map(m=>m[1]);
 const company=overrides.company||read('app/screens-company.jsx');
 const companyRoutes=[...between(company,'    const M = {','    const View =').matchAll(/\b([a-z_]+)\s*:/g)].map(m=>m[1]);
 const union={window:{}};vm.runInNewContext(read('app/union-screen-registry.js'),union,{timeout:1000});
 const adminViews=[...new Set([...source.slice(source.indexOf('  function AdminScreen(')).matchAll(/\bview\s*===\s*'([a-z_]+)'/g)].map(m=>m[1]))];
 const audience={};vm.runInNewContext(between(read('app/admin-store.jsx'),'  const SCREENS =','  const SCREEN =')+';this.screens=SCREENS;',audience,{timeout:1000});
 const editorialMigration='supabase/migrations/20260924000300_app_editorial_panels.sql';
 const editorialRoutes=fs.existsSync(path.join(root,editorialMigration))?[...read(editorialMigration).matchAll(/\('([a-z_]+)','[^']+',(true|false)\)/g)].map(m=>m[1]):null;
 return JSON.parse(JSON.stringify({...context.out,routes,companyRoutes,adminViews,editorialRoutes,audienceScreens:audience.screens.map(s=>s.id),union:union.window.UNION_SCREEN_REGISTRY}));
}
function inspect(inventory,metadata,surfaces){
 const errors=[],modules=inventory.modules.map(m=>m.id),catalog=metadata.sections.filter(s=>s.module_key),keys=catalog.map(s=>s.module_key);
 const error=(ok,message)=>{if(!ok)errors.push(message);};
 error(new Set(modules).size===modules.length,'DUPLICATE_ADMIN_MODULE');
 for(const m of inventory.modules){
  error(Boolean(inventory.permissions[m.id]),'MISSING_MENU_PERMISSION:'+m.id);
  error(inventory.groups.filter(g=>g.modules.includes(m.id)).length===1,'MISSING_OR_DUPLICATE_SIDEBAR_GROUP:'+m.id);
  const row=catalog.find(s=>s.module_key===m.id);
  error(Boolean(row),'MISSING_BACKEND_REGISTRATION:'+m.id);
  if(row)error(row.enforcement_status==='ENFORCED','MODULE_NOT_ENFORCED:'+m.id);
 }
 for(const key of keys)error(modules.includes(key)||Boolean(surfaces.capabilities[key]),'UNCLASSIFIED_BACKEND_MODULE:'+key);
 for(const key of inventory.adminViews||[])error(key==='menu'||modules.includes(key)||Boolean(surfaces.unionEditors[key]),'UNREGISTERED_ADMIN_VIEW:'+key);
 for(const key of inventory.routes)error(Object.hasOwn(surfaces.affiliate,key),'UNCLASSIFIED_AFFILIATE_ROUTE:'+key);
 if(inventory.editorialRoutes){
  for(const key of inventory.routes.filter(k=>k!=='admin'))error(inventory.editorialRoutes.includes(key),'MISSING_EDITORIAL_ROUTE_REGISTRATION:'+key);
  for(const key of inventory.editorialRoutes)error(key!=='admin'&&inventory.routes.includes(key),'INVALID_EDITORIAL_ROUTE:'+key);
 }
 for(const key of Object.keys(surfaces.affiliate))error(inventory.routes.includes(key),'STALE_AFFILIATE_ROUTE:'+key);
 for(const [key,controllers] of Object.entries(surfaces.affiliate)){
  error(controllers.length>0||Boolean(surfaces.selfManaged[key]),'MISSING_CONTROLLER:'+key);
  for(const id of controllers)error(keys.includes(id),'UNKNOWN_CONTROLLER:'+key+':'+id);
 }
 for(const u of inventory.union){const editor=u.admin_editor.view;error(modules.includes(editor)||modules.includes(surfaces.unionEditors[editor]),'UNCLASSIFIED_UNION_EDITOR:'+editor);}
 for(const key of inventory.companyRoutes){error(Boolean(surfaces.company[key]),'UNCLASSIFIED_COMPANY_ROUTE:'+key);for(const id of surfaces.company[key]?.controllers||[])error(keys.includes(id),'UNKNOWN_COMPANY_CONTROLLER:'+key+':'+id);}
 for(const key of Object.keys(surfaces.company))error(inventory.companyRoutes.includes(key),'STALE_COMPANY_ROUTE:'+key);
 const visible=metadata.functions.find(f=>f.schema==='admin_support_private'&&f.name==='module_visible');
 const visibilityKeys=visible?[...visible.definition.matchAll(/\('([a-z_]+)','[^']+',array/g)].map(m=>m[1]):[];
 for(const id of modules.filter(id=>!visibilityKeys.includes(id)))error((surfaces.knownAssistedVisibilityGaps||[]).includes(id),'MISSING_ASSISTED_VISIBILITY:'+id);
 return {status:errors.length?'FAIL':'PASS',meaning:'Structural coverage only, not certification of independent backend authorization',errors,counts:{adminMenu:modules.length,backendCatalog:keys.length,affiliateRoutes:inventory.routes.length,unionScreens:inventory.union.length,companyViews:inventory.companyRoutes.length},assistedVisibilityMissing:modules.filter(id=>!visibilityKeys.includes(id)),audienceSelectorMissing:inventory.routes.filter(id=>!(inventory.audienceScreens||[]).includes(id)),companyIndividualScreenDelegation:false};
}
function check(){
 const metadata=JSON.parse(read('docs/qa/evidence/screen-permissions-20260924/production-metadata.json'));
 const result=inspect(sourceInventory(),metadata,JSON.parse(read('scripts/screen-permission-surfaces.json')));
 if(result.errors.some(e=>e.startsWith('MISSING_BACKEND_REGISTRATION:')||e.startsWith('MISSING_ASSISTED_VISIBILITY:'))){
  // One declaration on MODULES prepares its SQL automatically; never grants users.
  const inventory=sourceInventory(),missing=inventory.modules.filter(m=>result.errors.includes('MISSING_BACKEND_REGISTRATION:'+m.id)||result.errors.includes('MISSING_ASSISTED_VISIBILITY:'+m.id));
  const versions=[...new Set(missing.map(m=>m.registration?.version))];
  if(versions.length===1&&/^\d{14}$/.test(versions[0]||'')){
   const {prepare}=require('./register-admin-screen');
   const artifact=prepare(inventory,metadata,versions[0]);
   result.errors.push('REGISTRATION_SQL_PREPARED_NOT_APPLIED:'+artifact.output);
  }
 }
 if(result.errors.length)throw new Error('SCREEN_PERMISSION_COVERAGE\n'+result.errors.join('\n')+'\nDeclare/register the new screen and refresh the read-only production metadata before publishing.');
 return result;
}
module.exports={sourceInventory,inspect,check,root,read};
if(require.main===module){try{console.log(JSON.stringify(check(),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
