'use strict';
// Isolated Apps Script fixture: no credentials, network access or Sheet writes.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const source=fs.readFileSync('google-apps-script/financial-handoff/Code.gs','utf8');
const payload={action:'read_self_history',contract_version:'SELF_HISTORY_READ_V1',secret:'fixture-secret',folio:'0007'};
const previousScan=`  function scan(sheet,width,ownerColumn){
    const count=sheet.getLastRow();if(count<1)throw new Error('LOAN_SOURCE_UNAVAILABLE');
    const range=sheet.getRange(1,1,count,width),values=range.getValues(),display=range.getDisplayValues();
    const notes=sheet===requests?sheet.getRange(1,1,count,1).getNotes():null;
    if(count!==sheet.getLastRow()||JSON.stringify(values)!==JSON.stringify(range.getValues()))throw new Error('HISTORY_SOURCE_CHANGED');
    return {header:display[0],rows:values.map(function(row,i){return {row:row,display:display[i],note:notes?notes[i][0]:'',source_row:i+1};})
      .filter(function(r){return r.source_row>1&&r.display[ownerColumn]===payload.folio;})};
  }
`;
const previousSource=source.replace(/  function scan\(sheet,width,ownerColumn\)\{[\s\S]*?(?=  const l=scan\(loans,35,3\))/,previousScan);
assert.notEqual(previousSource,source,'fixture contains the previous complete-sheet read for equivalence comparison');
const format=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Hermosillo',year:'numeric',month:'2-digit',day:'2-digit'});
const isoDate=new Date('2026-10-25T07:00:00Z');
const clone=value=>value instanceof Date?new Date(value.getTime()):value;

function fixture(options={}){
  const large=Boolean(options.large),loanCount=large?20001:12,requestCount=large?2801:10;
  const loanPositions=large?[2,3,7,10002,10003,20001]:[2,3,7];
  const requestPositions=large?[2,9,2801]:[2,9];
  const reads=[],state={opens:0,writes:0,reads:0};
  function entry(width,raw={}){
    const values=Array(width).fill('');Object.assign(values,raw);
    return {values,display:values.map(String),note:''};
  }
  const loans=Array.from({length:loanCount},(_,i)=>entry(35,{0:isoDate,1:987654,2:String(900000+i),3:'FOREIGN',9:987654,10:987654,23:'AL CORRIENTE'}));
  const requests=Array.from({length:requestCount},(_,i)=>entry(25,{0:'SR-FOREIGN-'+i,1:'FOREIGN',7:987654,8:987654,24:'Pendiente'}));
  loans[0]=entry(35,{0:'Fecha',1:'Cuotas',2:'ID',3:'Folio',23:'Estatus del prestamo'});
  requests[0]=entry(25,{0:'ID',1:'Número de control',24:'Estado'});
  loanPositions.forEach((row,i)=>{
    loans[row-1]=entry(35,{0:isoDate,1:100+i,2:String(i+1),3:7,6:'Caja de Ahorro',9:500,10:600,14:100,16:6,
      18:new Date('1899-12-31T19:00:00Z'),21:200,22:300,23:'AL CORRIENTE',34:isoDate});
    loans[row-1].display[3]='0007';
  });
  requestPositions.forEach((row,i)=>{
    requests[row-1]=entry(25,{0:i===0?'1':'SR-2026-000002',1:7,4:'Caja de Ahorro',6:6,7:500,8:600,9:isoDate,24:i===0?'Iniciado':'Pendiente'});
    requests[row-1].display[1]='0007';
    requests[row-1].note=i===0?'Staff note\nSUTI_LOAN_TRANSFER_V1:'+JSON.stringify({id:1,identity:'SR-2026-000001',sourceHash:'a'.repeat(64)}):'';
  });
  loans[3].values[3]=7;loans[3].display[3]='7';
  loans[4].values[3]='00070';loans[4].display[3]='00070';
  loans[5].values[3]=' 0007';loans[5].display[3]=' 0007';
  requests[3].note='SUTI_LOAN_TRANSFER_V1:{malformed foreign note';
  const sheets={loans,requests},ownerColumns={loans:4,requests:2};
  const api={sheets,reads,state,loanPositions,requestPositions};
  function sheet(name,id){
    return {getSheetId:()=>options.badSheet===name?0:id,getLastRow:()=>sheets[name].length,
      getRange:(row,col,count,width)=>{
        assert(Number.isInteger(row)&&row>0&&Number.isInteger(col)&&col>0&&count>0&&width>0,'bounded positive range');
        function read(method){
          const event={name,method,row,col,count,width};
          reads.push(event);state.reads++;
          const data=sheets[name].slice(row-1,row-1+count).map(item=>method==='getNotes'
            ?Array.from({length:width},(_,i)=>col+i===1?item.note:'')
            :(method==='getValues'?item.values:item.display).slice(col-1,col-1+width).map(clone));
          options.onRead?.(event,api);
          return data;
        }
        return {getValues:()=>read('getValues'),getDisplayValues:()=>read('getDisplayValues'),getNotes:()=>read('getNotes'),
          setValue(){state.writes++;throw Error('WRITE_FORBIDDEN');},setValues(){state.writes++;throw Error('WRITE_FORBIDDEN');},
          setNote(){state.writes++;throw Error('WRITE_FORBIDDEN');},clear(){state.writes++;throw Error('WRITE_FORBIDDEN');}};
      }};
  }
  const loanSheet=sheet('loans',1245291756),requestSheet=sheet('requests',10616270);
  const book={getSpreadsheetTimeZone:()=> 'America/Hermosillo',getSheetByName:name=>name==='HISTORIAL P V2'?loanSheet:name==='Historial de solicitudes'?requestSheet:null};
  const context={PropertiesService:{getScriptProperties:()=>({getProperty:()=>payload.secret})},
    SpreadsheetApp:{openById:id=>{assert.equal(id,'1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80');state.opens++;return book;}},
    Utilities:{formatDate:value=>format.format(value),DigestAlgorithm:{SHA_256:'SHA_256'},Charset:{UTF_8:'UTF_8'},
      computeDigest:(_,value)=>[...crypto.createHash('sha256').update(value).digest()]},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({text,setMimeType(){return this;}})}};
  vm.createContext(context);vm.runInContext(options.source||source,context);
  return {...api,send:(input=payload)=>JSON.parse(context.doPost({postData:{contents:JSON.stringify(input)}}).text),
    direct:(input=payload)=>JSON.parse(context.readSelfHistory_(input).text),
    metrics(){
      let cells=0,financialCells=0,foreignFinancialCells=0,noteCells=0;
      for(const read of reads){
        cells+=read.count*read.width;
        if(read.method==='getNotes')noteCells+=read.count*read.width;
        if(read.col===ownerColumns[read.name]&&read.width===1)continue;
        for(let row=Math.max(2,read.row);row<read.row+read.count;row++){
          financialCells+=read.width;
          if(sheets[read.name][row-1]?.display[ownerColumns[read.name]-1]!==payload.folio)foreignFinancialCells+=read.width;
        }
      }
      return {calls:reads.length,cells,financialCells,foreignFinancialCells,noteCells,writes:state.writes};
    }};
}

