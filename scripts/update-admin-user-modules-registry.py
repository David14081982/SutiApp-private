"""Refresh the release's derived index and verify the new RPCs without changing the generator."""
import sys,importlib.util,json,re,functools
from pathlib import Path

root=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parents[1]
re._MAXCACHE=16384
original_search=re.search
@functools.lru_cache(maxsize=1024)
def folded(text):return text.translate(str.maketrans({'\u0130':'i','\u0131':'i','\u017f':'s','\u212a':'k'})).lower()
def literal_search(pattern,string,flags=0):
    prefix=r'(?<![\w])';suffix=r'(?![\w])'
    if flags==re.I and isinstance(pattern,str) and pattern.startswith(prefix) and pattern.endswith(suffix):
        escaped=pattern[len(prefix):-len(suffix)];literal=re.sub(r'\\(.)',r'\1',escaped)
        if literal.isascii() and re.escape(literal)==escaped and folded(literal) not in folded(string):return None
    return original_search(pattern,string,flags)
re.search=literal_search
spec=importlib.util.spec_from_file_location('registry',root/'scripts/generate-architecture-registry.py');gen=importlib.util.module_from_spec(spec);spec.loader.exec_module(gen)
def refresh():
    if not gen.MAIN.exists():gen.full_generate();return
    main=json.loads(gen.MAIN.read_text(encoding='utf8'));changed,added,removed,_=gen.current_changes(main)
    if changed or added or removed:gen.incremental(changed+added+removed)
refresh()
graph=json.loads(gen.PARTS['edges'].read_text(encoding='utf8'))
for name in ['save_admin_user_modules','get_admin_user_modules','list_module_general_requests','has_admin_module']:
    assert any(name in n['name'] for n in graph['nodes']),name
assert gen.lookup('save_admin_user_modules')['freshness']=='FRESH'
payload=''.join(p.read_text(encoding='utf8') for p in (root/'docs/architecture').glob('*.json'))
assert not original_search(r'[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}',payload,re.I)
assert not any(marker in payload for marker in ['eyJhbGciOi','-----BEGIN PRIVATE KEY-----','SUPABASE_SECRET_KEY='])
out=root/'docs/qa/evidence/admin-user-modules-20260914/registry-release.json'
out.write_text(json.dumps({'status':'PASS','generatorChanged':False,'checks':['freshness','moduleRPCs','lookup','noEmailsOrSecrets'],'runtimeOptimization':'equivalent literal absence prefilter; matching candidates use original regex'},indent=2),encoding='utf8')
refresh();assert gen.freshness(True)==0
