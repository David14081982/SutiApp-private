'use strict';
// Mandatory global image test. Read-only production backend; no financial fixtures.
const fs=require('fs'),path=require('path'),http=require('http'),{spawn,execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/program-product-financing-20260922');
const values={};for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const at=line.indexOf('=');if(at>0&&!line.startsWith('#'))values[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}
async function main(){
 let server;const pages=process.argv.includes('--pages');fs.mkdirSync(out,{recursive:true});
 const site=path.join(root,'.tmp/program-product-financing/site-'+Date.now());
 const env={...process.env,SUTIAPP_SUPABASE_URL:values.SUPABASE_URL,SUTIAPP_SUPABASE_PUBLISHABLE_KEY:values.SUPABASE_PUBLISHABLE_KEY};
 if(!pages){
  execFileSync(process.execPath,[path.join(root,'scripts/build-pages-site.js'),site],{cwd:root,env,stdio:'pipe'});
  server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(site,'.'+(pathname==='/'?'/index.html':pathname));
   if(!file.startsWith(site+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
   const ext=path.extname(file);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.webp':'image/webp'})[ext]||'application/octet-stream');
   if(['.html','.js','.css'].includes(ext))res.end(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'));else fs.createReadStream(file).pipe(res);
  });await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(8080,'127.0.0.1',resolve);});env.SUTIAPP_IMAGE_E2E_URL='http://localhost:8080/';
 }
 try{
  const child=spawn(process.execPath,[path.join(root,'scripts/test-global-image-regression-production-live.js')],{cwd:root,env,windowsHide:true});let stdout='',stderr='';child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);
  const code=await new Promise(resolve=>child.on('close',resolve));const name=pages?'global-pages':'global-local';
  fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify({exitCode:code,stdout,stderr},null,2));console.log(stdout.trim()||stderr.trim());if(code)process.exitCode=code;
 }finally{if(server)await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
