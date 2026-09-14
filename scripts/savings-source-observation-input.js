'use strict';
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');
module.exports=function input(){
 const file='tmp/savings-runtime-20260913/source-snapshot.json',raw=fs.readFileSync(file),snapshot=JSON.parse(raw);
 const manifest=JSON.parse(fs.readFileSync('tmp/savings-runtime-20260913/source-equivalence-manifest.json','utf8'));
 assert.equal(manifest.status,'PASS');assert.equal(manifest.original_folio_sequence_unchanged,true);
 const folios=snapshot.savings.find(x=>x.range==='Ahorro!A1:A367').values;
 const rows=manifest.changed_source_rows.map(r=>({source_row:r.source_row,folio:String(folios[r.source_row-1][0]),source_total:r.cells.find(c=>c.column==='Q').after,
  changes:r.cells.filter(c=>c.date).map(c=>({key:c.column,date:c.date,previous:c.before,current:c.after}))}));
 assert.equal(rows.length,3);assert.equal(rows.reduce((n,r)=>n+r.changes.length,0),6);
 return {sha:crypto.createHash('sha256').update(raw).digest('hex'),observed_at:snapshot.observed_at,rows};
};
