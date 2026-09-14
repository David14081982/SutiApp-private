"""Transplant only the reviewed module-access delta onto a clean published checkout."""
from pathlib import Path
import subprocess, difflib, json, shutil

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'tmp/admin-user-modules-release'
FILES=['admin-repository.js','admin-cutover-repository.js','admin-cutover-store.jsx','screens-admin-access.jsx','section-responsibility.jsx','program-request-repository.js','screens-admin.jsx','app.jsx']

def replace_once(source,old,new):
    assert source.count(old)==1,old[:100]
    return source.replace(old,new,1)

for name in FILES:
    file='app/'+name
    before=subprocess.check_output(['git','show','origin/main:'+file],cwd=ROOT).decode('utf8').replace('\r\n','\n')
    candidate=(ROOT/file).read_text(encoding='utf8')
    if name=='app.jsx':
        result=before
        for needle in ['const [tab, setTabState]','const commitTab =','navRef.current =']:
            old=next(l for l in before.splitlines() if needle in l)
            new=next(l for l in candidate.splitlines() if needle in l)
            result=replace_once(result,old,new)
        old='      const onPop = () => {'
        result=replace_once(result,old,'      const onPop = (event) => {')
        guard=next(line for line in candidate.splitlines() if 'event.state&&event.state.sut' in line)
        anchor='        const { stack, tab, popupItems, defaultTab } = navRef.current;'
        result=replace_once(result,anchor,anchor+'\n'+guard)
    elif name=='program-request-repository.js':
        result=before
        helpers='\n'.join(l for l in candidate.splitlines() if 'const moduleScoped=' in l or 'async function moduleGeneralRows' in l)
        anchor="  const db=()=>window.SutiSupabase.getClient();"
        result=replace_once(result,anchor,anchor+'\n'+helpers)
        for function in ['listGeneralQueue','listMobile']:
            anchor='  async function '+function+'(){'
            result=replace_once(result,anchor,anchor+'\n    if(moduleScoped())return Object.freeze((await moduleGeneralRows()).map(project));')
        old=next(l for l in before.splitlines() if 'const base=await db().from' in l)
        new=next(l for l in candidate.splitlines() if 'const base=moduleScoped()' in l)
        result=replace_once(result,old,new)
        result=replace_once(result,'    if(base.error)throw base.error;','    if(base.error)throw base.error;\n    if(!base.data)throw new Error(\'REQUEST_NOT_FOUND_OR_FORBIDDEN\');')
    else:
        a,b=before.splitlines(keepends=True),candidate.splitlines(keepends=True)
        result_lines=a[:]
        for tag,i,j,k,l in reversed(difflib.SequenceMatcher(None,a,b,autojunk=False).get_opcodes()):
            if tag=='equal':continue
            text=''.join(a[i:j]+b[k:l])
            if name=='screens-admin.jsx' and ("id:'finance'" in text or "id:'savings'" in text):continue
            if name=='admin-cutover-repository.js' and ('listWorkflows:' in text or 'listTracking:' in text):continue
            result_lines[i:j]=b[k:l]
        result=''.join(result_lines)
    (DEST/file).write_text(result,encoding='utf8')

for file in ['SutiApp.html','sw.js']:
    p=DEST/file;s=p.read_text(encoding='utf8').replace('bundle.js?v=256','bundle.js?v=257').replace('sw.js?v=200','sw.js?v=201').replace('sutiapp-v200','sutiapp-v201');p.write_text(s,encoding='utf8')
for folder,pattern in [('scripts','*admin-user-modules*'),('supabase/migrations','20260914000200*'),('supabase/recovery','20260914000200*')]:
    for source in (ROOT/folder).glob(pattern):
        target=DEST/folder/source.name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
shutil.copytree(ROOT/'docs/qa/evidence/admin-user-modules-20260914',DEST/'docs/qa/evidence/admin-user-modules-20260914',dirs_exist_ok=True)
shutil.copyfile(ROOT/'docs/audits/H-ADMIN-USER-MODULES-001.md',DEST/'docs/audits/H-ADMIN-USER-MODULES-001.md')
for file in ['SOURCE_OF_TRUTH.md','SECURITY_RULES.md','DECISIONS.md','AGENT_CHANGELOG.md']:
    source=(ROOT/'docs'/file).read_text(encoding='utf8');marker=next(line for line in source.splitlines() if line.startswith('## ') and 'H-ADMIN-USER-MODULES-001' in line)
    addition=source[source.index(marker):];target=DEST/'docs'/file
    original=subprocess.check_output(['git','show','origin/main:docs/'+file],cwd=ROOT).decode('utf8')
    target.write_text(original+'\n\n'+addition,encoding='utf8')
print(json.dumps({'status':'PASS','sources':FILES,'base':subprocess.check_output(['git','rev-parse','origin/main'],cwd=ROOT,text=True).strip(),'unrelatedSourceChangesExcluded':True}))