const unauthorized=fixture();
assert.equal(unauthorized.send({...payload,secret:'wrong'}).error,'UNAUTHORIZED');
for(const extra of [{range:'A:AI'},{sheet:'other'},{folio:'0'},{folio:' 0007'},{folio:7},{folio:''},{contract_version:'other'}])
  assert.equal(unauthorized.send({...payload,...extra}).error,'INVALID_REQUEST');
assert.equal(unauthorized.state.opens,0,'invalid requests fail before opening workbook');

const optimized=fixture({large:true}),original=fixture({large:true,source:previousSource});
const actual=optimized.send(),expected=original.send();
assert.equal(actual.ok,true);assert.deepEqual(actual,expected,'same typed contract as previous full-sheet reader');
assert.equal(actual.loans.length,6);assert.equal(actual.requests.length,3);
assert(actual.loans.every(row=>row.owner==='0007'));assert(actual.requests.every(row=>row.owner==='0007'));
assert.deepEqual(actual.loans.map(row=>row.source_row),optimized.loanPositions);
assert.deepEqual(actual.loans[0],{source_row:2,id:'1',owner:'0007',date:'2026-10-25',amount:100,fund:'Caja de Ahorro',
  term:6,principal:500,total:600,scheduled:100,number:1,paid_to_date:200,expected_to_date:300,status:'AL CORRIENTE',authorized:'2026-10-25'});
assert.equal(actual.requests[0].receipt.identity,'SR-2026-000001');
assert.equal(actual.requests[0].receipt.id,1);
const optimizedMetrics=optimized.metrics(),originalMetrics=original.metrics();
assert.equal(optimizedMetrics.foreignFinancialCells,0,'no foreign financial cells or notes read');
assert.equal(optimizedMetrics.noteCells,6,'only three own request notes, read and consistency recheck');
assert(optimizedMetrics.cells<originalMetrics.cells/20,'at least 95% fewer cells read in the sparse 20k-row fixture');
assert.equal(optimizedMetrics.writes,0);assert.equal(originalMetrics.writes,0);

