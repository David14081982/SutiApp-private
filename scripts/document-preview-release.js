'use strict';
// Focal frontend build/publication evidence; no business or backend writes.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),vm=require('vm'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/document-preview-render'),work=path.join(root,'.tmp/document-preview-render'),mode=process.argv[2];
const read=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),sha=data=>crypto.createHash('sha256').update(data).digest('hex');
function proof(file,data){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,file+'.json'),JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify(data));}
async function main(){
 if(mode==='build'){
  const files=['document-layout-designer.jsx','screens-admin-document-generation.jsx'],bundleFile=path.join(root,'app/bundle.js'),bundle=read(bundleFile),parts=[...bundle.matchAll(/\/\* @@file ([^\n]+) \*\/\n[\s\S]*?(?=\/\* @@file |$)/g)];assert.equal(parts.map(p=>p[0]).join(''),bundle);for(const name of files)assert.equal(parts.filter(p=>p[1]===name).length,1);
  const box={};vm.createContext(box);vm.runInContext(read(process.env.BABEL_STANDALONE_PATH||'C:/tmp/babel-standalone-7.29.0.min.js'),box);
  const updated=parts.map(p=>files.includes(p[1])?'/* @@file '+p[1]+' */\n(function(){\n'+box.Babel.transform(read(path.join(root,'app',p[1])),{presets:['react'],filename:p[1]}).code+'\n})();\n':p[0]).join('');new vm.Script(updated);fs.writeFileSync(bundleFile,updated);
  const html=read(path.join(root,'SutiApp.html')),sw=read(path.join(root,'sw.js')),version=Math.max(...[...html.matchAll(/(?:bundle\.js\?v=|sw\.js\?v=)(\d+)/g),...sw.matchAll(/(?:sutiapp-v|bundle\.js\?v=)(\d+)/g)].map(m=>+m[1]))+1;
  for(const [file,text] of [['SutiApp.html',html],['sw.js',sw]])fs.writeFileSync(path.join(root,file),text.replace(/(app\/bundle\.js\?v=|sw\.js\?v=|sutiapp-v)\d+/g,(_,prefix)=>prefix+version));
  proof('build',{status:'PASS',version,bundleSha:sha(updated),changedChunks:files,unrelatedChunksPreserved:parts.length-files.length,workerLogicChanged:false,sourceHashes:Object.fromEntries(files.map(file=>['app/'+file,sha(fs.readFileSync(path.join(root,'app',file)))]))});return;
 }
 const built=JSON.parse(read(path.join(out,'build.json'))),site=path.join(work,'site-'+built.version);
 if(mode==='pages'){
  const envFile=[process.env.SUTIAPP_ENV_FILE,path.join(root,'supabase.env'),path.resolve(root,'../../..','supabase.env')].find(file=>file&&fs.existsSync(file));assert(envFile,'PUBLIC_BUILD_CONFIG_MISSING');const env={};for(const line of read(envFile).replace(/^\uFEFF/,'').split('\n')){const m=line.match(/^(SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
  cp.execFileSync(process.execPath,[path.join(root,'scripts/build-pages-site.js'),site],{cwd:root,env:{...process.env,SUTIAPP_SUPABASE_URL:env.SUPABASE_URL,SUTIAPP_SUPABASE_PUBLISHABLE_KEY:env.SUPABASE_PUBLISHABLE_KEY},stdio:'pipe',windowsHide:true});assert.equal(sha(fs.readFileSync(path.join(site,'app/bundle.js'))),built.bundleSha);proof('pages-build',{status:'PASS',version:built.version,bundleSha:built.bundleSha});return;
 }
 if(mode==='verify'){
  const target=process.argv[3]||'https://sutiapp.com/',checks=[];assert.equal(new URL(target).origin,'https://sutiapp.com');
  for(const file of ['SutiApp.html','app/bundle.js','sw.js','app/vendor/pdfjs-5.4.149/pdf.min.mjs','app/vendor/pdfjs-5.4.149/pdf.worker.min.mjs']){const r=await fetch(new URL(file+'?verify='+Date.now(),target),{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(45000)});assert.equal(r.status,200,file);const digest=sha(Buffer.from(await r.arrayBuffer()));assert.equal(digest,sha(fs.readFileSync(path.join(site,file))),file+'_PUBLIC_BYTES_DIFFER');checks.push({file,status:200,sha:digest});}
  proof('published',{status:'PASS',target,version:built.version,bundleSha:built.bundleSha,checks,businessWrites:0});return;
 }
 throw Error('MODE_INVALID');
}
main().catch(error=>{console.error(String(error.message).split('\n')[0]);process.exitCode=1;});
