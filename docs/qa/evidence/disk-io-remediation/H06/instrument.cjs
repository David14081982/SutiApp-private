'use strict';
// Test-only observer. Does not intercept, replace or retry any response.
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const launch=chromium.launch.bind(chromium);
chromium.launch=async options=>{
 const browser=await launch(options),newContext=browser.newContext.bind(browser);
 browser.newContext=async options=>{
  const context=await newContext(options);
  context.on('page',page=>page.on('response',async response=>{
   if(response.status()<400)return;
   const url=new URL(response.url());let code='UNKNOWN';
   try{const value=await response.json(),raw=String(value.code||value.error||'');if(/^[A-Z0-9_]{1,64}$/.test(raw))code=raw;}catch(_){}
   console.error(JSON.stringify({http:response.status(),endpoint:url.pathname.startsWith('/rest/v1/')?url.pathname:url.pathname.split('/').slice(0,4).join('/'),code}));
  }));
  return context;
 };
 return browser;
};
