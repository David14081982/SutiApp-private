'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const base=require('../H04/audit.cjs');
const dir=__dirname,save=(name,value)=>fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify(value,null,2)+'\n');
const files=['app/program-catalog-repository.js','app/catalog-store.jsx','app/program-catalog-admin-store.jsx','app/screens-marketplace.jsx','app/screens-catalogo.jsx','app/screens-admin-program-products.jsx','app/document-workflow-repository.js','app/screens-documentos.jsx','app/screens-loan.jsx','app/screens-admin-documents.jsx','scripts/build-bundle.js'];
async function baseline(){
 if(fs.existsSync(dir+'/BASELINE.json'))throw Error('BASELINE_EXISTS');
 const gates={};for(let i=1;i<=5;i++){const h='H0'+i;gates[h]=fs.readFileSync(path.join(dir,'..',h,'VERIFICATION.md'),'utf8').includes(h+' STATUS: PASS');if(!gates[h])throw Error(h+'_NOT_PASS');}save('preconditions',{at:new Date().toISOString(),gates});
 const hashes={};for(const f of new Set(cp.execFileSync('git',['ls-files','-co','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean))){if(f.startsWith('docs/qa/evidence/disk-io-remediation/H06/'))continue;try{hashes[f]=crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');}catch(_){}}save('workspace-before',{at:new Date().toISOString(),hashes});
 for(const f of files){for(const kind of ['workspace','published']){fs.mkdirSync(dir+'/before/'+kind,{recursive:true});fs.writeFileSync(dir+'/before/'+kind+'/'+path.basename(f),kind==='workspace'?fs.readFileSync(f):cp.execFileSync('git',['show','c047eec:'+f]));}}
 const data={at:new Date().toISOString(),published:'c047eec42ca66d5fab105feca662a9657aac83b0'};
 for(const name of ['functions','policies','tables','columns','constraints','indexes','counts']){data[name]=await base.query(base.catalog[name]);console.log(name+': '+data[name].length);}
 data.catalog=await base.query("select p.program_key,count(*) items,count(*) filter(where p.enabled) enabled,(select count(*) from program_catalog_item_assets a join program_catalog_items i on i.id=a.item_id where i.program_key=p.program_key and a.enabled) links,(select count(*) from program_catalog_item_assets a join program_catalog_items i on i.id=a.item_id where i.program_key=p.program_key and a.enabled and a.private_asset_id is not null) private_links from program_catalog_items p group by p.program_key order by p.program_key");
 data.fingerprints=await base.query("select 'program_catalog_items' relation,count(*) rows,md5(string_agg(md5(to_jsonb(t)::text),'' order by id)) hash from program_catalog_items t union all select 'program_catalog_item_assets',count(*),md5(string_agg(md5(to_jsonb(t)::text),'' order by id)) from program_catalog_item_assets t union all select 'affiliate_documents',count(*),md5(string_agg(md5(to_jsonb(t)::text),'' order by id)) from affiliate_documents t");
 save('BASELINE',data);console.log(JSON.stringify({catalog:data.catalog,fingerprints:data.fingerprints}));
}
if(require.main===module)baseline().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={...base,dir,save,files};
