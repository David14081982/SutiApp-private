'use strict';
const fs=require('fs'),path=require('path'),http=require('http');
http.createServer((req,res)=>{
 const root=fs.readFileSync('C:/tmp/sutiapp-h06-current-site.txt','utf8').trim();
 const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
 if(!file.startsWith(path.resolve(root)+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
 const types={'.html':'text/html','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.webmanifest':'application/manifest+json'};
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
}).listen(8080,'127.0.0.1',()=>console.log('H06 allowlisted build: localhost:8080'));
