'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const sandbox={window:{},Intl,Date};vm.runInNewContext(fs.readFileSync('app/history-loans-repository.js','utf8'),sandbox);
const summarize=entries=>JSON.parse(JSON.stringify(sandbox.window.LoanHistory.debtSummary({server_now:'2026-11-25T19:00:00Z',entries})));
const loan=(id,total,schedule,extra={})=>({kind:'loan',id,key:'loan:'+id,fund:'Mismo programa',total,term:6,schedule,...extra});
const row=(source_row,date,amount)=>({source_row,date,amount});
test('each C contributes once; same program distinct loans; requests excluded; next date only',()=>{
 const d=summarize([loan('001',12000,[row(2,'2026-11-15',7000),row(3,'2026-11-30',1000),row(4,'2026-12-15',4000)]),
  loan('002',6000,[row(5,'2026-11-15',1500),row(6,'2026-12-15',4500)]),
  loan('003',4000,[row(7,'2026-11-15',4000)]),{kind:'request',total:999999}]);
 assert.equal(d.total,950000);assert.deepEqual(d.loans.map(l=>l.id),['001','002']);assert.deepEqual(d.next,{date:'2026-11-30',amount:100000});
 assert.equal(d.loans[0].remaining,2);assert.equal(d.loans[0].quota,null);
});
test('partial arrears survive expired calendar; count is not invented',()=>{
 const d=summarize([loan('1',6000,[row(2,'2026-10-15',1000),row(3,'2026-10-30',250),row(4,'2026-11-15',0)])]);
 assert.equal(d.total,475000);assert.equal(d.next,null);assert.equal(d.loans[0].remaining,null);
});
test('early payment caps future collection and cannot offset another loan',()=>{
 const d=summarize([loan('1',6000,[row(2,'2026-11-15',5500),row(3,'2026-11-30',1000),row(4,'2026-12-15',1000)]),
  loan('2',1000,[row(5,'2026-11-15',1500)])]);
 assert.equal(d.total,50000);assert.equal(d.next.amount,50000);assert.equal(d.loans[0].remaining,1);assert.equal(d.loans.length,1);
});
test('partial receipts same date count in balance, future discounts aggregate',()=>{
 const d=summarize([loan('1',1000,[row(2,'2026-11-15',100),row(3,'2026-11-15',150),row(4,'2026-11-30',250),row(5,'2026-11-30',500)])]);
 assert.equal(d.total,75000);assert.equal(d.next.amount,75000);assert.equal(d.loans[0].remaining,1);
});
test('missing amount/total/date does not become zero or a partial complete total',()=>{
 for(const bad of [loan('2',null,[row(5,'2026-11-15',200)]),loan('2',1000,[row(5,'2026-11-15',null)]),loan('2',1000,[row(5,'2026-02-30',200)]),loan('2',1000,[],{preparing:true,key:'request:2'})]){
  const d=summarize([loan('1',1000,[row(2,'2026-11-15',100)]),bad]);assert.equal(d.status,'review');assert.equal(d.total,null);assert.equal(d.next,null);
 }
});
test('duplicate IDs and duplicate source rows are rejected, leading zero IDs distinct',()=>{
 const a=loan('001',1000,[row(2,'2026-11-15',100)]);
 assert.equal(summarize([a,a]).status,'review');assert.equal(summarize([a,loan('1',1000,a.schedule)]).total,null);
 assert.equal(summarize([a,loan('1',1000,[row(3,'2026-11-15',100)])]).total,180000);
});
test('Hermosillo cutoff, cents and combined next discount',()=>{
 const entries=[loan('1',1,[row(2,'2026-11-24',.1),row(3,'2026-11-25',.2)]),loan('2',1,[row(4,'2026-11-25',.3)])];
 const d=JSON.parse(JSON.stringify(sandbox.window.LoanHistory.debtSummary({server_now:'2026-11-25T06:59:59Z',entries})));
 assert.equal(d.asOf,'2026-11-24');assert.equal(d.total,190);assert.equal(d.next.amount,50);
 assert.equal(summarize(entries).total,140);
});
test('empty and fully settled history have real zero',()=>{
 assert.equal(summarize([]).total,0);assert.deepEqual(summarize([loan('1',500,[row(2,'2026-11-15',500)])]).loans,[]);
});
test('partial and advance receipts match independently verified PV2 cases',()=>{
 const dates=['2026-10-15','2026-10-30','2026-11-15','2026-11-30','2026-12-15','2026-12-30'];
 // Expected residuals independently checked against the existing PV2 allocation
 // engine in the original workspace; no dependency on unpublished legacy tools.
 for(const [receipts,expected] of [[[1000,1000,1000],300000],[[0,250,1000],475000],[[2500,1000,1000],150000],[[6000,0,0],0]]){
  const rows=dates.map((date,i)=>row(i+2,date,i<3?receipts[i]:1000));
  assert.equal(summarize([loan('1',6000,rows)]).total,expected);
 }
});
test('actual backend projection groups repeated K by C and denies foreign Folio',async()=>{
 const {projectHistory}=await import('../supabase/functions/loan-history/history.mjs');
 const context={folio:'0007',requests:[]},source={folio:'0007',requests:[],loans:[
  {id:'001',owner:'0007',source_row:2,date:'2026-11-15',amount:1000,total:6000,fund:'Fondo',term:6,status:'AL CORRIENTE'},
  {id:'001',owner:'0007',source_row:3,date:'2026-11-30',amount:1000,total:6000,fund:'Fondo',term:6,status:'AL CORRIENTE'}]};
 const projected=projectHistory(source,context,'2026-11-25T19:00:00Z');assert.equal(projected.entries.length,1);assert.equal(summarize(projected.entries).total,500000);
 source.loans[1].total=7000;assert.equal(summarize(projectHistory(source,context,'2026-11-25T19:00:00Z').entries).total,null);
 source.loans[1].owner='7';assert.throws(()=>projectHistory(source,context,'2026-11-25T19:00:00Z'),/IDENTITY_MISMATCH/);
});

test('literal sub-cent receipts aggregate before currency display',()=>{
 const d=summarize([loan('1',1,[row(2,'2026-11-15',.105),row(3,'2026-11-20',.205),row(4,'2026-11-30',.69)])]);
 assert.equal(d.total,69);assert.equal(d.loans[0].remaining,1);assert.equal(d.next.amount,69);
 assert.equal(summarize([loan('1',.3,[row(2,'2026-11-15',.1),row(3,'2026-11-20',.2)])]).total,0);
});
