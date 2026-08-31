#!/usr/bin/env python3
"""Offline acceptance suite for the SutiApp Architecture Registry."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
GEN_PATH = ROOT / "scripts" / "generate-architecture-registry.py"
OUT = ROOT / "docs" / "architecture"
FIXTURE = ROOT / "app" / "__navigator_incremental_fixture__.js"


def load_generator():
    spec = importlib.util.spec_from_file_location("suti_registry", GEN_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(module)
    return module


def run(*args: str, expected: int = 0) -> subprocess.CompletedProcess:
    proc = subprocess.run([sys.executable, str(GEN_PATH), *args], cwd=ROOT, text=True, capture_output=True)
    assert proc.returncode == expected, f"{args}: rc={proc.returncode}\n{proc.stdout}\n{proc.stderr}"
    return proc


def digest_outputs() -> str:
    names = ["SUTIAPP_ARCHITECTURE_REGISTRY.json", "registry-code.json", "registry-data.json", "registry-edges.json", "registry-search.json"]
    h = hashlib.sha256()
    for name in names: h.update((OUT / name).read_bytes())
    return h.hexdigest()


def main() -> int:
    gen = load_generator()
    if FIXTURE.exists(): FIXTURE.unlink()
    run("generate")
    main_doc = json.loads((OUT / "SUTIAPP_ARCHITECTURE_REGISTRY.json").read_text(encoding="utf-8"))
    stats = main_doc["statistics"]
    assert main_doc["metadata"]["classification"] == "DERIVED_TECHNICAL_INDEX"
    assert main_doc["metadata"]["runtime_authority"] is False
    assert all(stats.get(key, 0) > 0 for key in ("domain", "screen", "admin_screen", "route", "component", "handler", "hook", "repository", "service", "table", "column", "foreign_key", "rpc", "edge_function", "storage_bucket", "permission", "rls_policy", "test", "source_of_truth", "nodes", "edges"))
    assert stats["admin_frontend_mapping"] > 0 and stats["upstream_downstream_relation"] > 0
    assert run("check").stdout.strip() == "FRESH"

    expected = {
        "Credencial": ("CredencialScreen", "app/screens-credencial.jsx"),
        "Convenios": ("ConveniosScreen", "app/screens-convenios.jsx"),
        "Suti Préstamo": ("LoanScreen", "app/screens-loan.jsx"),
        "public.affiliates": ("public.affiliates", None),
        "public.affiliates.numero_control": ("public.affiliates.numero_control", None),
    }
    for query, (needle, file) in expected.items():
        result = gen.lookup(query)
        assert result["freshness"] == "FRESH" and not result["fallback_required"], query
        assert any(node["name"] == needle for node in result["nodes"]), query
        assert len(result["primary_files"]) <= 10
        if file: assert file in result["primary_files"], (query, result["primary_files"])
    assert gen.lookup("feature that does not exist xyz")["fallback_required"] is True
    credential_photo = gen.lookup("fotografía credencial")
    assert credential_photo["domains"] == ["identity"]
    assert "app/ui.jsx" in credential_photo["primary_files"]
    assert any(node["name"] == "AffiliateRepository" for node in credential_photo["nodes"])
    assert any(node["name"] == "Avatar" for node in credential_photo["nodes"])

    graph = json.loads((OUT / "registry-edges.json").read_text(encoding="utf-8"))
    assert any(edge["type"] == "REFLECTS_IN" for edge in graph["edges"])
    assert any(edge["type"] == "FOREIGN_KEY_TO" for edge in graph["edges"])
    assert any(edge["type"] == "PROTECTS" for edge in graph["edges"])
    assert any(edge["type"] == "TESTS" for edge in graph["edges"])
    assert any(node["type"] == "permission" for node in graph["nodes"])

    payload = "".join(path.read_text(encoding="utf-8") for path in OUT.glob("*.json"))
    assert re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", payload, re.I) is None
    assert "supabase.env" not in payload.lower()
    assert not any(marker in payload for marker in ("eyJhbGciOi", "-----BEGIN PRIVATE KEY-----", "SUPABASE_SECRET_KEY="))

    # Stale detection and a true incremental add/remove cycle.
    FIXTURE.write_text("window.NavigatorFixtureScreen = function NavigatorFixtureScreen() {};\n", encoding="utf-8", newline="\n")
    try:
        stale = run("check", "--json", expected=2)
        assert "STALE" in stale.stdout and "app/__navigator_incremental_fixture__.js" in stale.stdout
        run("incremental", "app/__navigator_incremental_fixture__.js")
        assert any(node["name"] == "NavigatorFixtureScreen" for node in gen.lookup("NavigatorFixtureScreen")["nodes"])
        FIXTURE.unlink()
        run("incremental", "app/__navigator_incremental_fixture__.js")
        assert run("check").stdout.strip() == "FRESH"
    finally:
        if FIXTURE.exists(): FIXTURE.unlink()
        run("generate")

    first = digest_outputs(); run("generate"); second = digest_outputs()
    assert first == second, "generation is not deterministic on an unchanged tree"
    print("PASS generation freshness stale lookup screen table column reverse admin permissions tests fallback incremental secrets determinism")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
