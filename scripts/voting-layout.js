'use strict';
// Reuse only the isolated browser setup. Recheck the final CSS correction, not the green interaction suite.
const fs=require('fs'),path=require('path'),Module=require('module');
const file=path.join(__dirname,'test-voting-browser.js'),source=fs.readFileSync(file,'utf8');
const setup=source.slice(0,source.indexOf(" await page.locator('.head').click();assert"));
const tail=`
 await page.locator('.head').click();
 for(const size of ['normal','large','largest']){
  await page.locator('[data-voting-home]').evaluate((e,s)=>e.dataset.textSize=s,size);
  assert.equal(await page.locator('.body').evaluate(e=>getComputedStyle(e).paddingLeft),'18px');
  assert(await page.locator('.opts').first().evaluate(e=>e.scrollWidth<=e.clientWidth),'options overflow '+size);
  assert.equal(await page.locator('.opt.abs span').first().evaluate(e=>getComputedStyle(e).whiteSpace),'nowrap');
  await page.locator('[data-voting-home]').screenshot({path:path.join(out,'layout-'+size+'.png')});
 }
 const result={status:'PASS',checks:['original_inner_padding','three_text_sizes','unbroken_option_labels','no_option_overflow']};
 fs.writeFileSync(path.join(out,'layout.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e.message);process.exitCode=1;});`;
const run=new Module(file,module);run.filename=file;run.paths=module.paths;run._compile(setup+tail,file);
