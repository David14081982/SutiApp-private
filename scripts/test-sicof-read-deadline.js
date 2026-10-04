'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../app/sicof-admin.jsx'),'utf8');
 const code=source.slice(source.indexOf('  function readWithDeadline('),source.indexOf('  const TABS'));
 const read=vm.runInNewContext('('+code.trim()+')',{Promise,setTimeout,clearTimeout,Error});
 assert.equal(await read(Promise.resolve(7),50),7);
 await assert.rejects(()=>read(Promise.reject(Error('TEST_NETWORK')),50),/TEST_NETWORK/);
 let complete,late=false;const pending=new Promise(resolve=>{complete=resolve;});
 await assert.rejects(()=>read(pending,5).then(()=>{late=true;}),/SICOF_READ_TIMEOUT/);
 complete(9);await new Promise(resolve=>setTimeout(resolve,10));assert.equal(late,false,'late result cannot re-enter timed out UI chain');
 assert(source.includes('forceSource ? 75000 : 25000'));
 console.log(JSON.stringify({status:'PASS',checks:['success','network failure','hung read deadline','late response ignored','cached/manual time budgets'],networkRequests:0}));
})().catch(error=>{console.error(error);process.exitCode=1;});
