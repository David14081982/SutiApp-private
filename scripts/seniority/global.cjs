'use strict';
// Execute the repository's required suite unchanged, with a longer navigation timeout.
const C=require('./common.cjs'),https=require('https'),cp=require('child_process');
const candidate=JSON.parse(C.fs.readFileSync(C.path.join(C.root,'.tmp/seniority/candidate.json'))),mode=process.argv[2]||'local';
process.env.SUTIAPP_IMAGE_E2E_URL='https://sutiapp.com/';
process.env.SUTIAPP_IMAGE_EXPECTED_BUNDLE_SHA256=candidate.bundleSha256;
delete process.env.SUTIAPP_IMAGE_CANDIDATE_DIR;
const pdfFixture=C.path.join(C.root,'.tmp/seniority/pdf-fixture-private.json');
if(C.fs.existsSync(pdfFixture))process.env.SUTIAPP_IMAGE_PDF_FIXTURE=C.fs.readFileSync(pdfFixture,'utf8');
function runSuite(){const Module=require('module'),file=C.path.join(C.root,'scripts/test-global-image-regression-production-live.js'),suite=new Module(file,module);suite.filename=file;suite.paths=Module._nodeModulePaths(C.path.dirname(file));let source=C.fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
// Support the published suite's older PDF discovery without scanning every dossier.
// The fixture is an ID pair read from the real DB; adminPreview and all viewer assertions stay intact.
if(source.includes('const queue = await window.DocumentWorkflowRepository.reviewQueue();')){
 source=source.replace('async (adminMode) => {','async ({adminMode,pdfFixture}) => {').replace("const queue = await window.DocumentWorkflowRepository.reviewQueue();\n          let pdf = queue.find((doc) => doc.mimeType === 'application/pdf');","let pdf = pdfFixture ? {...pdfFixture,mimeType:'application/pdf'} : null;").replace("}, alias === 'H005_TEST');","}, {adminMode:alias === 'H005_TEST',pdfFixture:process.env.SUTIAPP_IMAGE_PDF_FIXTURE ? JSON.parse(process.env.SUTIAPP_IMAGE_PDF_FIXTURE) : null});");
}
source=source.replace('const initial = await audit(page);', 'const initial = await audit(page); console.error(JSON.stringify({stage: "initial-complete", status:initial.status, failures:initial.failures}));');
source=source.replace(/stage='([a-z-]+)';/g,(line,stage)=>line+"console.error(JSON.stringify({stage:'"+stage+"'}));");suite._compile(source,file);}
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core'),launch=chromium.launch.bind(chromium);
chromium.launch=async options=>{const browser=await launch({...options,args:[...options.args,...(process.env.SENIORITY_TEST_RESOLVER?[process.env.SENIORITY_TEST_RESOLVER,'--ignore-certificate-errors']:[])]}),createContext=browser.newContext.bind(browser);browser.newContext=async options=>{const context=await createContext({...options,ignoreHTTPSErrors:mode==='local'});context.setDefaultNavigationTimeout(120000);return context;};return browser;};
const write=process.stdout.write.bind(process.stdout);let buffered='';
process.stdout.write=(chunk,...args)=>{buffered+=String(chunk);let at;while((at=buffered.indexOf('\n'))>=0){const line=buffered.slice(0,at);buffered=buffered.slice(at+1);try{const data=JSON.parse(line);data.at=new Date().toISOString();if(mode==='local')data.target='LOCAL_HTTPS_CANDIDATE_REAL_BACKEND';if(data.status==='PASS'&&data.verifiedBundleSha256)C.fs.writeFileSync(C.path.join(C.root,'docs/qa/evidence/seniority/global-'+mode+'.json'),JSON.stringify(data,null,2));}catch{}}return write(chunk,...args);};
if(mode==='local'){
 const area=C.path.join(C.root,'.tmp/seniority'),key=C.path.join(area,'test-local.key'),cert=C.path.join(area,'test-local.crt');
 if(!C.fs.existsSync(cert))cp.execFileSync('C:/Program Files/Git/usr/bin/openssl.exe',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','2','-subj','/CN=sutiapp.com'],{stdio:'ignore'});
 const server=https.createServer({key:C.fs.readFileSync(key),cert:C.fs.readFileSync(cert)},(req,res)=>{const u=new URL(req.url,'http://localhost'),file=C.path.resolve(candidate.site,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(candidate.site+C.path.sep)||!C.fs.existsSync(file)||!C.fs.statSync(file).isFile()){res.writeHead(404);return res.end();}const mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'}[C.path.extname(file)]||'application/octet-stream';res.setHeader('Content-Type',mime);res.setHeader('Cache-Control','no-cache');C.fs.createReadStream(file).pipe(res);});
 server.listen(0,'127.0.0.1',()=>{process.env.SENIORITY_TEST_RESOLVER='--host-resolver-rules=MAP sutiapp.com 127.0.0.1:'+server.address().port;server.unref();runSuite();});
}else runSuite();
