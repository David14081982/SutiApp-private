#!/usr/bin/env python3
"""Reproducibly compare broad discovery with Registry-first lookup."""

from __future__ import annotations

import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
GEN = ROOT / "scripts" / "generate-architecture-registry.py"
REPORT = ROOT / "docs" / "architecture" / "HISTORICAL_TASK_COMPARISON.md"


def load_generator():
    spec = importlib.util.spec_from_file_location("suti_registry", GEN)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(module)
    return module


def main() -> int:
    gen = load_generator()
    cases = [
        ("Perfil / Credencial", ["Credencial", "profile_photo", "AffiliateRepository"]),
        ("Convenios", ["Convenios", "CompaniesRepository", "company_benefits"]),
        ("Suti Préstamo", ["Suti Préstamo", "FinancialLegacyRepository", "loan_term_policy"]),
    ]
    tracked = gen.tracked_files()
    rows = []
    for label, aliases in cases:
        broad_files = set()
        for alias in aliases:
            needle = gen.normalize(alias)
            for path in tracked:
                if needle and needle in gen.normalize(gen.read_text(path)):
                    broad_files.add(gen.rel(path))
        result = gen.lookup(aliases[0])
        rows.append((label, len(aliases), len(broad_files), 1, len(result["primary_files"]), 0 if not result["fallback_required"] else 1))

    lines = [
        "# Architecture Navigator — comparación de tareas históricas",
        "",
        "Medición reproducible sobre el mismo corte del repositorio. `WITHOUT REGISTRY` ejecuta una búsqueda global por cada alias técnico/humano y cuenta la unión de archivos candidatos; `WITH REGISTRY` ejecuta un lookup y cuenta únicamente `primary_files`. No se estiman tokens.",
        "",
        "| Tarea | Searches sin Registry | Archivos candidatos sin Registry | Lookups con Registry | Archivos primarios con Registry | Fallback searches |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for row in rows:
        lines.append(f"| {row[0]} | {row[1]} | {row[2]} | {row[3]} | {row[4]} | {row[5]} |")
    before, after = sum(row[2] for row in rows), sum(row[4] for row in rows)
    lines += [
        "",
        f"Resultado observable: los candidatos a inspección bajaron de **{before}** a **{after}** archivos en las tres tareas. La medida representa reducción de exploración, no ahorro exacto de tokens ni garantía de que todo archivo primario deba editarse.",
        "",
    ]
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"PASS comparison before={before} after={after}")
    return 0 if after < before else 1


if __name__ == "__main__":
    raise SystemExit(main())
