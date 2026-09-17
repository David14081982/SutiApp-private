"""Update the derived index; conservatively skip impossible literal searches."""
import importlib.util
import json
import re

spec = importlib.util.spec_from_file_location("registry", "scripts/generate-architecture-registry.py")
registry = importlib.util.module_from_spec(spec)
spec.loader.exec_module(registry)
original_search = re.search
folded = {}
prefix, suffix = r"(?<![\w])", r"(?![\w])"
special_case = str.maketrans({"İ": "i", "ı": "i", "ſ": "s", "K": "k"})


def search(pattern, text, flags=0):
    # The generator scans every test for every resource. An ASCII literal that
    # cannot occur even without boundaries cannot match the original regexp.
    # All possible matches still go through the unchanged regexp engine.
    if isinstance(pattern, str) and flags == re.I and pattern.startswith(prefix) and pattern.endswith(suffix):
        body = pattern[len(prefix):-len(suffix)]
        literal = re.sub(r"\\(.)", r"\1", body)
        if literal.isascii() and re.escape(literal) == body:
            if text not in folded:
                folded[text] = text.translate(special_case).lower()
            if literal.lower() not in folded[text]:
                return None
    return original_search(pattern, text, flags)


re.search = search
re._MAXCACHE = 65536
re._MAXCACHE2 = 65536
changed, added, removed, _ = registry.current_changes(json.loads(registry.read_text(registry.MAIN)))
print("Updating", len(changed + added + removed), "changed index inputs", flush=True)
result = registry.incremental(changed + added + removed)
print("REGISTRY UPDATED", result["statistics"]["nodes"], "nodes", flush=True)
