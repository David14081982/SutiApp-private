'use strict';
// Test-only bridge: new editorial READ RPCs only. Existing backend/assets untouched.
const {createDb}=require('./admin-permission-test-db');
module.exports=async browser=>{
 const {db,scalar,auth,read}=await createDb();await db.exec(read('supabase/migrations/20260924000300_app_editorial_panels.sql'));
 const original=browser.newContext.bind(browser);let queue=Promise.resolve();const calls=[];
 browser.newContext=async(...args)=>{
  const context=await original(...args);
  await context.route('**/rest/v1/rpc/*',async route=>{
   const name=new URL(route.request().url()).pathname.split('/').pop();
   if(!/editorial/.test(name))return route.continue();
   const headers={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type,x-client-info','access-control-allow-methods':'POST,OPTIONS'};
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
   if(!['get_app_editorial','list_app_editorial_screens'].includes(name))throw Error('EDITORIAL_TEST_WRITE_FORBIDDEN');
   const p=route.request().postDataJSON()||{};
   if(p.p_admin)throw Error('EDITORIAL_TEST_ADMIN_READ_UNEXPECTED');
   const task=queue.then(async()=>{await auth(null,'anon');return name==='get_app_editorial'?scalar('select get_app_editorial($1,false) value',[p.p_screen]):scalar('select list_app_editorial_screens() value');});queue=task.catch(()=>{});
   const data=await task;calls.push({name,screen:p.p_screen||null});await route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify(data)});
  });return context;
 };
 return {calls,close:()=>db.close()};
};
