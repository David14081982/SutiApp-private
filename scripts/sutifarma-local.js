'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),cp=require('child_process');const root=path.resolve(__dirname,'..'),site=path.join(root,'.tmp/sutifarma/site');
if(process.argv.includes('--build')){
 const env={...process.env};for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
 env.SUTIAPP_SUPABASE_URL=env.SUPABASE_URL;env.SUTIAPP_SUPABASE_PUBLISHABLE_KEY=env.SUPABASE_PUBLISHABLE_KEY;
 cp.execFileSync(process.execPath,['scripts/build-pages-site.js','.tmp/sutifarma/site'],{cwd:root,env,stdio:'inherit'});
}else{
 const mime={'.js':'application/javascript','.mjs':'application/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.webp':'image/webp','.webmanifest':'application/manifest+json'};
 const port=process.argv.includes('--global')?8080:8769;
 http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(site,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(site+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});}).listen(port,()=>console.log('Suti Farma local build: http://localhost:'+port));
}
