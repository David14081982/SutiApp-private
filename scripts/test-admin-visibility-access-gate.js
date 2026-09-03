'use strict';
const assert=require('assert').strict,fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const repository=read('app/admin-repository.js');
const auth=read('app/affiliate-auth.js');
const shell=read('app/app.jsx');
const admin=read('app/screens-admin.jsx');
const bundle=read('app/bundle.js');
const html=read('SutiApp.html'),sw=read('sw.js');
const migration=read('supabase/migrations/20260903000120_admin_access_impersonation_global_permissions.sql');

function contains(source,value,label){assert(source.includes(value),label||`missing ${value}`);}
function excludes(source,pattern,label){assert(!pattern.test(source),label);}

const sandbox={
  window:{SutiSupabase:{getClient(){return{rpc:async()=>({data:{},error:null})};}}},
  React:{useState(){return[null,()=>{}];},useEffect(){},createElement(){}},
  console,crypto:{},setTimeout,clearTimeout
};
sandbox.window.window=sandbox.window;
vm.createContext(sandbox);
vm.runInContext(repository,sandbox,{filename:'app/admin-repository.js'});
const repo=sandbox.window.AdminRepository;

repo.primeAccessContext({role_code:'principal_admin',full_access:true,technical_permissions:['authorization.read'],section_actions:[]});
assert.equal(repo.getState().phase,'authorized','Super Admin must be authorized');
assert.equal(repo.getState().assignment.fullAccess,true,'Super Admin must have full access');
repo.primeAccessContext({role_code:'total_admin',full_access:false,technical_permissions:[],section_actions:[]});
assert.equal(repo.getState().phase,'authorized','active assignment must make Admin visible even with an empty permission role');
repo.primeAccessContext({role_code:null,full_access:false,technical_permissions:[],section_actions:[{section_key:'news',action:'read'}]});
assert.equal(repo.getState().phase,'authorized','effective section responsibility must make Admin visible');
assert.equal(repo.has('news.read'),true,'section owner must receive only the exact section action');
assert.equal(repo.has('documents.read'),false,'section owner must not receive unrelated modules');
repo.primeAccessContext({role_code:null,full_access:false,technical_permissions:[],section_actions:[]});
assert.equal(repo.getState().phase,'denied','normal user must be denied');

contains(auth,"adminContext.role_code||adminContext.full_access||(adminContext.section_actions||[]).length",'session boundary must use protected assignment/section context');
contains(shell,"t.id === 'admin' ? showAdmin",'Admin bottom-nav visibility must be context-gated');
contains(shell,"if(!adminAuthorized)return false",'internal Admin navigation must fail closed');
contains(shell,"refreshAccessContext().then",'Admin navigation must revalidate backend context');
contains(shell,"tab === 'admin' ? adminAuthorized",'direct Admin rendering must be denied');
contains(shell,"window.setInterval(refresh,30000)",'revocation revalidation missing');
contains(shell,"adminAuthorized && React.createElement(window.TweakButton",'internal Tweaks entry must be hidden');
contains(admin,"activeModule&&!access.stateFor(activeModule).canView",'Admin internal module guard missing');
contains(admin,"candidates.filter((m)=>stateFor(m).canView)",'Admin module visibility filter missing');
contains(migration,'public.get_admin_access_context(),public.get_current_affiliate_access_state()','protected access context RPC missing');
contains(migration,'from public,anon;','anonymous revocation missing');
contains(migration,'to authenticated;','authenticated-only grant missing');
for(const source of [repository,auth,shell])excludes(source,/service_role|SUPABASE_SECRET_KEY|SUPABASE_ACCESS_TOKEN|SUPABASE_DB_PASSWORD/i,'frontend secret exposure');
excludes(repository,/localStorage|sessionStorage|\bDATA\b/,'Admin access must not use browser or mock authority');

contains(bundle,'/* @@file admin-repository.js */','generated bundle missing repository');
contains(bundle,'/* @@file affiliate-auth.js */','generated bundle missing auth');
contains(bundle,'/* @@file app.jsx */','generated bundle missing shell');
contains(bundle,"t.id === 'admin' ? showAdmin",'generated bundle does not contain the Admin visibility gate');
contains(bundle,"if (!adminAuthorized) return false",'generated bundle does not contain the navigation denial');
contains(html,'app/bundle.js?v=200','HTML cachebuster mismatch');
contains(sw,"const CACHE = 'sutiapp-v144'",'service worker cache mismatch');
contains(sw,'app/bundle.js?v=200','service worker bundle cachebuster mismatch');
console.log(JSON.stringify({status:'PASS',cases:['SUPER_ADMIN_VISIBLE','ACTIVE_ASSIGNMENT_VISIBLE','SECTION_OWNER_SCOPED','NORMAL_DENIED','INTERNAL_NAV_DENIED','REVOCATION_REVALIDATED'],backend_authority:'PROTECTED_REUSED',global_suites:'NOT_EXECUTED'}));
