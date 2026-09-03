'use strict';
const crypto=require('crypto'),fs=require('fs'),path=require('path'),child=require('child_process');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const sha=file=>crypto.createHash('sha256').update(read(file).replace(/\r\n/g,'\n')).digest('hex').toUpperCase();
const must=(value,label)=>{if(!value)throw new Error(label);};
const contains=(source,value,label)=>must(source.includes(value),label||`missing ${value}`);

const protectedSha='b8c1f6c0057dabded90804ffadd5bd012fb41a1a';
const migrations={
  'supabase/migrations/20260903000120_admin_access_impersonation_global_permissions.sql':'16A57C29F39F2CBD4E508E9A99E267381E984E1DAE6C668B846282E88A96FDDC',
  'supabase/migrations/20260903000121_admin_assignment_revocation_metadata_fix.sql':'E48333BE97AAD8C8C7C1A728BED37035D36D5C4513C7DA62B1A5C84D7DDCD56E',
  'supabase/migrations/20260903000122_impersonation_stop_permission_binding.sql':'5FF3833D903AA4DEC373CFC3853D9EFCB3D941085BDD6FEAF94D8855BFABC07F'
};
for(const [file,expected] of Object.entries(migrations))must(sha(file)===expected,`PROTECTED_MIGRATION_CHANGED: ${file}`);

const contract=read('docs/ADMIN_ACCESS_PROTECTED_CONTRACT.md');
const source=read('docs/SOURCE_OF_TRUTH.md');
const invariants=read('docs/INVARIANTS.md');
const decisions=read('docs/DECISIONS.md');
for(const doc of [contract,source,invariants,decisions])contains(doc,protectedSha,'protected SHA missing');
for(const value of [
  'admin_roles','admin_role_permissions','admin_assignments','has_admin_permission',
  'admin_section_definitions','admin_section_responsibilities','has_section_action','get_admin_access_context',
  'impersonation_sessions','start_affiliate_impersonation','get_impersonation_context','get_effective_affiliate_id',
  'identity_audit_log','admin_audit_log'
])contains(contract,value,`protected authority missing: ${value}`);
for(let id=189;id<=198;id++)contains(invariants,`INV-${id}:`,`protected invariant missing: INV-${id}`);
contains(decisions,'ADR-098 — Protección del contrato de acceso administrativo');
contains(contract,'PROTECTED / CLOSED CONTRACT');

const staticTest=child.spawnSync(process.execPath,[path.join(root,'scripts/test-admin-access-impersonation-global-permissions.js')],{cwd:root,encoding:'utf8'});
must(staticTest.status===0,`focused static regression failed: ${staticTest.stderr||staticTest.stdout}`);
const live=read('scripts/test-admin-access-impersonation-global-permissions-live.py');
const browser=read('scripts/test-admin-access-impersonation-global-permissions-browser.js');
for(const value of ['A_SUPER_ADMIN_NOT_FULL','H_ACTIVE_CONTEXT_SURVIVED_PERMISSION_REVOKE','E_UNAUTHORIZED_IMPERSONATION_ALLOWED','F_NORMAL_USER_ESCALATED','G_ANONYMOUS_IMPERSONATION_ALLOWED'])contains(live,value,`live guard missing: ${value}`);
for(const value of ['sectionOnlyMenu','directViewDenied','normalAssignmentDenied','normalImpersonationDenied','mobile'])contains(browser,value,`browser guard missing: ${value}`);

console.log(JSON.stringify({status:'PASS',protected_contract:true,protected_sha:protectedSha,migrations:3,invariants:10,focused_static:true,global_suites:'NOT_EXECUTED',functional_change:false,production_data_change:false}));
