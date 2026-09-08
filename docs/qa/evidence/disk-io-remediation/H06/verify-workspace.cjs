'use strict';
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert').strict,a=require('./audit.cjs');
const before=JSON.parse(fs.readFileSync(a.dir+'/workspace-before.json')).hashes;
const scope=new Set(a.files.concat('app/private-resource-demand.js','app/image-viewer.jsx','app/bundle.js','SutiApp.html','sw.js','scripts/test-catalog-resource-demand.js','scripts/test-catalog-resource-demand-browser.js','scripts/test-program-catalog-cutover.js','scripts/test-program-products-admin-cutover.js','scripts/test-membership-document-thumbnail-viewer.js','docs/AGENT_CHANGELOG.md','docs/qa/evidence/disk-io-remediation/README.md'));
const allowed=f=>scope.has(f)||f.startsWith('docs/qa/evidence/disk-io-remediation/H06/')||/^docs\/architecture\/(SUTIAPP_ARCHITECTURE_REGISTRY|registry-(code|data|edges|search))\.json$/.test(f);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),changed=[],removed=[],unexpected=[];
for(const[f,h]of Object.entries(before)){if(!fs.existsSync(f)){removed.push(f);continue;}if(sha(fs.readFileSync(f))!==h){changed.push(f);if(!allowed(f))unexpected.push(f);}}
const files=[...new Set(cp.execFileSync('git',['ls-files','-co','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean))],added=files.filter(f=>!Object.hasOwn(before,f));for(const f of added)if(!allowed(f))unexpected.push(f);
const secrets=Object.entries(a.env()).filter(([k,v])=>/PASSWORD|ACCESS_TOKEN|SECRET_KEY|SERVICE_ROLE/.test(k)&&v.length>=8),leaks=[];
for(const f of [...changed,...added].filter(allowed)){if(!fs.existsSync(f))continue;const value=fs.readFileSync(f,'utf8');for(const[k,v]of secrets)if(value.includes(v))leaks.push({file:f,key:k});}
assert.deepEqual(unexpected,[]);assert.deepEqual(removed,[]);assert.deepEqual(leaks,[]);
const read=f=>fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');
for(const[file,start,end]of [['program-catalog-repository.js','  async function createRequest','  window.ProgramCatalogRepository'],['document-workflow-repository.js','  async function compressImage','  window.DocumentWorkflowRepository']]){const old=read(a.dir+'/before/workspace/'+file),now=read('app/'+file);assert.equal(now.slice(now.indexOf(start),now.indexOf(end)),old.slice(old.indexOf(start),old.indexOf(end)),file+' writer drift');}
assert.equal(read('app/screens-loan.jsx'),read(a.dir+'/before/workspace/screens-loan.jsx').replace('await window.ProgramCatalogRepository.listItems()',"await window.ProgramCatalogRepository.listItems({programKey:'prestamo',includeAssets:false})"));
a.save('workspace-preservation',{at:new Date().toISOString(),status:'PASS',baselineFiles:Object.keys(before).length,changed,added,removed,unexpected,secretValueMatches:0,preexistingWorkPreserved:true,programAndDocumentWritersUnchanged:true,loanSelectorOnly:true});console.log(JSON.stringify({status:'PASS',baseline:Object.keys(before).length,changed:changed.length,added:added.length,unexpected:0,secrets:0}));
