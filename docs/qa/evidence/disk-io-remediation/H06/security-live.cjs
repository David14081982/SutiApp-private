'use strict';
const fs=require('fs'),assert=require('assert').strict,a=require('./audit.cjs'),{configuration}=require('../H04/matrix.cjs');
(async()=>{
 const setup=fs.readFileSync(a.dir+'/../H04/matrix-setup.sql','utf8'),rows=[];
 for(const mode of ['owner','other','principal','anon','assets_admin','documents_admin','program_admin','unauthorized_admin','impersonation','impersonation_expired','impersonation_revoked','impersonation_wrong_session']){
  const sql="begin;set local statement_timeout='45s';set local lock_timeout='2s';"+setup+configuration(mode)+`set local role ${mode==='anon'?'anon':'authenticated'};select pg_temp.h04_evaluate() result;rollback;`;
  const result=(await a.raw(sql))[0].result,expected=JSON.parse(fs.readFileSync(a.dir+'/../H04/matrix-live-'+mode+'.json')).before;
  assert.deepEqual(result,expected,'H06 authorization '+mode);rows.push({mode,status:'PASS',result,persistentFixtureRows:0});console.log(mode+': PASS');
 }
 a.save('security-live',{at:new Date().toISOString(),status:'PASS',rows,ddlApplied:0,productionDataMutations:0});
})().catch(e=>{console.error(e.message);process.exitCode=1;});
