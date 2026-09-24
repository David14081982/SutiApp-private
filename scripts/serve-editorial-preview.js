'use strict';
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),site=JSON.parse(fs.readFileSync(path.join(root,'tmp/editorial-preview-latest.json'),'utf8')).site;
const port=Number(process.env.SUTIAPP_PREVIEW_PORT||4173);
if(!path.resolve(site).startsWith(path.join(root,'tmp')+path.sep))throw Error('PREVIEW_PATH_OUTSIDE_WORKSPACE');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.webp':'image/webp'};
http.createServer((req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
  const url=new URL(req.url,'http://127.0.0.1:4173'),relative=decodeURIComponent(url.pathname).replace(/^\/+/,''),file=path.resolve(site,relative||'index.html');
  if(!file.startsWith(site+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
  if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);
 }catch(_){res.writeHead(400);res.end();}
}).listen(port,'127.0.0.1',()=>console.log('EDITORIAL_PREVIEW http://127.0.0.1:'+port+'/'));
