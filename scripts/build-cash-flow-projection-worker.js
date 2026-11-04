'use strict';
// Deterministic, dependency-selected build. Financial logic remains in the original modules.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),base=path.join(root,'supabase/functions/reports-jc');
const moduleNames=['cash-flow.mjs','cash-flow-loans.mjs','cash-flow-savings.mjs','cash-flow-consolidated.mjs','cash-flow-investors.mjs','cash-flow-investor-continuity.mjs','cash-flow-source-bases.mjs','report.mjs'];
const reportExports=new Set(['sourceDate','fundGroup','requestStatus','ReportError']);
const globals=new Set(['Array','Object','String','Number','Boolean','Math','Date','Intl','JSON','Map','Set','WeakMap','WeakSet','Error','TypeError','RegExp','BigInt','Infinity','NaN','undefined','structuredClone','parseInt','parseFloat','isNaN','isFinite']);
const denied=['fetch','XMLHttpRequest','WebSocket','EventSource','importScripts','Worker','SharedWorker','BroadcastChannel','indexedDB','localStorage','sessionStorage','caches','navigator'];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
let babel;
function compiler(){if(babel)return babel;const sandbox={};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(process.env.SUTIAPP_BABEL_PATH||'C:/tmp/babel-standalone-7.29.0.min.js','utf8'),sandbox);return babel=sandbox.Babel;}
function compile(options={}){
 const Babel=compiler(),modules=new Map();
 const sourceFor=name=>options.sources&&Object.hasOwn(options.sources,name)?options.sources[name]:fs.readFileSync(path.join(base,name),'utf8');
 function load(name){
  assert(moduleNames.includes(name),'WORKER_MODULE_FORBIDDEN:'+name);
  if(modules.has(name))return modules.get(name);
  const source=sourceFor(name).replace(/\r\n/g,'\n');let program;
  const parsed=Babel.transform(source,{ast:true,code:false,sourceType:'module',plugins:[()=>({visitor:{Program(p){program=p;}}})]});
  const item={name,source,ast:parsed.ast,program,wanted:new Set(),selected:new Set(),statements:new Set(),imports:new Map()};modules.set(name,item);return item;
 }
 function select(name,exportName){
  const item=load(name);if(name==='report.mjs')assert(reportExports.has(exportName),'WORKER_REPORT_EXPORT_FORBIDDEN:'+exportName);
  const exported=item.program.get('body').some(p=>p.isExportNamedDeclaration()&&(p.node.declaration?.id?.name===exportName||p.node.declaration?.declarations?.some(d=>d.id.name===exportName)||p.node.specifiers?.some(s=>s.exported.name===exportName)));
  assert(exported,'WORKER_EXPORT_MISSING:'+name+':'+exportName);item.wanted.add(exportName);binding(item,exportName);
 }
 function binding(item,name){
  if(item.selected.has(name))return;item.selected.add(name);
  const b=item.program.scope.getBinding(name);assert(b,'WORKER_BINDING_MISSING:'+item.name+':'+name);
  if(b.path.isImportSpecifier()){
   const declaration=b.path.parentPath.node,dependency=declaration.source.value;
   assert(/^\.\/[^/]+\.mjs$/.test(dependency),'WORKER_IMPORT_FORBIDDEN:'+dependency);
   const module=dependency.slice(2),imported=b.path.node.imported.name;
   item.imports.set(name,{module,imported});select(module,imported);return;
  }
  assert(!b.path.isImportDefaultSpecifier()&&!b.path.isImportNamespaceSpecifier(),'WORKER_IMPORT_FORM_FORBIDDEN');
  let statement=b.path;while(!statement.parentPath.isProgram())statement=statement.parentPath;
  if(item.statements.has(statement.node))return;item.statements.add(statement.node);
  statement.traverse({ReferencedIdentifier(p){
   const dependency=p.scope.getBinding(p.node.name);
   if(dependency?.scope===item.program.scope)binding(item,dependency.identifier.name);
   else if(!dependency)assert(globals.has(p.node.name),'WORKER_GLOBAL_FORBIDDEN:'+item.name+':'+p.node.name);
  },Import(){throw Error('WORKER_DYNAMIC_IMPORT_FORBIDDEN');}});
 }
 select('cash-flow.mjs','projectCashFlowSnapshot');
 const order=[],done=new Set(),active=new Set();function orderModule(name){if(done.has(name))return;assert(!active.has(name),'WORKER_IMPORT_CYCLE');active.add(name);for(const dep of [...new Set([...modules.get(name).imports.values()].map(i=>i.module))].sort())orderModule(dep);active.delete(name);done.add(name);order.push(name);}orderModule('cash-flow.mjs');
 const manifest=order.map(name=>({name,sha256:sha(modules.get(name).source),exports:[...modules.get(name).wanted].sort()}));
 const chunks=order.map(name=>{
  const m=modules.get(name),body=m.ast.program.body.filter(n=>m.statements.has(n)).map(n=>n.type==='ExportNamedDeclaration'?n.declaration:n);
  const ast={type:'File',program:{type:'Program',sourceType:'script',body,directives:[]}};
  const code=Babel.transformFromAst(ast,null,{code:true,ast:false,comments:false,compact:false}).code;
  const imports=[...m.imports].sort(([a],[b])=>a.localeCompare(b)).map(([local,i])=>'const '+local+'=modules['+JSON.stringify(i.module)+']['+JSON.stringify(i.imported)+'];').join('\n');
  return 'modules['+JSON.stringify(name)+']=(()=>{\n'+imports+'\n'+code+'\nreturn {'+[...m.wanted].sort().join(',')+'};\n})();';
 });
 const code='/* GENERATED by scripts/build-cash-flow-projection-worker.js\n'+manifest.map(m=>m.name+' sha256 '+m.sha256).join('\n')+'\nPure projection of an authorized in-memory snapshot; no credentials, network or persistence. */\n'+
  "'use strict';\n"+'for(const name of '+JSON.stringify(denied)+'){Object.defineProperty(self,name,{value:undefined,writable:false,configurable:false});}\n'+
  'const modules=Object.create(null);\n'+chunks.join('\n')+'\n'+
  "self.onmessage=event=>{const id=event.data?.id;try{if(!((typeof id==='string'&&id.length<=64)||(typeof id==='number'&&Number.isSafeInteger(id))))throw Error('CASH_FLOW_REQUEST_INVALID');const data=modules['cash-flow.mjs'].projectCashFlowSnapshot(event.data.snapshot);self.postMessage({id,data});}catch(error){const code=/^(?:CASH_FLOW|SAVINGS|INVESTOR|LOAN|AMOUNT)_[A-Z0-9_]+$/.test(error?.message||'')?error.message:'CASH_FLOW_PROJECTION_FAILED';self.postMessage({id:typeof id==='number'||typeof id==='string'?id:null,error:code});}finally{self.close();}};\n";
 assert(!/google-auth|createReadOnlyAssertion|TOKEN_ENDPOINT|GOOGLE_SERVICE_ACCOUNT|private_key|service_role|Deno\.|https?:\/\//i.test(code),'WORKER_PRIVILEGED_CODE');
 new vm.Script(code,{filename:'cash-flow-projection-worker.js'});
 return {code,manifest,sha256:sha(code),bytes:Buffer.byteLength(code)};
}
function build(options={}){
 const result=compile(options),file=path.join(root,'app/cash-flow-projection-worker.js');
 if(options.check)assert.equal(fs.readFileSync(file,'utf8'),result.code,'CASH_FLOW_WORKER_STALE');
 else{const temporary=file+'.next';assert(!fs.existsSync(temporary),'WORKER_UNFINISHED_WRITE');fs.writeFileSync(temporary,result.code,'utf8');assert.equal(sha(fs.readFileSync(temporary)),result.sha256);fs.renameSync(temporary,file);}
 return {status:'PASS',workerSha256:result.sha256,bytes:result.bytes,modules:result.manifest};
}
module.exports={compile,build,denied};
if(require.main===module)console.log(JSON.stringify(build({check:process.argv.includes('--check')})));