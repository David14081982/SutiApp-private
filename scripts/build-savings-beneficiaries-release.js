const fs=require('fs'),path=require('path'),cp=require('child_process'),vm=require('vm');
const root=path.resolve(__dirname,'..');
// Rebuild every module from current sources. Preserve established raw-JS formatting
// for these two JSX-named sources; neither needs a JSX transform.
const babel=process.argv[2]||process.env.SUTIAPP_BABEL_PATH;
if(!babel)throw Error('Pass the Babel Standalone path used for the canonical build');
cp.execFileSync(process.execPath,[path.join(root,'scripts/build-bundle.js'),babel],{cwd:root,stdio:'inherit'});
const file=path.join(root,'app/bundle.js');let bundle=fs.readFileSync(file,'utf8');
for(const name of ['screens-admin-fincat.jsx','screens-admin-program-products.jsx']){
 const source=fs.readFileSync(path.join(root,'app',name),'utf8').replace(/\r\n/g,'\n').trimEnd();new vm.Script(source);
 const marker='/* @@file '+name+' */\n',start=bundle.indexOf(marker),end=bundle.indexOf('/* @@file ',start+marker.length);
 if(start<0||end<0)throw Error('Missing canonical module '+name);
 bundle=bundle.slice(0,start)+marker+'(function(){\n'+source+'\n})();\n'+bundle.slice(end);
}
new vm.Script(bundle);fs.writeFileSync(file,bundle);
console.log('Full source rebuild complete; canonical raw-JS formatting preserved.');
