from pathlib import Path
import json,hashlib,subprocess,re
root=Path(__file__).resolve().parents[1]
release=Path('C:/tmp/sutiapp-admin-user-modules-release-20260914')
changes={
'app/admin-repository.js':[
("roleCode,moduleKeys:roleCode==='module_admin'?Object.freeze((Array.isArray(value.module_keys)?value.module_keys:[]).slice()):null", "roleCode,moduleKeys:(roleCode==='module_admin'||value.support_context)?Object.freeze((Array.isArray(value.module_keys)?value.module_keys:[]).slice()):null,supportContext:value.support_context?Object.freeze({sessionId:value.support_context.session_id,subjectAuthUserId:value.support_context.subject_auth_user_id,affiliateId:value.support_context.affiliate_id}):null"),
("subjectKey:accessSubject(value,identity),", "subjectKey:accessSubject(value,identity)+(value.support_context?':support:'+value.support_context.session_id+':'+value.support_context.subject_auth_user_id:''),")],
'app/admin-cutover-store.jsx':[("eligible={roles:false,segments:","eligible={roles:contentContext.assignment.moduleKeys.includes('roles')&&A.has('authorization.read'),segments:")],
'app/app.jsx':[
("const stop=async()=>{setBusy(true);setError('');try{await window.AdminRepository.stopImpersonation();}","const stop=async(returnToAdmin=false)=>{setBusy(true);setError('');try{await window.AdminRepository.stopImpersonation();if(returnToAdmin)onAdmin();}"),
("{type:'button',onClick:onAdmin,disabled:busy", "{type:'button',onClick:()=>stop(true),disabled:busy"),
("{type:'button',onClick:stop,disabled:busy", "{type:'button',onClick:()=>stop(),disabled:busy"),
("const admin = window.useAdminAuth();\n    const adminAuthorized = admin.phase === 'authorized';", "const adminState = window.useAdminAuth();\n    const support = adminState.assignment&&adminState.assignment.supportContext;\n    const supportMatches = auth.impersonation ? Boolean(support&&support.sessionId===auth.impersonation.session_id&&support.affiliateId===(auth.affiliate&&auth.affiliate.id)) : !support;\n    const admin = supportMatches?adminState:Object.assign({},adminState,{phase:'denied',assignment:null,has:()=>false});\n    const adminAuthorized = admin.phase === 'authorized';"),
("/^#\\/admin\\/[a-z_]+$/.test(window.location.hash)&&!auth.impersonation?'admin'", "/^#\\/admin\\/[a-z_]+$/.test(window.location.hash)?'admin'"),
("React.createElement(ImpersonationBanner,{auth,onAdmin:()=>{setPopupItems(null);setTab('admin');}})", "React.createElement(ImpersonationBanner,{auth,onAdmin:()=>{setPopupItems(null);commitTab('admin');}})"),
("adminOnly: !auth.affiliateView || (!!auth.impersonation && tab === 'admin'), showAdmin: adminAuthorized && (!auth.impersonation || tab === 'admin')", "adminOnly: !auth.affiliateView, showAdmin: adminAuthorized")]
}
for filename,pairs in changes.items():
 for base in [root,release]:
  path=base/filename;source=path.read_text(encoding='utf8')
  for before,after in pairs:
   assert source.count(before)==1,(str(path),before,source.count(before))
   source=source.replace(before,after)
  path.write_text(source,encoding='utf8',newline='\n')
print(json.dumps({'status':'PASS','sources':list(changes),'unrelatedRootChangesPreserved':True}))
