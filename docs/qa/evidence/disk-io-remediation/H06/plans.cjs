'use strict';
const fs=require('fs'),a=require('./audit.cjs');
(async()=>{
 const fields=fs.readFileSync('app/program-catalog-repository.js','utf8').match(/select\('(id,program_key,name[^']+)'\)/)[1];
 const ids=(await a.query("select id from program_catalog_items where enabled and program_key='auto' order by sort_order")).map(x=>x.id);
 if(ids.some(id=>!/^[a-f0-9-]{36}$/.test(id)))throw Error('INVALID_ID');
 const items="select "+fields+" from public.program_catalog_items where enabled ";
 const links="select l.id,l.item_id,l.public_asset_id,l.private_asset_id,l.role,l.sort_order,l.enabled,l.source_column,l.source_column_letter,pa.id private_id,pa.storage_bucket,pa.storage_path,pa.mime_type,pa.status,pub.id public_id,pub.asset_key,pub.storage_bucket,pub.storage_path,pub.mime_type,pub.alt_text,pub.status from public.program_catalog_item_assets l left join public.private_assets pa on pa.id=l.private_asset_id left join public.app_assets pub on pub.id=l.public_asset_id where l.enabled ";
 const queries={itemsBefore:items+'order by program_key,sort_order',itemsAfter:items+"and program_key='auto' order by program_key,sort_order",linksBefore:links+'order by l.sort_order',linksAfter:links+"and l.item_id in ("+ids.map(x=>"'"+x+"'").join(',')+') order by l.sort_order'};
 const result={at:new Date().toISOString(),scope:'Representative authenticated RLS SQL shapes; embedded REST query overhead not inferred',plans:{}};
 for(const [name,sql]of Object.entries(queries)){
  const rows=await a.raw("begin read only;set local statement_timeout='20s';set local lock_timeout='2s';"+a.principal+'explain(analyze,buffers,format json) '+sql+';rollback;');
  const plan=rows[0]['QUERY PLAN'][0];result.plans[name]=a.planSummary(plan);console.log(JSON.stringify({name,...result.plans[name]}));
 }
 a.save('plans',result);
})().catch(e=>{console.error(e.message);process.exitCode=1;});
