"""Build the one-screen correction over the verified release, preserving all other chunks."""
from pathlib import Path
import subprocess,json,re,hashlib,shutil,sys

workspace=Path(__file__).resolve().parents[1]
release=Path(sys.argv[1]).resolve()
base='e3259b1'
def git(file):
    return subprocess.check_output(['git','show',base+':'+file],cwd=release).decode('utf8').replace('\r\n','\n')
source=(workspace/'app/screens-admin-access.jsx').read_text(encoding='utf8')
compiler="const fs=require('fs'),vm=require('vm');const c={};vm.createContext(c);vm.runInContext(fs.readFileSync('C:/tmp/babel-standalone-7.29.0.min.js','utf8'),c);process.stdout.write(c.Babel.transform(fs.readFileSync(0,'utf8'),{presets:['react'],filename:'screens-admin-access.jsx'}).code);"
code=subprocess.check_output(['node','-e',compiler],input=source.encode('utf8')).decode('utf8')
bundle=git('app/bundle.js')
pattern=r'/\* @@file ([^\n]+) \*/\n([\s\S]*?)(?=/\* @@file |$)'
chunks=list(re.finditer(pattern,bundle));assert len(chunks)==122
target=next(m for m in chunks if m[1]=='screens-admin-access.jsx')
replacement='/* @@file screens-admin-access.jsx */\n(function(){\n'+code+'\n})();\n'
updated=bundle[:target.start()]+replacement+bundle[target.end():]
after={m[1]:m[0] for m in re.finditer(pattern,updated)}
for m in chunks:
    if m[1]!='screens-admin-access.jsx':assert after[m[1]]==m[0]
subprocess.run(['node','-e',"new(require('vm').Script)(require('fs').readFileSync(0,'utf8'))"],input=updated.encode('utf8'),check=True)
(release/'app/screens-admin-access.jsx').write_text(source,encoding='utf8',newline='\n')
(release/'app/bundle.js').write_text(updated,encoding='utf8',newline='\n')
html=git('SutiApp.html').replace('bundle.js?v=257','bundle.js?v=258').replace('sw.js?v=201','sw.js?v=202')
sw=git('sw.js').replace("sutiapp-v201","sutiapp-v202").replace('bundle.js?v=257','bundle.js?v=258')
(release/'SutiApp.html').write_text(html,encoding='utf8',newline='\n')
(release/'sw.js').write_text(sw,encoding='utf8',newline='\n')
out=release/'docs/qa/evidence/admin-screen-permissions-20260914';out.mkdir(parents=True,exist_ok=True)
result={'status':'PASS','base':base,'changedChunks':['screens-admin-access.jsx'],'preservedChunks':121,'totalChunks':122,'bundleVersion':258,'serviceWorkerVersion':202,'sha256':hashlib.sha256(updated.encode('utf8')).hexdigest(),'backendChanged':False,'sharedRoutingChanged':False,'swLogicChanged':False}
(out/'build.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
for relative in ['docs/audits/H-ADMIN-SCREEN-PERMISSIONS-002.md','scripts/prepare-admin-screen-permissions-fix.py','scripts/test-admin-screen-permissions-browser.js']:
    shutil.copyfile(workspace/relative,release/relative)
print(json.dumps(result))
