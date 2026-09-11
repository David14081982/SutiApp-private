'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),vm=require('vm'),assert=require('assert').strict;
const root=path.resolve(__dirname,'..'),file='app/screens-admin-finanzas.jsx',read=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/\r\n/g,'\n');
const before=cp.execFileSync('git',['show','1795be0:'+file],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n'),after=read(file);
const blocks=[['  function DesktopFinancialWorkbench(', '    const renderConditions ='],['  function useFinancialDocumentPreviews(', '  function FinanceQueuePhoto('],['    const renderConditions =','    const renderDocumentRows ='],['    const renderNavigation =','    const renderDetail ='],['  function FinanzasModule(',null]];
for(const [start,end] of blocks){const take=s=>{const a=s.indexOf(start),b=end?s.indexOf(end,a):s.length;assert(a>=0&&b>a,start);return s.slice(a,b);};assert.equal(take(after),take(before),'Changed protected logic: '+start);}
// Compare every handler expression independently of the new parent layout.
const sandbox={};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('C:/tmp/sutiapp-babel-7.28.4.min.js','utf8'),sandbox);
function handlers(source){const ast=sandbox.Babel.transform(source,{ast:true,code:false}).ast,result=[];function walk(n){if(!n||typeof n!=='object')return;if(n.type==='ObjectProperty'&&/^on[A-Z]/.test(n.key.name||n.key.value||''))result.push((n.key.name||n.key.value)+':'+source.slice(n.value.start,n.value.end));for(const [key,value]of Object.entries(n))if(key!=='loc')Array.isArray(value)?value.forEach(walk):walk(value);}walk(ast);return result.sort();}
assert.deepEqual(handlers(after),handlers(before),'Event callbacks changed');new vm.Script(after);
const gitRead=f=>cp.execFileSync('git',['show','1795be0:'+f],{cwd:root,maxBuffer:30e6,encoding:'utf8'}).replace(/\r\n/g,'\n');
const workerShape=s=>s.replace(/const CACHE = 'sutiapp-v\d+';/,"const CACHE = '[VERSION]';").replace(/app\/bundle\.js\?v=\d+/g,'app/bundle.js?v=VERSION');
assert.equal(workerShape(read('sw.js')),workerShape(gitRead('sw.js')),'Service worker logic changed');
assert.equal(read('SutiApp.html').replace(/app\/bundle\.js\?v=\d+/g,'app/bundle.js?v=VERSION'),gitRead('SutiApp.html').replace(/app\/bundle\.js\?v=\d+/g,'app/bundle.js?v=VERSION'),'HTML changed beyond bundle reference');
const chunks=s=>new Map(s.split(/(?=\/\* @@file )/).filter(Boolean).map(c=>[c.match(/@@file ([^ ]+)/)[1],c]));
const oldChunks=chunks(gitRead('app/bundle.js')),newChunks=chunks(read('app/bundle.js'));
assert.deepEqual([...newChunks.keys()],[...oldChunks.keys()]);
assert.deepEqual([...newChunks.keys()].filter(k=>newChunks.get(k)!==oldChunks.get(k)),['screens-admin-finanzas.jsx'],'Unexpected generated module changed');
const out=path.join(root,'docs/qa/evidence/finance-detail-ui-20260909');fs.mkdirSync(out,{recursive:true});
const result={status:'PASS',baseline:'1795be0',identicalBlocks:blocks.length,identicalEventHandlers:handlers(after).length,changedBundleModules:['screens-admin-finanzas.jsx'],serviceWorkerLogic:'IDENTICAL',scope:'single screen presentation; shared repositories, sister tabs and callbacks unchanged'};
fs.writeFileSync(path.join(out,'scope-result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
