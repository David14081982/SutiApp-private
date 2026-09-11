"""Reconcile the derived registry against actual files, never a sparse omission."""
import hashlib,importlib.util,json,pathlib,sys
root=pathlib.Path(sys.argv[1]).resolve() if len(sys.argv)>1 else pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('registry',root/'scripts/generate-architecture-registry.py')
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
main=json.loads(r.MAIN.read_text(encoding='utf8'));changed,added,removed,_=r.current_changes(main)
assert not removed,'Registry inputs missing; hydrate checkout before updating.'
print(json.dumps({'changed':len(changed),'added':len(added),'removed':0}),flush=True)
# Keep proven identical facts when checkout only changed line endings. The
# current raw fingerprint still updates; no domain analysis or source changes.
facts={}
for part in ['code','data']:
 facts.update(json.loads(r.PARTS[part].read_text(encoding='utf8'))['facts'])
analyze=r.analyze_file
def inspect(path,overrides):
 name=r.rel(path);data=path.read_bytes();lf=data.replace(b'\r\n',b'\n')
 previous=main['freshness']['tracked_files'].get(name)
 if name in facts and previous in {hashlib.sha256(lf).hexdigest(),hashlib.sha256(lf.replace(b'\n',b'\r\n')).hexdigest()}:
  return facts[name]
 print('Inspect: '+name,flush=True)
 return analyze(path,overrides)
r.analyze_file=inspect
if changed or added:r.incremental(changed+added)
assert r.freshness()==0
print('PASS: registry reflects inspected sources and evidence.',flush=True)