const bare=fixture();
assert.deepEqual(bare.send({...payload,folio:'MISSING'}).loans,[]);
assert.equal(bare.metrics().financialCells,0,'no matches reads only headers and owner columns');
assert.equal(fixture().send({...payload,folio:'7'}).loans.length,1,'formatted and raw numeric Folios are not conflated');
assert.equal(fixture({badSheet:'loans'}).send().error,'LOAN_SOURCE_UNAVAILABLE');
assert.equal(fixture({badSheet:'requests'}).send().error,'LOAN_SOURCE_UNAVAILABLE');

function mutationTest(name,condition,mutate){
  let fired=false;
  const test=fixture({onRead:(event,api)=>{
    if(!fired&&condition(event)){fired=true;mutate(api);}
  }});
  assert.throws(()=>test.direct(),/HISTORY_SOURCE_CHANGED/,name);
  assert(fired,name+' injection executed');assert.equal(test.state.writes,0);
}
const firstOwnLoan=event=>event.name==='loans'&&event.method==='getValues'&&event.row===2;
mutationTest('own amount changed',firstOwnLoan,api=>{api.sheets.loans[1].values[1]=999;});
mutationTest('own displayed status changed',event=>event.name==='loans'&&event.method==='getDisplayValues'&&event.row===2&&event.width===35,
  api=>{api.sheets.loans[1].display[23]='LIQUIDADO';});
mutationTest('own identity changed',firstOwnLoan,api=>{api.sheets.loans[1].display[3]='FOREIGN';});
mutationTest('new own row added without row count change',firstOwnLoan,api=>{api.sheets.loans[7].display[3]='0007';});
mutationTest('rows moved without row count change',firstOwnLoan,api=>{[api.sheets.loans[6],api.sheets.loans[7]]=[api.sheets.loans[7],api.sheets.loans[6]];});
mutationTest('row appended',firstOwnLoan,api=>{api.sheets.loans.push(api.sheets.loans[8]);});
mutationTest('row removed',firstOwnLoan,api=>{api.sheets.loans.pop();});
mutationTest('header changed during observation',firstOwnLoan,api=>{api.sheets.loans[0].display[3]='Other';});
mutationTest('transfer note changed',event=>event.name==='requests'&&event.method==='getNotes',api=>{api.sheets.requests[1].note+='\nEdited';});
mutationTest('new own request appears',event=>event.name==='requests'&&event.method==='getValues',api=>{api.sheets.requests[5].display[1]='0007';});

let foreignChanged=false;
const foreign=fixture({onRead:(event,api)=>{if(!foreignChanged&&firstOwnLoan(event)){foreignChanged=true;api.sheets.loans[8].values[1]=34567;}}});
// Mutation of a different account's financial data must not force a cross-user read.
assert.equal(foreign.send().ok,true);assert(foreignChanged);assert.equal(foreign.metrics().foreignFinancialCells,0);
const malformed=fixture();malformed.sheets.requests[1].note='SUTI_LOAN_TRANSFER_V1:{bad';
assert.throws(()=>malformed.direct(),/HISTORY_TRANSFER_IDENTITY_INVALID/);
const duplicate=fixture();duplicate.sheets.requests[1].note+='\n'+duplicate.sheets.requests[1].note.split('\n')[1];
assert.throws(()=>duplicate.direct(),/HISTORY_TRANSFER_IDENTITY_INVALID/);
const header=fixture();header.sheets.loans[0].display[0]='Wrong';
assert.equal(header.send().error,'LOAN_SOURCE_UNAVAILABLE');

const inverse=source.replace(/\r/g,'').replace(/\/\/ Focal self-history read\.[\s\S]*?(?=function doPost\(event\))/,'')
  .replace("    if(payload.action==='read_self_history')return readSelfHistory_(payload);\n",'')
  .replace("    if(payload.action==='read_history_snapshot')return readHistorySnapshot_(payload);\n",'');
assert.equal(crypto.createHash('sha256').update(inverse).digest('hex'),'1ccfa39e6c43546692528aa87c98cdb5fa93f323f26900585c1355da5cd6d0f0',
  'all preexisting receiver writers and other read contracts stay byte-identical');
console.log(JSON.stringify({status:'PASS',fixtureRows:{loans:20001,requests:2801},original:originalMetrics,optimized:optimizedMetrics,
  checks:['unchanged typed contract','exact formatted owner','own contiguous ranges','no foreign financial reads or notes',
    'own data/display/notes/header/selection consistency','insert/remove/move/new-own-row detection','strict secret and fixed sheets',
    'unchanged writer code','zero Sheet writes']},null,2));
