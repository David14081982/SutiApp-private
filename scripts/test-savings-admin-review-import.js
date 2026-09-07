'use strict';
const assert=require('assert/strict');
const {prepare}=require('./import-savings-admin-review');
function verify(prepared){
 const {source,records}=prepared,finances=source.savings.find(x=>x.sheet==='Ahorro'&&x.range.includes('D1:DW'));
 let blanks=0,zeros=0;
 for(const row of records.filter(r=>r.source_sheet==='Ahorro')){
  const defs=new Map(row.field_defs.map(d=>[d.key,d]));
  assert.equal(defs.get('Z').kind,'date');assert.equal(defs.get('AA').kind,'money');assert.equal(defs.get('DO').kind,'money');
  assert.match(defs.get('AA').label,/^\d{4}-\d{2}-\d{2}/);assert.match(defs.get('DO').label,/^\d{4}-\d{2}-\d{2}/);
  for(const [i,header] of finances.values[0].entries()){
   let n=i+4,key='';while(n){key=String.fromCharCode(65+(n-1)%26)+key;n=Math.floor((n-1)/26);}
   const original=finances.values[row.source_row-1]?.[i];
   if(defs.get(key).kind==='money'){
    if(original==null||original===''){assert.equal(row.source_data[key],null);blanks++;}
    if(original===0){assert.equal(row.source_data[key],0);zeros++;}
    if(typeof original==='number')assert.equal(row.source_data[key],Math.round((original+Math.sign(original)*Number.EPSILON)*100)/100);
   }
  }
 }
 for(const row of records.filter(r=>r.source_sheet!=='Ahorro'&&r.source_sheet!=='HISTORIAL P V2'))for(const [i,def] of row.field_defs.entries()){
  if(row.raw_source[i]==null||row.raw_source[i]==='')assert.equal(row.source_data[def.key],null);
 }
 assert.equal(records.length,1463);assert(blanks>0);assert(zeros>0);
 return {status:'PASS',records:records.length,blank_cells_preserved:blanks,explicit_zero_cells_preserved:zeros,matrix_bounds:'AA:DO; Z remains date'};
}
module.exports={verify};if(require.main===module)console.log(JSON.stringify(verify(prepare(process.argv[2]))));
