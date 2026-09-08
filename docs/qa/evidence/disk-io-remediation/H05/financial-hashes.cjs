'use strict';
const a=require('./audit.cjs');
(async()=>{const label=process.argv[2]||'before',result={at:new Date().toISOString(),tables:[]};for(const t of require('./BASELINE.json').tables){const r=await a.query(`select '${t.relname}' relation,count(*) rows,md5(string_agg(h,'' order by h)) hash from (select md5(row_to_json(t)::text) h from public.${t.relname} t) rows`);result.tables.push(r[0]);}a.save('financial-hashes-'+label,result);console.log('Financial tables hashed: '+result.tables.length);})().catch(e=>{console.error(e.message);process.exitCode=1;});
