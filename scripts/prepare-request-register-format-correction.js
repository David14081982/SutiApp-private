'use strict';
// Offline plan only. Actual mutation uses authenticated Sheets connector and a fresh cell reread.
const fs=require('fs'),assert=require('assert').strict,path=require('path'),crypto=require('crypto');
const dir='C:/tmp/sutiapp-register-format-backup-20260908',read=n=>JSON.parse(fs.readFileSync(path.join(dir,n))),snapshot=read('sheet-before.json'),tail=read('target-before.json'),sources=read('request-source.json');
const target=snapshot.sheets.find(s=>s.properties.sheetId===10616270),registry=snapshot.sheets.find(s=>s.properties.sheetId===2026082207),requests=[],rollback=[],changes=[];
const value=c=>Object.values(c?.userEnteredValue||{})[0]??'';
function cell(sheetId,row,col,before,after,fields='userEnteredValue'){
  assert(!before?.userEnteredValue?.formulaValue,'FORMULA_PROTECTED');assert(!before?.dataValidation,'VALIDATION_REVIEW_REQUIRED');
  requests.push({updateCells:{start:{sheetId,rowIndex:row-1,columnIndex:col-1},rows:[{values:[after]}],fields}});
  rollback.push({updateCells:{start:{sheetId,rowIndex:row-1,columnIndex:col-1},rows:[{values:[before||{}]}],fields}});
}
for(const [i,r] of tail.sheets[0].data[0].rowData.entries()){
  const cells=r.values,vals=cells.map(value),matches=sources.filter(s=>s.initial_row?.[9]===vals[9]&&String(s.numero_control)===String(vals[1]));assert.equal(matches.length,1,'AMBIGUOUS_IDENTITY');const source=matches[0];
  assert(source.initial_row.every((v,c)=>[0,24].includes(c)||String(v??'')===String(vals[c]??'')),'CAPTURED_FIELDS_CHANGED');assert(/^SR-\d{4}-\d{6,}$/.test(source.folio));
  const row=2317+i,day=source.initial_row[9].slice(0,10),serial=Date.parse(day+'T00:00:00Z')/86400000+25569;
  cell(10616270,row,1,cells[0],{userEnteredValue:{stringValue:source.folio}});
  cell(10616270,row,10,cells[9],{userEnteredValue:{numberValue:serial}});
  const registrations=registry.data[0].rowData.map((r,i)=>({r,i})).filter(({r})=>value(r.values?.[0])===source.id);assert.equal(registrations.length,1);
  const entry=registrations[0],m=entry.r.values[12],meta=JSON.parse(value(m).slice('REQUEST_SYNC_V1:'.length));assert.equal(meta.initial_sha256,crypto.createHash('sha256').update(JSON.stringify(source.initial_row)).digest('hex').toUpperCase());
  cell(2026082207,entry.i+1,13,m,{userEnteredValue:{stringValue:'REQUEST_SYNC_V1:'+JSON.stringify({...meta,folio:source.folio})}});
  changes.push({row,folio:source.folio,date:day.split('-').reverse().join('/'),statusPreserved:vals[24]});
}
const dates=target.data.find(d=>d.startColumn===9);assert.equal(dates.rowData.length,2319);
requests.push({repeatCell:{range:{sheetId:10616270,startRowIndex:1,endRowIndex:2319,startColumnIndex:9,endColumnIndex:10},cell:{userEnteredFormat:{numberFormat:{type:'DATE',pattern:'dd/MM/yyyy'}}},fields:'userEnteredFormat.numberFormat'}});
for(let i=1;i<dates.rowData.length;i++)rollback.push({updateCells:{start:{sheetId:10616270,rowIndex:i,columnIndex:9},rows:[{values:[dates.rowData[i].values?.[0]||{}]}],fields:'userEnteredFormat.numberFormat'}});
let approvals=0;for(const [i,r] of target.data.find(d=>d.startColumn===24).rowData.entries())if(i&&value(r.values?.[0])==='APROBADO'){cell(10616270,i+1,25,r.values[0],{userEnteredValue:{stringValue:'Aprobado'}});approvals++;}
for(const file of [['correction-requests.json',requests],['rollback-requests.json',rollback]])fs.writeFileSync(path.join(dir,file[0]),JSON.stringify(file[1],null,2));
const proof={status:'PASS',mode:'plan-only',changes,uppercaseApprovalsFound:approvals,dateFormatRange:'J2:J2319',otherLegacyIdsPreserved:true,excluded:'AH onward',requests:requests.length,registryChanges:'M: folio metadata only; immutable row references untouched'};
fs.writeFileSync(path.resolve(__dirname,'../docs/qa/evidence/register-format-20260908/correction-plan.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
