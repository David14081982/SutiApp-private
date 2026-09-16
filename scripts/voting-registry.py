"""Refresh derived registry using the existing literal-absence optimization."""
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
main=json.loads(gen.MAIN.read_text(encoding='utf8'));changed,added,removed,_=gen.current_changes(main)
if changed or added or removed:gen.incremental(changed+added+removed)
lookup=gen.lookup('Votaciones')
assert lookup['freshness']=='FRESH'
assert 'app/screens-voting.jsx' in lookup['primary_files']
print(json.dumps({'status':'PASS','freshness':lookup['freshness'],'primary_files':lookup['primary_files'],'generatorChanged':False}))
