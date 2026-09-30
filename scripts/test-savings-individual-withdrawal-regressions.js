'use strict';
// Run the existing Savings assertions with isolated fixtures for newly introduced dependencies.
const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),mode=process.argv[2];
const file=path.join(__dirname,mode==='runtime'?'test-savings-runtime-browser.js':'test-savings-reference-panel-browser.js');
let source=fs.readFileSync(file,'utf8');
if(mode==='runtime'){
 const needle="window.calls=[];";assert(source.includes(needle));source=source.replace(needle,"window.GeneratedDocuments=()=>null;"+needle);
 process.env.SAVINGS_RUNTIME_QA_OUTPUT=path.join(root,'.tmp/savings-individual-withdrawal/runtime-regression');
}else if(mode==='panel'){
 const needle="'app/savings-runtime-admin.jsx','app/savings-panel-admin.jsx'";assert(source.includes(needle));source=source.replace(needle,"'app/savings-runtime-admin.jsx','app/savings-individual-withdrawal.jsx','app/savings-panel-admin.jsx'");
 const fixture='let sequence=0;';assert(source.includes(fixture));source=source.replace(fixture,"window.SavingsIndividualWithdrawalRepository={get:async folio=>({folio,ready:true,enabled:false,can_configure:false,can_create:false})};window.GeneratedDocuments=()=>null;"+fixture);
 process.env.SAVINGS_PANEL_QA_OUTPUT=path.join(root,'.tmp/savings-individual-withdrawal/panel-regression');
}else throw Error('Use runtime or panel');
const test=new Module(file,module);test.filename=file;test.paths=module.paths;test._compile(source,file);
