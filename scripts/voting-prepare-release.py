import pathlib,shutil,re,json,hashlib,subprocess
root=pathlib.Path(__file__).resolve().parent.parent
release=root/'tmp/voting-release'
new=['app/voting-design.js','app/voting-repository.js','app/screens-voting.jsx','supabase/migrations/20260915000200_voting.sql','supabase/recovery/20260915000200_voting.sql','scripts/voting-discovery.js','scripts/voting-backend.js','scripts/test-voting.sql','scripts/test-voting-browser.js','scripts/voting-prepare-design.py','scripts/voting-prepare-release.py','docs/audits/H-SUTIAPP-VOTACIONES-PRODUCTION-001.md']
for name in new:
 dst=release/name;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/name,dst)
def patch(name,pairs):
 s=subprocess.check_output(['git','show','origin/main:'+name],cwd=root).decode('utf-8')
 for before,after in pairs:
  assert s.count(before)==1,(name,before[:80],s.count(before))
  s=s.replace(before,after)
 (release/name).write_text(s,encoding='utf-8')
patch('app/screens-home-r2.jsx',[("ecosistema: () => React.createElement(Ecosistema, { app }),","ecosistema: () => React.createElement(React.Fragment, null, React.createElement(window.VotingHome, { app }), React.createElement(Ecosistema, { app })),")])
local=(root/'app/screens-admin.jsx').read_text(encoding='utf-8')
pairs=[]
for marker in ['  const MODULES = [','  const MODULE_PERMISSION = Object.freeze({']:
 start=local.index(marker)+len(marker)
 added=local[start:local.index('\n',local.index('\n',start)+1)] if 'PERMISSION' in marker else local[start:local.index('\n',local.index('\n',local.index('\n',start)+1)+1)]
 pairs.append((marker,marker+added))
base=subprocess.check_output(['git','show','origin/main:app/screens-admin.jsx'],cwd=root).decode('utf-8')
for marker in ['  const SECTION_MODULE =','    { id:\'content\', label:\'Contenido\'']:
 old=next(s for s in base.splitlines() if s.startswith(marker));fresh=next(s for s in local.splitlines() if s.startswith(marker));pairs.append((old,fresh))
pairs.append(("    if (view === 'administrators') body", "    if (view === 'votaciones' || view === 'votaciones_nominal') body = React.createElement(window.VotingAdmin, { app, onBack: () => openView('menu') });\n    else if (view === 'administrators') body"))
patch('app/screens-admin.jsx',pairs)
patch('scripts/build-bundle.js',[("const files = [","const files = [\n  'voting-design.js', 'voting-repository.js', 'screens-voting.jsx',")])
patch('SutiApp.html',[(re.search(r'app/bundle\.js\?v=[^"\s]+',subprocess.check_output(['git','show','origin/main:SutiApp.html'],cwd=root).decode('utf-8'))[0],'app/bundle.js?v=voting-20260915-001')])
print(json.dumps({'status':'PREPARED','root':str(release),'files':len(new)+4}))
