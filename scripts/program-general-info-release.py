"""Prepare a reviewable delta on the published tree, excluding unrelated workspace changes."""
import hashlib,json,pathlib,re,shutil,subprocess,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
PRIVATE=pathlib.Path('C:/tmp/sutiapp-program-general-info-20260910')
TREE=PRIVATE/'release'
OUT=ROOT/'docs/qa/evidence/program-general-info-20260910'
FILES=['app/screens-marketplace.jsx','app/screens-admin-program-products.jsx','app/screens-admin-fincat.jsx','app/screens-terreno.jsx','app/fincat-store.jsx','scripts/build-bundle.js','scripts/test-program-catalog-cutover.js']
def git(*args):return subprocess.check_output(['git',*args],cwd=TREE).decode('utf8')
def sha(b):return hashlib.sha256(b).hexdigest()
def main():
 mode=sys.argv[1]
 if mode=='prepare':
  proof=[]
  for f in FILES:
   before=PRIVATE/'before'/f;current=TREE/f
   published=git('show','HEAD:'+f);tmp=PRIVATE/'published-temp'
   if f=='scripts/build-bundle.js':
    assert published.count("'fincat-store.jsx',")==1
    merged=published.replace("'fincat-store.jsx',","'fincat-store.jsx', 'program-general-info.jsx',",1)
    current.write_text(merged,encoding='utf8',newline='\n');proof.append({'file':f,'published':sha(published.encode()),'candidate':sha(merged.encode())});continue
   # Published typography tokens are unrelated changes; merge syntax deltas with
   # normalized sizes, then restore the published token for every matching size.
   tokens={m.group(2):m.group(1) for m in re.finditer(r"fontSize:\s*('var\(--text-[^,]+, ([0-9.]+)px\)')",published)}
   comparable=re.sub(r"fontSize:\s*'var\(--text-[^,]+, ([0-9.]+)px\)'",lambda m:'fontSize: '+m.group(1),published)
   normalized=PRIVATE/'normalized-before';normalized.write_text(before.read_text(encoding='utf8'),encoding='utf8',newline='\n')
   after=PRIVATE/'normalized-after';after.write_text((ROOT/f).read_text(encoding='utf8'),encoding='utf8',newline='\n')
   tmp.write_text(comparable,encoding='utf8',newline='\n')
   r=subprocess.run(['git','merge-file','-p',str(tmp),str(normalized),str(after)],capture_output=True)
   if r.returncode:(PRIVATE/'merge-conflict.txt').write_bytes(r.stdout)
   if r.returncode:raise RuntimeError('MERGE_CONFLICT '+f+' '+r.stderr.decode(errors='replace'))
   merged=r.stdout.decode('utf8')
   merged=re.sub(r'fontSize:\s*([0-9.]+)(?=\s*[,}])',lambda m:'fontSize: '+tokens.get(m.group(1),m.group(1)),merged)
   current.parent.mkdir(parents=True,exist_ok=True);current.write_text(merged,encoding='utf8',newline='\n')
   proof.append({'file':f,'published':sha(published.encode()),'candidate':sha(merged.encode())})
  additions=['app/program-general-info.jsx','supabase/migrations/20260910000200_program_general_info.sql','supabase/recovery/20260910000200_program_general_info.sql','docs/qa/H-PROGRAM-CATALOG-GENERAL-INFO-ADMIN-001.md']
  additions += [p.relative_to(ROOT).as_posix() for pattern in ['program-general-info-*','test-program-general-info*'] for p in (ROOT/'scripts').glob(pattern) if p.is_file()]
  for f in additions:
   target=TREE/f;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/f,target)
  html=git('show','HEAD:SutiApp.html');sw=git('show','HEAD:sw.js')
  version=max(int(re.search(r'app/bundle.js\?v=(\d+)',html)[1]),int(re.search(r'app/bundle.js\?v=(\d+)',sw)[1]))+1
  html=re.sub(r'app/bundle.js\?v=\d+','app/bundle.js?v='+str(version),html)
  sw=re.sub(r'app/bundle.js\?v=\d+','app/bundle.js?v='+str(version),sw)
  cache=int(re.search(r'sutiapp-v(\d+)',sw)[1])+1;sw=re.sub(r'sutiapp-v\d+','sutiapp-v'+str(cache),sw,count=1)
  html=re.sub(r'sw\.js\?v=\d+','sw.js?v='+str(cache),html)
  (TREE/'SutiApp.html').write_text(html,encoding='utf8');(TREE/'sw.js').write_text(sw,encoding='utf8')
  subprocess.run(['node',str(ROOT/'scripts/program-general-info-build.js'),str(TREE)],check=True)
  # Runtime configuration is private and excluded from commits.
  shutil.copyfile(ROOT/'supabase.env',TREE/'supabase.env')
  result={'status':'PASS','base':git('rev-parse','HEAD').strip(),'files':proof,'additions':additions,'bundleVersion':version,'bundleSha256':sha((TREE/'app/bundle.js').read_bytes())}
  (OUT/'release-preparation.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
  print(json.dumps({'status':'PASS','base':result['base'],'files':len(proof)+len(additions),'bundleVersion':version}))
 elif mode=='build':
  import importlib.util,os
  spec=importlib.util.spec_from_file_location('tools',ROOT/'scripts/program-general-info-tools.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  env=m.db.env();target=PRIVATE/'release-site';n=1
  while target.exists():n+=1;target=PRIVATE/('release-site-'+str(n))
  subprocess.run(['node','scripts/build-pages-site.js',str(target)],cwd=TREE,env=dict(os.environ,SUTIAPP_SUPABASE_URL=env['SUPABASE_URL'],SUTIAPP_SUPABASE_PUBLISHABLE_KEY=env['SUPABASE_PUBLISHABLE_KEY']),check=True)
  m.save('release-build.json',{'status':'PASS','directory':str(target),'bundleSha256':sha((target/'app/bundle.js').read_bytes())})
 else:raise ValueError(mode)
if __name__=='__main__':main()
