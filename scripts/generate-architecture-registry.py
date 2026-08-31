#!/usr/bin/env python3
"""Generate and query SutiApp's derived architecture registry.

This script is intentionally read-only with respect to product systems. It only
reads repository text files and writes deterministic artifacts under
docs/architecture/. No network, Supabase, Storage, Auth, or Google API is used.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import unicodedata
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "architecture"
MAIN = OUT / "SUTIAPP_ARCHITECTURE_REGISTRY.json"
PARTS = {
    "code": OUT / "registry-code.json",
    "data": OUT / "registry-data.json",
    "edges": OUT / "registry-edges.json",
    "search": OUT / "registry-search.json",
}
OVERRIDES = OUT / "architecture-overrides.json"
GENERATOR_VERSION = "1.0.0"
REGISTRY_VERSION = "1.0.0"

TEXT_SUFFIXES = {".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".sql", ".md", ".html", ".toml", ".json", ".ps1", ".py"}
TRACK_ROOTS = ("app", "supabase/migrations", "supabase/functions", "scripts", "docs", "google-apps-script")
EXCLUDED_PARTS = {".git", "node_modules", "dist", "build", "__pycache__", "uploads", "screenshots", "recovery"}
EXCLUDED_NAMES = {"supabase.env", ".env", "SUTIAPP_ARCHITECTURE_REGISTRY.json", "registry-code.json", "registry-data.json", "registry-edges.json", "registry-search.json", "HISTORICAL_TASK_COMPARISON.md"}
SENSITIVE_NAME = re.compile(r"(^|[._-])(env|secret|credentials?|token|password|private[-_]?key)([._-]|$)", re.I)
STRING = r"['\"]([^'\"\r\n]+)['\"]"

DOMAIN_DEFAULTS = [
    "identity", "admin-governance", "content", "union", "agreements",
    "marketplace", "programs", "requests", "company-portal", "finance",
    "exports", "architecture",
]


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def stable_id(kind: str, name: str, file: str = "") -> str:
    raw = f"{kind}:{name}:{file}".lower().encode("utf-8")
    return f"{kind}:{hashlib.sha1(raw).hexdigest()[:14]}"


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def evidence(file: str, text: str, offset: int, method: str) -> dict:
    return {"file": file, "line": line_of(text, offset), "method": method}


def tracked_files() -> list[Path]:
    result = []
    for base in TRACK_ROOTS:
        root = ROOT / base
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
                continue
            rp = rel(path)
            parts = set(Path(rp).parts)
            if parts & EXCLUDED_PARTS or path.name in EXCLUDED_NAMES:
                continue
            if SENSITIVE_NAME.search(path.name) or path.stat().st_size > 2_500_000:
                continue
            result.append(path)
    for name in ("AGENTS.md", "CLAUDE.md", "SutiApp.html"):
        path = ROOT / name
        if path.exists():
            result.append(path)
    return sorted(set(result), key=rel)


def fingerprints(paths: list[Path]) -> dict[str, str]:
    return {rel(path): sha256_bytes(path.read_bytes()) for path in paths}


def aggregate_hash(items: dict[str, str], prefix: str | None = None) -> str:
    rows = [f"{key}\0{value}" for key, value in sorted(items.items()) if prefix is None or key.startswith(prefix)]
    return sha256_bytes("\n".join(rows).encode("utf-8"))


def load_overrides() -> dict:
    if not OVERRIDES.exists():
        return {}
    return json.loads(read_text(OVERRIDES))


def domain_for(file: str, names: list[str], overrides: dict) -> str:
    hay = normalize(" ".join([file, *names]))
    for item in overrides.get("domain_rules", []):
        if any(normalize(pattern) in hay for pattern in item.get("patterns", [])):
            return item["domain"]
    rules = [
        ("architecture", ["architecture registry", "navigator"]),
        ("identity", ["affiliate", "auth", "credencial", "profile", "documentos", "expediente", "private asset"]),
        ("admin-governance", ["admin role", "admin authorization", "section responsibility", "permission"]),
        ("agreements", ["convenio", "agreement", "companies repository"]),
        ("marketplace", ["marketplace", "catalogo"]),
        ("finance", ["loan", "prestamo", "financial", "finance", "fondo", "payroll"]),
        ("requests", ["program request", "quote request", "benefit request", "historial"]),
        ("company-portal", ["company portal", "company module", "subscription"]),
        ("union", ["union screen", "sindicato", "membresia", "membership"]),
        ("exports", ["data export", "export audit"]),
        ("content", ["news", "banner", "popup", "content", "directory", "minute", "education"]),
        ("programs", ["program catalog", "program offering", "terreno"]),
    ]
    for domain, patterns in rules:
        if any(normalize(pattern) in hay for pattern in patterns):
            return domain
    return "content" if file.startswith("app/screens-") else "architecture"


def classify_test(file: str) -> str:
    low = file.lower()
    if "browser" in low:
        return "BROWSER"
    if "live" in low:
        return "LIVE_SUPABASE"
    if "rls" in low:
        return "RLS"
    if "security" in low or "auth" in low:
        return "SECURITY"
    if "recovery" in low:
        return "RECOVERY"
    return "STATIC"


def analyze_code_file(path: Path, overrides: dict) -> dict:
    file = rel(path)
    text = read_text(path)
    facts: dict[str, object] = {
        "file": file, "hash": sha256_bytes(text.encode("utf-8")), "kind": "code",
        "imports": [], "exports": [], "components": [], "handlers": [], "hooks": [],
        "repositories": [], "services": [], "global_references": [], "screens": [], "routes": [], "tables": [], "rpc": [],
        "edge_functions": [], "storage_buckets": [], "permissions": [], "references": [],
    }
    def collect(pattern: str, key: str, method: str, group: int = 1, flags: int = 0):
        seen = set()
        for match in re.finditer(pattern, text, flags):
            value = match.group(group).strip()
            if value and value not in seen:
                seen.add(value)
                facts[key].append({"name": value, "evidence": evidence(file, text, match.start(), method)})

    collect(r"(?:import\s+.*?\s+from\s+|require\s*\()" + STRING, "imports", "literal_import", flags=re.M)
    collect(r"(?:export\s+(?:default\s+)?(?:function|class|const|let|var)\s+|module\.exports\s*=\s*|exports\.)([A-Za-z_$][\w$]*)", "exports", "syntax_export")
    collect(r"window\.([A-Za-z_$][\w$]*)\s*=", "exports", "window_global_export")
    collect(r"(?:function|class|const)\s+([A-Z][A-Za-z0-9_$]{2,})\b", "components", "named_component")
    collect(r"(?:function|const)\s+((?:handle|on)[A-Z][A-Za-z0-9_$]*)\b", "handlers", "named_handler")
    collect(r"(?:function|const)\s+(use[A-Z][A-Za-z0-9_$]*)\b", "hooks", "named_hook")
    collect(r"(?:window\.|const\s+|class\s+|function\s+)([A-Za-z0-9_$]*Repository)\b", "repositories", "repository_symbol")
    collect(r"window\.([A-Za-z_$][\w$]*)\b", "global_references", "window_global_reference")
    collect(r"\.(?:from)\(\s*" + STRING + r"\s*\)", "tables", "supabase_literal_from")
    collect(r"\.rpc\(\s*" + STRING + r"\s*[,)]", "rpc", "supabase_literal_rpc")
    collect(r"functions\.invoke\(\s*" + STRING + r"\s*[,)]", "edge_functions", "supabase_literal_function")
    collect(r"storage\.from\(\s*" + STRING + r"\s*\)", "storage_buckets", "supabase_literal_bucket")
    collect(r"['\"]([a-z][a-z0-9_]*\.(?:read|write|create|update|delete|publish|order|assets|export|impersonate|visibility\.write))['\"]", "permissions", "permission_literal")
    collect(r"(?:navigate|push|setRoute|openRoute|goTo)\s*\(\s*" + STRING, "routes", "literal_navigation")

    service_file = any(token in path.stem for token in ("-auth", "-client", "-resolver", "-view-model", "-content", "-state"))
    if service_file:
        excluded = {item["name"] for key in ("components", "handlers", "hooks", "repositories") for item in facts[key]}
        for exported in facts["exports"]:
            name = exported["name"]
            if name not in excluded and (name[:1].isupper() or name.startswith(("create", "resolve", "use"))):
                facts["services"].append({"name": name, "evidence": exported["evidence"]})

    # Script references in tests and the generated bundle marker preserve explicit evidence.
    collect(r"(?:read|load|includes)\(\s*" + STRING, "references", "literal_file_reference")
    facts["references"] = [
        item for item in facts["references"]
        if "@" not in item["name"]
        and not SENSITIVE_NAME.search(Path(item["name"]).name)
        and ("/" in item["name"] or "\\" in item["name"] or Path(item["name"]).suffix.lower() in TEXT_SUFFIXES)
    ]
    for match in re.finditer(r"/\*\s*@@file\s+([^*]+?)\s*\*/", text):
        facts["references"].append({"name": f"app/{match.group(1).strip()}", "evidence": evidence(file, text, match.start(), "bundle_file_marker")})

    is_screen_file = path.name.startswith("screens-") or path.name in {"app.jsx", "custom-screen.jsx"}
    if is_screen_file:
        symbols = [x["name"] for x in facts["components"] if x["name"].endswith(("Screen", "Page", "View"))]
        screen_name = path.stem.replace("screens-", "").replace("-", " ").title()
        if symbols:
            screen_name = symbols[0]
        facts["screens"].append({
            "name": screen_name,
            "screen_key": path.stem,
            "component": symbols[0] if symbols else None,
            "admin_surface": "admin" in path.stem,
            "evidence": {"file": file, "line": 1, "method": "screen_file_convention"},
        })
    names = [item["name"] for key in ("components", "repositories", "tables", "rpc") for item in facts[key]]
    facts["domain"] = domain_for(file, names, overrides)
    if file.startswith("scripts/test-"):
        facts["test_type"] = classify_test(file)
    return facts


def split_sql_statements(text: str) -> list[tuple[int, str]]:
    cleaned = re.sub(r"/\*.*?\*/", lambda m: "\n" * m.group(0).count("\n"), text, flags=re.S)
    cleaned = re.sub(r"--[^\n]*", "", cleaned)
    out, start, quote, dollar, depth = [], 0, None, None, 0
    i = 0
    while i < len(cleaned):
        if dollar:
            if cleaned.startswith(dollar, i):
                i += len(dollar); dollar = None; continue
        elif quote:
            if cleaned[i] == quote and (i == 0 or cleaned[i - 1] != "\\"):
                quote = None
        else:
            dm = re.match(r"\$[A-Za-z0-9_]*\$", cleaned[i:])
            if dm:
                dollar = dm.group(0); i += len(dollar); continue
            if cleaned[i] in "'\"": quote = cleaned[i]
            elif cleaned[i] == "(": depth += 1
            elif cleaned[i] == ")": depth = max(0, depth - 1)
            elif cleaned[i] == ";" and depth == 0:
                statement = cleaned[start:i].strip()
                if statement: out.append((start, statement))
                start = i + 1
        i += 1
    tail = cleaned[start:].strip()
    if tail: out.append((start, tail))
    return out


def clean_ident(value: str) -> str:
    return value.strip().strip('"').lower()


def qualify(value: str) -> str:
    value = clean_ident(value)
    return value if "." in value else f"public.{value}"


def comma_parts(body: str) -> list[str]:
    parts, start, depth, quote = [], 0, 0, None
    for i, ch in enumerate(body):
        if quote:
            if ch == quote: quote = None
        elif ch in "'\"": quote = ch
        elif ch == "(": depth += 1
        elif ch == ")": depth = max(0, depth - 1)
        elif ch == "," and depth == 0:
            parts.append(body[start:i].strip()); start = i + 1
    parts.append(body[start:].strip())
    return [p for p in parts if p]


def analyze_sql_file(path: Path, overrides: dict) -> dict:
    file, text = rel(path), read_text(path)
    facts = {"file": file, "hash": sha256_bytes(text.encode()), "kind": "sql", "tables": [], "columns": [], "foreign_keys": [], "views": [], "rpc": [], "rls_policies": [], "storage_buckets": [], "permissions": [], "domain": None}
    for offset, statement in split_sql_statements(text):
        ev = evidence(file, text, offset, "sql_statement")
        table = re.match(r"create\s+table\s+(?:if\s+not\s+exists\s+)?([\w.\"]+)\s*\((.*)\)\s*$", statement, re.I | re.S)
        if table:
            table_name, body = qualify(table.group(1)), table.group(2)
            facts["tables"].append({"name": table_name, "evidence": ev})
            for part in comma_parts(body):
                if re.match(r"(?:constraint|primary\s+key|unique|check|foreign\s+key)\b", part, re.I):
                    fk = re.search(r"foreign\s+key\s*\(([^)]+)\)\s+references\s+([\w.\"]+)\s*\(([^)]+)\)", part, re.I)
                    if fk:
                        facts["foreign_keys"].append({"from": f"{table_name}.{clean_ident(fk.group(1))}", "to": f"{qualify(fk.group(2))}.{clean_ident(fk.group(3))}", "evidence": ev})
                    continue
                col = re.match(r'"?([A-Za-z_][\w$]*)"?\s+([^\s,]+(?:\s*\([^)]*\))?)', part)
                if col:
                    cname = clean_ident(col.group(1))
                    facts["columns"].append({"name": f"{table_name}.{cname}", "table": table_name, "data_type": col.group(2).lower(), "evidence": ev})
                    ref = re.search(r"references\s+([\w.\"]+)\s*\(([^)]+)\)", part, re.I)
                    if ref:
                        facts["foreign_keys"].append({"from": f"{table_name}.{cname}", "to": f"{qualify(ref.group(1))}.{clean_ident(ref.group(2))}", "evidence": ev})
        alter = re.match(r"alter\s+table\s+(?:if\s+exists\s+)?([\w.\"]+)\s+(.*)$", statement, re.I | re.S)
        if alter:
            table_name, body = qualify(alter.group(1)), alter.group(2)
            for add in re.finditer(r"add\s+column\s+(?:if\s+not\s+exists\s+)?\"?([A-Za-z_][\w$]*)\"?\s+([^\s,;]+(?:\s*\([^)]*\))?)", body, re.I):
                facts["columns"].append({"name": f"{table_name}.{clean_ident(add.group(1))}", "table": table_name, "data_type": add.group(2).lower(), "evidence": ev})
            for fk in re.finditer(r"foreign\s+key\s*\(([^)]+)\)\s+references\s+([\w.\"]+)\s*\(([^)]+)\)", body, re.I):
                facts["foreign_keys"].append({"from": f"{table_name}.{clean_ident(fk.group(1))}", "to": f"{qualify(fk.group(2))}.{clean_ident(fk.group(3))}", "evidence": ev})
        view = re.match(r"create\s+(?:or\s+replace\s+)?view\s+([\w.\"]+)", statement, re.I)
        if view: facts["views"].append({"name": qualify(view.group(1)), "evidence": ev})
        func = re.match(r"create\s+(?:or\s+replace\s+)?function\s+([\w.\"]+)\s*\(", statement, re.I)
        if func: facts["rpc"].append({"name": qualify(func.group(1)), "evidence": ev})
        pol = re.match(r"create\s+policy\s+[\"']?([^\"']+?)[\"']?\s+on\s+([\w.\"]+)", statement, re.I | re.S)
        if pol: facts["rls_policies"].append({"name": pol.group(1).strip(), "table": qualify(pol.group(2)), "evidence": ev})
        for bucket in re.finditer(r"insert\s+into\s+storage\.buckets[\s\S]*?values\s*\(\s*['\"]([^'\"]+)", statement, re.I):
            facts["storage_buckets"].append({"name": bucket.group(1), "evidence": ev})
        for perm in re.finditer(r"['\"]([a-z][a-z0-9_]*\.(?:read|write|create|update|delete|publish|order|assets|export|impersonate|visibility\.write))['\"]", statement, re.I):
            facts["permissions"].append({"name": perm.group(1).lower(), "evidence": ev})
    names = [x.get("name", "") for key in ("tables", "views", "rpc", "storage_buckets") for x in facts[key]]
    facts["domain"] = domain_for(file, names, overrides)
    return facts


def analyze_file(path: Path, overrides: dict) -> dict:
    if path.suffix.lower() == ".sql" and rel(path).startswith("supabase/migrations/"):
        return analyze_sql_file(path, overrides)
    return analyze_code_file(path, overrides)


def unique_evidence(items: list[dict]) -> list[dict]:
    seen, result = set(), []
    for item in items:
        key = (item.get("file"), item.get("line"), item.get("method"))
        if key not in seen: seen.add(key); result.append(item)
    return result[:8]


def build_registry(facts: dict[str, dict], fps: dict[str, str], overrides: dict) -> tuple[dict, dict, dict, dict]:
    nodes: dict[str, dict] = {}
    edges: dict[tuple, dict] = {}
    by_key: dict[tuple[str, str], str] = {}

    def node(kind: str, name: str, file: str = "", domain: str = "architecture", ev: dict | None = None, props: dict | None = None, aliases: list[str] | None = None) -> str:
        key = (kind, normalize(name))
        if key in by_key:
            nid = by_key[key]
            if ev: nodes[nid]["evidence"] = unique_evidence(nodes[nid]["evidence"] + [ev])
            if file and file not in nodes[nid]["files"]: nodes[nid]["files"].append(file); nodes[nid]["files"].sort()
            if aliases: nodes[nid]["aliases"] = sorted(set(nodes[nid]["aliases"] + aliases))
            if props: nodes[nid]["properties"].update({k: v for k, v in props.items() if v not in (None, [], "")})
            return nid
        nid = stable_id(kind, name)
        by_key[key] = nid
        nodes[nid] = {"id": nid, "type": kind, "name": name, "domain": domain, "files": [file] if file else [], "aliases": sorted(set(aliases or [])), "evidence": [ev] if ev else [], "confidence": "EXPLICIT" if ev else "DECLARED", "properties": props or {}}
        return nid

    def edge(source: str, target: str, kind: str, ev: dict | None = None, confidence: str = "EXPLICIT"):
        if source == target: return
        key = (source, target, kind)
        if key not in edges: edges[key] = {"from": source, "to": target, "type": kind, "confidence": confidence, "evidence": []}
        if ev: edges[key]["evidence"] = unique_evidence(edges[key]["evidence"] + [ev])

    domain_ids = {name: node("domain", name, domain=name, props={"status": "INDEXED"}) for name in DOMAIN_DEFAULTS}
    file_ids = {}
    for file, fact in sorted(facts.items()):
        domain = fact.get("domain", "architecture")
        fid = node("file", file, file=file, domain=domain, props={"hash": fact["hash"], "kind": fact["kind"]})
        file_ids[file] = fid
        edge(domain_ids.setdefault(domain, node("domain", domain, domain=domain)), fid, "CONTAINS")
        if file.startswith("scripts/test-"):
            tid = node("test", file, file=file, domain=domain, ev={"file": file, "line": 1, "method": "test_file"}, props={"test_type": fact.get("test_type", "STATIC"), "status": "MAPPED"})
            edge(fid, tid, "DEFINES")
        for key, kind in (("components", "component"), ("handlers", "handler"), ("hooks", "hook"), ("repositories", "repository"), ("services", "service"), ("routes", "route"), ("edge_functions", "edge_function"), ("permissions", "permission"), ("storage_buckets", "storage_bucket"), ("rpc", "rpc"), ("tables", "table"), ("views", "view"), ("rls_policies", "rls_policy")):
            for item in fact.get(key, []):
                name = item["name"]
                props = {k: v for k, v in item.items() if k not in {"name", "evidence"}}
                nid = node(kind, name, file=file, domain=domain, ev=item.get("evidence"), props=props)
                edge(fid, nid, "DEFINES" if kind not in {"table", "rpc", "storage_bucket", "permission"} or fact["kind"] == "sql" else "REFERENCES", item.get("evidence"))
                if fact["kind"] != "sql" and kind in {"table", "rpc", "storage_bucket", "permission", "edge_function"}:
                    edge(fid, nid, "USES", item.get("evidence"))
        for screen in fact.get("screens", []):
            sid = node("admin_screen" if screen["admin_surface"] else "screen", screen["name"], file=file, domain=domain, ev=screen["evidence"], props={k: v for k, v in screen.items() if k not in {"name", "evidence"}})
            edge(fid, sid, "DEFINES", screen["evidence"])
            for repo in fact.get("repositories", []): edge(sid, node("repository", repo["name"], file=file, domain=domain, ev=repo["evidence"]), "USES", repo["evidence"])
            for route in fact.get("routes", []): edge(node("route", route["name"], file=file, domain=domain, ev=route["evidence"]), sid, "ROUTES_TO", route["evidence"])
        for col in fact.get("columns", []):
            cid = node("column", col["name"], file=file, domain=domain, ev=col["evidence"], props={"data_type": col.get("data_type")})
            tid = node("table", col["table"], file=file, domain=domain)
            edge(tid, cid, "HAS_COLUMN", col["evidence"])
        for fk in fact.get("foreign_keys", []):
            src = node("column", fk["from"], file=file, domain=domain, ev=fk["evidence"])
            dst = node("column", fk["to"], file=file, domain=domain)
            edge(src, dst, "FOREIGN_KEY_TO", fk["evidence"])
        for pol in fact.get("rls_policies", []):
            pid = node("rls_policy", pol["name"], file=file, domain=domain, ev=pol["evidence"], props={"table": pol["table"]})
            edge(pid, node("table", pol["table"], file=file, domain=domain), "PROTECTS", pol["evidence"])

    # Connect code files to resources they explicitly reference and tests to explicit literals.
    for file, fact in facts.items():
        fid = file_ids[file]
        screen_ids = [by_key[(kind, normalize(item["name"]))] for item in fact.get("screens", []) for kind in ("admin_screen" if item["admin_surface"] else "screen",) if (kind, normalize(item["name"])) in by_key]
        own_exports = {item["name"] for item in fact.get("exports", [])}
        for ref in fact.get("global_references", []):
            if ref["name"] in own_exports:
                continue
            for kind in ("component", "repository", "service"):
                target_key = (kind, normalize(ref["name"]))
                if target_key in by_key:
                    target = by_key[target_key]
                    edge(fid, target, "USES", ref["evidence"])
                    for sid in screen_ids:
                        edge(sid, target, "USES", ref["evidence"])
        for ref in fact.get("references", []):
            target = ref["name"].replace("\\", "/")
            if target in file_ids:
                edge(fid, file_ids[target], "TESTS" if file.startswith("scripts/test-") else "REFERENCES", ref["evidence"])
        if file.startswith("scripts/test-"):
            content = read_text(ROOT / file)
            for nid, item in list(nodes.items()):
                needle = item["name"] if item["type"] == "permission" else item["name"].split(".")[-1]
                if item["type"] in {"table", "rpc", "permission", "storage_bucket", "edge_function"} and len(needle) >= 4 and re.search(rf"(?<![\w]){re.escape(needle)}(?![\w])", content, re.I):
                    edge(fid, nid, "TESTS", {"file": file, "line": 1, "method": "explicit_resource_literal"})

    # Minimal semantic overrides: aliases, authorities, protected boundaries, and proven links.
    for item in overrides.get("nodes", []):
        nid = node(item["type"], item["name"], item.get("file", ""), item.get("domain", "architecture"), props=item.get("properties", {}), aliases=item.get("aliases", []))
        nodes[nid]["domain"] = item.get("domain", nodes[nid]["domain"])
        if item.get("source_of_truth"):
            aid = node("source_of_truth", item["source_of_truth"], domain=item.get("domain", "architecture"), props={"classification": item["source_of_truth"]})
            edge(nid, aid, "AUTHORIZED_BY", confidence="DECLARED")
    for item in overrides.get("relationships", []):
        skey, tkey = (item["from_type"], normalize(item["from"])), (item["to_type"], normalize(item["to"]))
        if skey in by_key and tkey in by_key:
            edge(by_key[skey], by_key[tkey], item["type"], confidence="DECLARED")

    node_list = sorted(nodes.values(), key=lambda x: (x["type"], normalize(x["name"]), x["id"]))
    edge_list = sorted(edges.values(), key=lambda x: (x["from"], x["type"], x["to"]))
    incoming, outgoing = defaultdict(list), defaultdict(list)
    for item in edge_list:
        outgoing[item["from"]].append(item["to"]); incoming[item["to"]].append(item["from"])
    for item in node_list:
        item["upstream"] = sorted(set(incoming[item["id"]]))
        item["downstream"] = sorted(set(outgoing[item["id"]]))

    search = defaultdict(set)
    for item in node_list:
        terms = [item["name"], item["domain"], *item["aliases"], *item["files"]]
        for term in terms:
            norm = normalize(term)
            if norm:
                search[norm].add(item["id"])
                for token in norm.split():
                    if len(token) >= 3: search[token].add(item["id"])
    search_json = {key: sorted(value) for key, value in sorted(search.items())}
    types = defaultdict(int)
    domains = defaultdict(lambda: defaultdict(int))
    for item in node_list:
        types[item["type"]] += 1; domains[item["domain"]][item["type"]] += 1
    repo_hash, schema_hash = aggregate_hash(fps), aggregate_hash(fps, "supabase/migrations/")
    latest = 0
    for file in fps:
        try:
            latest = max(latest, int((ROOT / file).stat().st_mtime))
        except FileNotFoundError:
            # Incremental removal can race with OneDrive/AV propagation on Windows.
            # The missing path is already absent from the next discovery pass.
            continue
    main = {
        "metadata": {
            "registry_version": REGISTRY_VERSION, "generator_version": GENERATOR_VERSION,
            "generated_at": datetime.fromtimestamp(latest, timezone.utc).isoformat().replace("+00:00", "Z"),
            "repo_hash": repo_hash, "schema_hash": schema_hash,
            "classification": "DERIVED_TECHNICAL_INDEX", "runtime_authority": False,
            "observatory_ready": True,
        },
        "freshness": {"status": "FRESH", "tracked_files": fps},
        "partitions": {key: rel(path) for key, path in PARTS.items()},
        "statistics": {
            "nodes": len(node_list), "edges": len(edge_list),
            "foreign_key": sum(1 for e in edge_list if e["type"] == "FOREIGN_KEY_TO"),
            "admin_frontend_mapping": sum(1 for e in edge_list if e["type"] == "REFLECTS_IN"),
            "upstream_downstream_relation": len(edge_list),
            "alias": sum(len(n["aliases"]) for n in node_list),
            **dict(sorted(types.items())),
        },
        "domains": {name: {"status": "INDEXED", "counts": dict(sorted(counts.items()))} for name, counts in sorted(domains.items())},
        "health": {"status": "CONNECTED", "authority_conflicts": [], "notes": ["Derived only; explicit evidence and overrides remain subordinate to current code/schema."]},
        "observatory": {"node_types": sorted(types), "edge_types": sorted({e["type"] for e in edge_list}), "node_id_field": "id", "edge_fields": ["from", "to", "type"]},
    }
    code = {"facts": {k: v for k, v in sorted(facts.items()) if v["kind"] != "sql"}, "nodes": [n for n in node_list if n["type"] not in {"table", "column", "foreign_key", "view", "rpc", "rls_policy", "storage_bucket"}]}
    data = {"facts": {k: v for k, v in sorted(facts.items()) if v["kind"] == "sql"}, "nodes": [n for n in node_list if n["type"] in {"table", "column", "foreign_key", "view", "rpc", "rls_policy", "storage_bucket", "source_of_truth"}]}
    graph = {"nodes": node_list, "edges": edge_list}
    return main, code, data, {"graph": graph, "search": search_json}


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"
    path.write_text(payload, encoding="utf-8", newline="\n")


def save_registry(main: dict, code: dict, data: dict, combined: dict) -> None:
    write_json(MAIN, main); write_json(PARTS["code"], code); write_json(PARTS["data"], data)
    write_json(PARTS["edges"], combined["graph"]); write_json(PARTS["search"], combined["search"])


def full_generate() -> dict:
    overrides, paths = load_overrides(), tracked_files()
    fps = fingerprints(paths)
    facts = {rel(path): analyze_file(path, overrides) for path in paths}
    built = build_registry(facts, fps, overrides)
    save_registry(*built)
    return built[0]


def current_changes(main: dict) -> tuple[list[str], list[str], list[str], dict[str, str]]:
    current = fingerprints(tracked_files()); stored = main["freshness"]["tracked_files"]
    changed = sorted(k for k in current.keys() & stored.keys() if current[k] != stored[k])
    added = sorted(current.keys() - stored.keys()); removed = sorted(stored.keys() - current.keys())
    return changed, added, removed, current


def freshness(json_output: bool = False) -> int:
    if not MAIN.exists():
        result = {"status": "MISSING", "changed": [], "added": [], "removed": []}
    else:
        main = json.loads(read_text(MAIN)); changed, added, removed, current = current_changes(main)
        status = "FRESH" if not (changed or added or removed) and aggregate_hash(current) == main["metadata"]["repo_hash"] else "STALE"
        result = {"status": status, "changed": changed, "added": added, "removed": removed}
    print(json.dumps(result, ensure_ascii=False) if json_output else result["status"] + (f" changed={len(result['changed'])} added={len(result['added'])} removed={len(result['removed'])}" if result["status"] == "STALE" else ""))
    return 0 if result["status"] == "FRESH" else 2


def incremental(changed_args: list[str]) -> dict:
    if not MAIN.exists(): return full_generate()
    main = json.loads(read_text(MAIN)); actual_changed, actual_added, actual_removed, current = current_changes(main)
    actual = set(actual_changed + actual_added + actual_removed)
    declared = {Path(x).as_posix().lstrip("./") for x in changed_args}
    if actual != declared:
        missing, extra = sorted(actual - declared), sorted(declared - actual)
        raise SystemExit(f"Incremental set mismatch. missing={missing} extra={extra}")
    code, data = json.loads(read_text(PARTS["code"])), json.loads(read_text(PARTS["data"]))
    facts = {**code["facts"], **data["facts"]}; overrides = load_overrides()
    for file in actual:
        path = ROOT / file
        if path.exists(): facts[file] = analyze_file(path, overrides)
        else: facts.pop(file, None)
    built = build_registry(facts, current, overrides); save_registry(*built)
    return built[0]


def load_graph() -> tuple[dict, list[dict], dict[str, list[str]]]:
    graph = json.loads(read_text(PARTS["edges"])); search = json.loads(read_text(PARTS["search"]))
    return {n["id"]: n for n in graph["nodes"]}, graph["edges"], search


def lookup(query: str, limit: int = 10) -> dict:
    if not MAIN.exists(): raise SystemExit("Registry missing. Run generate first.")
    fresh_main = json.loads(read_text(MAIN)); changed, added, removed, _ = current_changes(fresh_main)
    freshness_state = "FRESH" if not (changed or added or removed) else "STALE"
    nodes, edges, index = load_graph(); q = normalize(query)
    scores = defaultdict(int)
    for term, ids in index.items():
        if term == q: weight = 100
        elif q in term: weight = 40
        elif all(token in term for token in q.split()): weight = 25
        else:
            query_tokens = [token for token in q.split() if len(token) >= 3]
            overlap = sum(1 for token in query_tokens if token in term)
            if not query_tokens or overlap < max(1, (len(query_tokens) + 1) // 2):
                continue
            weight = 5 * overlap
        for nid in ids: scores[nid] += weight
    seeds = [nid for nid, _ in sorted(scores.items(), key=lambda x: (-x[1], nodes[x[0]]["type"], nodes[x[0]]["name"]))[:limit]]
    adjacency = defaultdict(list)
    for edge in edges:
        adjacency[edge["from"]].append((edge, edge["to"])); adjacency[edge["to"]].append((edge, edge["from"]))
    selected, queue = set(seeds), deque((nid, 0) for nid in seeds)
    selected_edges = []
    while queue:
        nid, depth = queue.popleft()
        if depth >= 2: continue
        for edge, other in adjacency[nid]:
            other_node = nodes[other]
            if nodes[nid]["type"] == "source_of_truth" and depth > 0:
                continue
            if nodes[nid]["type"] == "file" and depth > 0:
                is_test_definition = edge["type"] == "DEFINES" and other_node["type"] == "test"
                is_direct_test = edge["type"] == "TESTS" and other_node["type"] == "file" and other_node["name"].startswith("scripts/test-")
                if not (is_test_definition or is_direct_test):
                    continue
            if edge["type"] in {"USES", "DEFINES", "TESTS", "PROTECTS", "AUTHORIZED_BY", "ROUTES_TO", "WRITES", "READS", "CALLS", "RELATES_TO", "RESOLVES_TO", "ADMINISTERS", "REFLECTS_IN", "HAS_COLUMN", "FOREIGN_KEY_TO"}:
                selected_edges.append(edge)
                if other not in selected and len(selected) < 80:
                    selected.add(other); queue.append((other, depth + 1))
    selected_nodes = [nodes[nid] for nid in selected]
    focus_domains = sorted({nodes[nid]["domain"] for nid in seeds})
    focus_nodes = [n for n in selected_nodes if n["domain"] in focus_domains or n["type"] == "source_of_truth"]
    focus_ids = {n["id"] for n in focus_nodes}
    cross_domain = [n for n in selected_nodes if n["domain"] not in focus_domains and n["type"] in {"screen", "admin_screen"}]
    file_scores = defaultdict(int)
    for n in focus_nodes:
        base = scores.get(n["id"], 1)
        for file in n["files"]:
            penalty = 100 if file == "app/bundle.js" else 8 if file.startswith("docs/") else 1
            file_scores[file] += base / penalty
    primary_files = [file for file, _ in sorted(file_scores.items(), key=lambda x: (-x[1], x[0]))[:10]]
    by_type = defaultdict(list)
    for n in sorted(focus_nodes, key=lambda x: (x["type"], x["name"])): by_type[n["type"]].append(n["name"])
    return {
        "query": query, "freshness": freshness_state,
        "fallback_required": not seeds or freshness_state == "STALE",
        "domains": focus_domains,
        "primary_files": primary_files,
        "context": {k: v[:20] for k, v in sorted(by_type.items())},
        "cross_domain_impact": {
            "domains": sorted({n["domain"] for n in cross_domain}),
            "consumers": [n["name"] for n in sorted(cross_domain, key=lambda x: (x["domain"], x["name"]))[:20]],
        },
        "nodes": focus_nodes[:80],
        "edges": sorted({json.dumps(e, sort_keys=True, ensure_ascii=False) for e in selected_edges if e["from"] in focus_ids and e["to"] in focus_ids})[:120],
        "stale_changes": {"changed": changed, "added": added, "removed": removed},
    }


def main_cli() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("generate")
    check = sub.add_parser("check"); check.add_argument("--json", action="store_true")
    inc = sub.add_parser("incremental"); inc.add_argument("files", nargs="+")
    look = sub.add_parser("lookup"); look.add_argument("query"); look.add_argument("--limit", type=int, default=10); look.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    if args.command == "generate":
        result = full_generate(); print(json.dumps(result["statistics"], ensure_ascii=False)); return 0
    if args.command == "check": return freshness(args.json)
    if args.command == "incremental":
        result = incremental(args.files); print(json.dumps(result["statistics"], ensure_ascii=False)); return 0
    result = lookup(args.query, args.limit)
    if args.compact: result.pop("nodes", None); result.pop("edges", None)
    print(json.dumps(result, ensure_ascii=False, indent=2)); return 0


if __name__ == "__main__":
    raise SystemExit(main_cli())
