'use strict';
// Isolated release from current main. Only this module and four Admin insertions.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),assert=require('assert/strict'),cp=require('child_process');
const {root,privateDir,environment}=require('./investors-db'),target=path.join(privateDir,'release'),lf=s=>s.replace(/\r\n/g,'\n'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const read=(base,f)=>lf(fs.readFileSync(path.join(base,f),'utf8'));
const sections=s=>new Map([...s.matchAll(/^\/\* @@file ([^\n]+) \*\/\n[\s\S]*?(?=^\/\* @@file |$(?![\s\S]))/gm)].map(m=>[m[1],m[0]]));
function once(s,old,value){assert.equal(s.split(old).length,2,'ANCHOR:'+old.slice(0,70));return s.replace(old,()=>value);}
function main(){
 const baselineDir=path.join(privateDir,'release-baseline');
 if(!fs.existsSync(baselineDir)){assert.equal(cp.execFileSync('git',['status','--porcelain'],{cwd:target,encoding:'utf8'}).trim(),'','CLEAN_RELEASE_REQUIRED');fs.mkdirSync(baselineDir,{recursive:true});for(const f of ['app/screens-admin.jsx','app/bundle.js','SutiApp.html','sw.js','scripts/build-bundle.js']){fs.mkdirSync(path.dirname(path.join(baselineDir,f)),{recursive:true});fs.copyFileSync(path.join(target,f),path.join(baselineDir,f));}}
 const oldAdmin=read(baselineDir,'app/screens-admin.jsx'),source=read(root,'app/screens-admin.jsx'),lines=source.split('\n').filter(l=>l.includes("id:'inversores'")||l.includes("inversores:'program_requests.read'")||l.includes("view==='inversores'"));assert.equal(lines.length,4);
 let admin=oldAdmin;
 for(const line of lines){const previous=source.split('\n')[source.split('\n').indexOf(line)-1];admin=once(admin,previous,previous+'\n'+line);}
 const box={};vm.createContext(box);vm.runInContext(fs.readFileSync(process.env.SUTIAPP_BABEL_PATH||'C:/tmp/babel-standalone-7.29.0.min.js','utf8'),box);const compile=s=>box.Babel.transform(s,{presets:['react'],filename:'screens-admin.jsx'}).code;
 let bundle=read(baselineDir,'app/bundle.js');const before=sections(bundle),old=before.get('screens-admin.jsx'),prefix='/* @@file screens-admin.jsx */\n(function(){\n',suffix='\n})();\n';
 assert(old.startsWith(prefix)&&old.endsWith(suffix));assert.equal(compile(oldAdmin),compile(old.slice(prefix.length,-suffix.length)),'PUBLISHED_SOURCE_MISMATCH');bundle=once(bundle,old,prefix+compile(admin)+suffix);
 const fresh=['investors-model.js','investors-repository.js','investors-admin.jsx'];let blocks='';for(const name of fresh){const code=read(root,'app/'+name).trimEnd();new vm.Script(code);blocks+='/* @@file '+name+' */\n(function(){\n'+code+'\n})();\n';fs.copyFileSync(path.join(root,'app',name),path.join(target,'app',name));}
 const anchor=before.get('reports-jc-admin.jsx');assert(anchor);bundle=once(bundle,anchor,anchor+blocks);const after=sections(bundle);for(const [name,block]of before)if(name!=='screens-admin.jsx')assert.equal(after.get(name),block,'UNRELATED_PUBLISHED_MODULE:'+name);new vm.Script(bundle);
 fs.writeFileSync(path.join(target,'app/screens-admin.jsx'),admin);fs.writeFileSync(path.join(target,'app/bundle.js'),bundle);
 let build=read(baselineDir,'scripts/build-bundle.js');const pos=build.split('\n').find(l=>l.includes("'reports-jc-admin.jsx'"));assert(pos);build=once(build,pos,pos+"\n  'investors-model.js', 'investors-repository.js', 'investors-admin.jsx',");fs.writeFileSync(path.join(target,'scripts/build-bundle.js'),build);
 const version='2026102901',html=fs.readFileSync(path.join(baselineDir,'SutiApp.html'),'utf8'),sw=fs.readFileSync(path.join(baselineDir,'sw.js'),'utf8'),previous=/app\/bundle\.js\?v=(\d+)/.exec(html)[1];
 const nextHtml=html.replaceAll('app/bundle.js?v='+previous,'app/bundle.js?v='+version).replaceAll('./sw.js?v='+previous,'./sw.js?v='+version),nextSw=sw.replaceAll('sutiapp-v'+previous,'sutiapp-v'+version).replaceAll('app/bundle.js?v='+previous,'app/bundle.js?v='+version);
 assert.equal(nextSw.replaceAll(version,previous),sw,'SW_LOGIC_CHANGED');assert.equal(nextHtml.replaceAll(version,previous),html,'HTML_NONCACHE_CHANGED');
 fs.writeFileSync(path.join(target,'SutiApp.html'),nextHtml);fs.writeFileSync(path.join(target,'sw.js'),nextSw);
 for(const f of ['supabase/migrations/20261029000100_investors.sql','supabase/recovery/20261029000100_investors.sql','docs/audits/H-ADMIN-INVERSIONISTAS-001.md',...fs.readdirSync(path.join(root,'scripts')).filter(n=>n.includes('investors')).map(n=>'scripts/'+n)]){fs.mkdirSync(path.dirname(path.join(target,f)),{recursive:true});fs.copyFileSync(path.join(root,f),path.join(target,f));}
 const guard=require(path.join(target,'scripts/screen-permission-contract'));const structural=guard.check();assert.equal(structural.status,'PASS');
 const env=environment(),site=path.join(privateDir,'site-'+sha(bundle).slice(0,12));if(!fs.existsSync(site))cp.execFileSync(process.execPath,['scripts/build-pages-site.js',site],{cwd:target,env:{...process.env,SUTIAPP_SUPABASE_URL:env.SUPABASE_URL,SUTIAPP_SUPABASE_PUBLISHABLE_KEY:env.SUPABASE_PUBLISHABLE_KEY},stdio:'pipe'});
 const result={status:'PASS',baseCommit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:target,encoding:'utf8'}).trim(),bundleSha256:sha(bundle),preservedPublishedModules:before.size-1,newModules:fresh,adminInsertions:4,cachebusterOnly:true,structuralPermissions:'PASS',site,version};
 fs.writeFileSync(path.join(privateDir,'release-manifest.json'),JSON.stringify(result,null,2));fs.writeFileSync(path.join(root,'docs/qa/evidence/investors/release-candidate.json'),JSON.stringify({...result,site:undefined},null,2)+'\n');console.log(JSON.stringify({...result,site:undefined}));
}
main();
