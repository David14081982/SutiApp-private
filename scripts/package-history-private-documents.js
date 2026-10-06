'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.tmp/history-document-private'),release=path.join(dir,'release');
const read=f=>fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n'),put=(f,s)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s);};
const md5=s=>crypto.createHash('md5').update(s).digest('hex'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const before=JSON.parse(read(path.join(dir,'catalog.json'))).definition.replace(/\r\n/g,'\n');
const old='else r.affiliate_id=public.get_effective_affiliate_id() end',next="else r.domain<>'program' and r.affiliate_id=public.get_effective_affiliate_id() end";
assert.equal(before.split(old).length,2);const after=before.replace(old,next);
for(const [folder,from,to,expected,target] of [['migrations',old,next,before,after],['recovery',next,old,after,before]]){
 const sql=`-- H-HISTORY-PRIVATE-DOCUMENTS-001: only program self-access changes. No row writes.\nbegin;\nset local lock_timeout='2s';\nset local statement_timeout='30s';\ndo $history_privacy$\ndeclare source text; patched text;\nbegin\n select pg_get_functiondef('document_private.visible(document_private.records,boolean)'::regprocedure) into source;\n if md5(replace(source,chr(13),'')) <> '${md5(expected)}' then raise exception 'DOCUMENT_VISIBILITY_BASELINE_DRIFT'; end if;\n patched:=replace(source,$old$${from}$old$,$new$${to}$new$);\n execute patched;\n if md5(replace(pg_get_functiondef('document_private.visible(document_private.records,boolean)'::regprocedure),chr(13),'')) <> '${md5(target)}' then raise exception 'DOCUMENT_VISIBILITY_POSTCONDITION'; end if;\nend $history_privacy$;\ncommit;\n`;
 put(path.join(root,'supabase',folder,'20261005000200_history_private_documents.sql'),sql);
}
const name='screens-historial.jsx',file='app/'+name,line="        React.createElement(window.GeneratedDocuments,{domain:'program',operationId:s.sourceId}),\n";
const original=read(path.join(release,file));assert.equal(original.split(line).length,2,'REMOTE_COMPONENT_CHANGED');
put(path.join(dir,'before',file),original);put(path.join(release,file),original.replace(line,''));
const box={};vm.createContext(box);vm.runInContext(read('C:/tmp/babel-standalone-7.29.0.min.js'),box);
const chunks=s=>[...s.matchAll(/\/\* @@file ([^\n]+) \*\/\n[\s\S]*?(?=\/\* @@file |$)/g)];
function rebuild(base){const prior=read(path.join(base,'app/bundle.js')),parts=chunks(prior);assert.equal(parts.map(p=>p[0]).join(''),prior);assert.equal(parts.filter(p=>p[1]===name).length,1);const code=box.Babel.transform(read(path.join(base,file)),{presets:['react'],filename:name}).code;const updated=parts.map(p=>p[1]===name?`/* @@file ${name} */\n(function(){\n${code}\n})();\n`:p[0]).join('');new vm.Script(updated);put(path.join(base,'app/bundle.js'),updated);return {bundleSha256:sha(updated),unrelatedChunksPreserved:parts.length-1};}
const info=rebuild(release);rebuild(root);
const html=read(path.join(release,'SutiApp.html')),sw=read(path.join(release,'sw.js')),version=Math.max(...[...html.matchAll(/(?:bundle\.js\?v=|sw\.js\?v=)(\d+)/g),...sw.matchAll(/(?:sutiapp-v|bundle\.js\?v=)(\d+)/g)].map(m=>+m[1]))+1;
for(const [f,s] of [['SutiApp.html',html],['sw.js',sw]])put(path.join(release,f),s.replace(/(app\/bundle\.js\?v=|sw\.js\?v=|sutiapp-v)\d+/g,(_,p)=>p+version));
const proof={status:'PASS',...info,version,changedChunks:[name],workerLogicUnchanged:true,backendBeforeMd5:md5(before),backendAfterMd5:md5(after)};
put(path.join(root,'docs/qa/evidence/history-private-documents/build.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
