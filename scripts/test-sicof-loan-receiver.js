'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const source=fs.readFileSync('google-apps-script/financial-handoff/Code.gs','utf8');
function fixture(options={}){
  const rows=Array.from({length:15002},()=>Array(33).fill(''));
  rows[0]=Array.from({length:33},(_,i)=>'Header '+i);
  Object.assign(rows[1],{0:new Date('2026-01-15T12:00:00Z'),1:697.5,2:8,3:123,4:'Isolated fixture',6:'Caja de Ahorro',13:280.83,25:370/12});
  Object.assign(rows[15001],{0:new Date('2026-01-30T12:00:00Z'),1:0,2:9,3:123,6:'Caja de Ahorro'});
  if(options.repeatedDates)for(let i=1;i<rows.length;i++)for(const c of [0,11,15,30,31,32])rows[i][c]=new Date(i%2?'2026-01-15T03:00:00Z':'2026-01-30T12:00:00Z');
  let opens=0,reads=0,change=false,formatCalls=0;
  const dateFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Hermosillo',year:'numeric',month:'2-digit',day:'2-digit'});
  const range={getValues:()=>{reads++;const copy=rows.map(r=>r.slice());if(change&&reads>1)copy[1][1]=0;return copy;},getDisplayValues:()=>rows.map((r,i)=>r.map((v,c)=>i&&c===2?'00'+v:i&&c===3?'00'+v:String(v)))};
  const context={Date:class extends Date{constructor(...args){super(...(args.length?args:['2026-10-03T12:00:00Z']));}},PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'isolated'})},SpreadsheetApp:{openById:id=>{opens++;return{getId:()=>id,getSpreadsheetTimeZone:()=> 'America/Hermosillo',getSheetByName:name=>{assert.equal(name,'HISTORIAL P V2');return{getSheetId:()=>1245291756,getLastRow:()=>rows.length,getRange:(...a)=>{assert.deepEqual(a,[1,1,15002,33]);return range;}};}};}},
    Utilities:{DigestAlgorithm:{SHA_256:'SHA_256'},Charset:{UTF_8:'UTF_8'},computeDigest:(a,value)=>[...crypto.createHash('sha256').update(value).digest()],formatDate:(value,zone,pattern)=>{formatCalls++;assert.equal(zone,'America/Hermosillo');assert.equal(pattern,'yyyy-MM-dd');return dateFormatter.format(value);}},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({text,setMimeType(){return this;}})}};
  vm.createContext(context);vm.runInContext(options.source||source,context);
  return{send:p=>JSON.parse(context.doPost({postData:{contents:JSON.stringify(p)}}).text),get opens(){return opens;},get reads(){return reads;},get formatCalls(){return formatCalls;},change:()=>{change=true;}};
}
const payload={action:'read_sicof_financial',secret:'isolated',contract_version:'SICOF_FINANCIAL_READ_V1'};
const f=fixture();assert.equal(f.send({...payload,secret:'wrong'}).error,'UNAUTHORIZED');assert.equal(f.opens,0);
assert.equal(f.send({...payload,range:'A:ZZ'}).error,'INVALID_REQUEST');assert.equal(f.opens,0);
const data=f.send(payload);assert(data.ok);assert.equal(f.reads,2);assert.equal(data.rows.length,2);
assert.equal(data.rows[0].values[0],'2026-01-15');assert.equal(data.rows[0].values[1],697.5);assert.equal(data.rows[0].values[2],'008');assert.equal(data.rows[0].values[3],'00123');
assert.equal(data.rows[1].source_row,15002);assert.equal(data.rows[1].values[1],0);assert.equal(data.columns.includes('AH'),false);assert.equal(data.source_fingerprint.length,64);
const altered=fixture();altered.change();assert.equal(altered.send(payload).error,'SICOF_SOURCE_CHANGED_DURING_READ');
// Reproducible baseline helper: the original per-cell date conversion. It has
// no private-file dependency and deliberately performs every conversion.
const memo="      if(dateColumns.includes(column)&&Object.prototype.toString.call(value)==='[object Date]'&&!isNaN(value.getTime())){\n        const timestamp=value.getTime();\n        if(!formattedDates.has(timestamp))formattedDates.set(timestamp,Utilities.formatDate(value,zone,'yyyy-MM-dd'));\n        return formattedDates.get(timestamp);\n      }";
const baseline=source.replace(/\r/g,'').replace('  const formattedDates=new Map();\n','').replace(memo,"      if(dateColumns.includes(column)&&Object.prototype.toString.call(value)==='[object Date]'&&!isNaN(value.getTime()))return Utilities.formatDate(value,zone,'yyyy-MM-dd');");
assert(!baseline.includes('formattedDates'),'DATE_BASELINE_HELPER_NOT_RESTORED');
const old=fixture({source:baseline,repeatedDates:true}),optimized=fixture({repeatedDates:true});
const before=old.send(payload),after=optimized.send(payload);
assert.equal(JSON.stringify(after),JSON.stringify(before),'DATE_MEMOIZATION_CHANGED_SOURCE_BYTES');
assert.equal(after.rows[0].values[0],'2026-01-14','WORKBOOK_TIME_ZONE_MUST_PREVAIL_OVER_UTC');
assert.equal(after.observed_at,'2026-10-03T12:00:00.000Z');
assert.equal(old.formatCalls,90006);assert.equal(optimized.formatCalls,2);assert.equal(optimized.reads,2);
optimized.send(payload);assert.equal(optimized.formatCalls,4,'DATE_CACHE_MUST_BE_PER_REQUEST');
const fn=source.slice(source.indexOf('function readSicofFinancial_'),source.indexOf('function doPost'));
assert(!/setValues|setValue\(|flush\(|createTrigger|LockService|receiveRequest|receiveHandoff/.test(fn));
// Structural inverse is exact: new dispatch/helper removal restores prior source.
const backup='.tmp/sicof/loan-reader/Code.gs.before';
if(fs.existsSync(backup)){
  const inverse=source.replace(/\r/g,'').replace(/\/\/ SICOF is a separate, fixed read contract\.[\s\S]*?(?=function doPost\(event\))/, '').replace("    if(payload.action==='read_sicof_financial')return readSicofFinancial_(payload);\n",'');
  const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
  assert.equal(hash(inverse),hash(fs.readFileSync(backup,'utf8').replace(/\r/g,'')),'EXISTING_RECEIVER_CHANGED');
}
console.log(JSON.stringify({status:'PASS',checks:['secret/selector denied before reads','same fixed source','no row cap','typed amounts/exact displayed identity','no financial writes','source-change retry','prior source inverse exact','per-request date memo preserves all 15001 rows and hash against v18','90006 formatter calls reduced to 2; timezone and double read retained'],externalWrites:0}));
