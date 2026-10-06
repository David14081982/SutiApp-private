'use strict';
// Copy only this H's files and append only this H's documented decision.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),release=path.join(root,'.tmp/history-document-private/release');
const read=f=>fs.readFileSync(f,'utf8'),put=(f,s)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s);};
for(const folder of ['scripts','supabase/migrations','supabase/recovery'])for(const name of fs.readdirSync(path.join(root,folder)).filter(n=>n.includes('history-private-documents')||n.includes('history_private_documents')))put(path.join(release,folder,name),read(path.join(root,folder,name)));
put(path.join(release,'docs/audits/H-HISTORY-PRIVATE-DOCUMENTS-001.md'),read(path.join(root,'docs/audits/H-HISTORY-PRIVATE-DOCUMENTS-001.md')));
for(const name of fs.readdirSync(path.join(root,'docs/qa/evidence/history-private-documents')))put(path.join(release,'docs/qa/evidence/history-private-documents',name),read(path.join(root,'docs/qa/evidence/history-private-documents',name)).replace(/^\uFEFF/,''));
const entry='\n\n## H-HISTORY-PRIVATE-DOCUMENTS-001 — 2026-10-05\n\nOwner authorizes removing authorization PDFs from affiliate History/Tracking and reserving program request documents for administrators. Tracking no longer mounts GeneratedDocuments. document_private.visible denies all program self-context LIST/ACCESS, retaining program_requests.read and admin_request_module_boundary for admin access. Savings document visibility, generation, immutable records and private Storage remain unchanged. Migration 20261005000200 is guarded and reversible; production readback preserves function OID/owner/ACL and all 84 existing document records. Edge denies self context (403) and serves a legitimate admin PDF (200). See [audit](audits/H-HISTORY-PRIVATE-DOCUMENTS-001.md) and focal evidence. Commit/push/Pages publication explicitly authorized; only this H is packaged.\n';
for(const base of [root,release]){
 for(const file of ['docs/AGENT_CHANGELOG.md','docs/DECISIONS.md','docs/SOURCE_OF_TRUTH.md','docs/SECURITY_RULES.md']){const f=path.join(base,file),before=read(f);if(!before.includes('## H-HISTORY-PRIVATE-DOCUMENTS-001'))put(f,before+entry);}
 const f=path.join(base,'docs/architecture/architecture-overrides.json'),before=read(f),next='program documents: administrative permission + module boundary only; savings: effective affiliate owner or explicit admin capabilities; no browser cache';
 const lines=before.split('\n');assert.equal(lines.filter(line=>line.includes('"name": "DocumentGenerationRepository"')).length,1);
 put(f,lines.map(line=>line.includes('"name": "DocumentGenerationRepository"')?line.replace(/"access": "[^"]*"/,'"access": "'+next+'"'):line).join('\n'));
}
console.log('PASS focal evidence/package synced; unrelated workspace changes excluded');
