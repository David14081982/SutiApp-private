"""Update only the cash-flow index in the isolated published checkout.

Facts and overrides always start at the published Git commit, never at the
shared workspace registry. No product service, credentials or financial rows
are read. Run after prepare-cash-flow-source-release.js has assembled its exact
manifest. Global freshness may remain stale in the intentionally sparse tree.
"""
import copy
import contextlib
import hashlib
import io
import json
import shutil
import subprocess
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / '.tmp/reports-jc/membership-counts/release'
BASE = 'a4a7f8a5fc317c6bb879ff130e2287a4c3cb89ae'
SCOPE = 'H-CASH-FLOW-PV2-SOURCE-20261104'
MANIFEST = ROOT / '.tmp/cash-flow-source-20261104/release-manifest.json'
ARCH = 'docs/architecture/'
FILES = ['SUTIAPP_ARCHITECTURE_REGISTRY.json', 'registry-code.json',
         'registry-data.json', 'registry-edges.json', 'registry-search.json',
         'architecture-overrides.json']

def digest(data):
    return hashlib.sha256(data).hexdigest()

def git(*args):
    return subprocess.check_output(['git', '-C', str(TARGET), *args])

def baseline(file):
    return git('show', BASE + ':' + file)

def main():
    assert git('rev-parse', 'HEAD').decode().strip() == BASE, 'PUBLISHED_BASE_DRIFT'
    manifest = json.loads(MANIFEST.read_text('utf8'))
    assert manifest['status'] == 'PASS' and manifest['baseCommit'] == BASE
    assert Path(manifest['target']).resolve() == TARGET.resolve()
    root_hashes = {f: digest((ROOT / ARCH / f).read_bytes()) for f in FILES if (ROOT / ARCH / f).exists()}
    generator = baseline('scripts/generate-architecture-registry.py').decode('utf8')
    m = types.ModuleType('published_cash_flow_registry')
    m.__file__ = str(TARGET / 'scripts/generate-architecture-registry.py')
    exec(compile(generator, m.__file__, 'exec'), m.__dict__)
    published_read_text = m.read_text
    baseline_read_paths = set()
    baseline_contents = {}
    def sparse_read_text(path):
        if Path(path).exists():
            return published_read_text(path)
        relative = Path(path).relative_to(TARGET).as_posix()
        # The published builder rereads test literals to form TESTS edges.
        # Missing sparse files remain the exact baseline sources, not empty
        # placeholders or the unrelated shared workspace versions.
        baseline_read_paths.add(relative)
        if relative in baseline_contents:
            return baseline_contents[relative]
        return baseline(relative).decode('utf8', errors='replace')
    m.read_text = sparse_read_text
    old_main = json.loads(baseline(ARCH + FILES[0]))
    code = json.loads(baseline(ARCH + FILES[1]))
    data = json.loads(baseline(ARCH + FILES[2]))
    original = json.loads(baseline(ARCH + 'architecture-overrides.json'))
    overrides = copy.deepcopy(original)
    facts = {**code['facts'], **data['facts']}
    absent_tests = sorted(f for f in facts if f.startswith('scripts/test-') and not (TARGET / f).exists())
    if absent_tests:
        queries = ''.join(BASE + ':' + f + '\n' for f in absent_tests).encode()
        blobs = subprocess.check_output(['git', '-C', str(TARGET), 'cat-file', '--batch'], input=queries)
        offset = 0
        for file in absent_tests:
            end = blobs.index(b'\n', offset)
            header = blobs[offset:end].split()
            assert len(header) == 3 and header[1] == b'blob', 'BASELINE_SOURCE_MISSING:' + file
            length = int(header[2]); start = end + 1
            baseline_contents[file] = blobs[start:start + length].decode('utf8', errors='replace')
            offset = start + length + 1
            assert blobs[offset - 1:offset] == b'\n'
        assert offset == len(blobs)
    fps = dict(old_main['freshness']['tracked_files'])
    new_services = [
        ('CashFlowOriginalLoanProjection', 'cash-flow-loans.mjs', ['Proyecciones HISTORIAL P V2', 'Desglose original cuotas'],
         {'authority': 'Google SutiApp Final original A/B/C and Z/AB/AC/AD; request authorization and placement date',
          'rule': 'A <= Hermosillo cutoff is paid; later A scheduled; one authorized capital per C; AE excluded; no inferred interest or administration',
          'evidence': 'scripts/test-cash-flow-pv2-source.mjs'}),
        ('CashFlowSavingsSourceProjection', 'cash-flow-savings.mjs', ['Base Ahorro flujo', 'Puente saldo ahorro'],
         {'authority': 'Official Supabase savings values; original mixed and opening amounts stay identifiable',
          'rule': 'Reconcile displayed stock to recorded flows without creating a savings transaction or cash receipt',
          'evidence': 'scripts/test-cash-flow-savings-sources-sql.js'}),
        ('CashFlowInvestorContinuity', 'cash-flow-investor-continuity.mjs', ['Continuidad contratos inversores', 'Renovacion inversion'],
         {'authority': 'Supabase investors original contract identity, sequence, renewal references and dated movements',
          'rule': 'Each transferred principal appears once; explicit merges retain every predecessor; new cash only from registered contributions',
          'evidence': 'scripts/test-cash-flow-investor-continuity.mjs'}),
        ('CashFlowSourceBases', 'cash-flow-source-bases.mjs', ['Bases flujo mensual Excel', 'Respaldo valores flujo'],
         {'authority': 'Derived readable rows from the same authorized in-memory report response',
          'rule': 'Spanish field labels, source references, originals separated from calculations; no opaque JSON as financial explanation',
          'evidence': 'scripts/test-cash-flow-source-bases.mjs'}),
        ('CashFlowInputTransport', 'cash-flow-inputs.mjs', ['Fuentes autorizadas flujo', 'Cash flow source snapshot'],
         {'authority': 'Allowlisted originals read by the existing authenticated Edge and RPCs',
          'rule': 'Versioned disposable snapshot; original row ordinals preserved; no AE, credentials, opaque source payload or financial writes',
          'evidence': 'scripts/test-cash-flow-inputs.mjs'}),
        ('CashFlowSnapshotProjection', 'cash-flow.mjs', ['Proyeccion unica flujo', 'projectCashFlowSnapshot'],
         {'authority': 'Single pure entry point for the authorized original snapshot',
          'rule': 'The browser Worker is generated from this exact entry and original helper dependencies; screen and Excel use one result; cutoff originates in backend',
          'evidence': 'scripts/test-cash-flow-projection-worker.js'})
    ]
    artifact_services = [
        ('CashFlowProjectionWorker', 'app/cash-flow-projection-worker.js', ['Worker flujo de efectivo', 'Calculo local flujo'],
         {'classification': 'GENERATED_ARTIFACT',
          'authority': 'Disposable derived report from an authenticated allowlisted source snapshot',
          'boundary': 'No network, credentials, storage, dynamic imports or source writes; worker closed after each projection',
          'implementation': 'AST-selected original module declarations; no second financial implementation',
          'evidence': 'scripts/test-cash-flow-projection-worker.js'}),
        ('CashFlowProjectionWorkerBuild', 'scripts/build-cash-flow-projection-worker.js', ['Compilacion Worker flujo'],
         {'classification': 'BUILD_TOOL',
          'selection': 'AST bindings reachable from projectCashFlowSnapshot; report.mjs restricted to sourceDate/fundGroup/requestStatus/ReportError',
          'validation': 'Deterministic output and source hashes; privileged code and unapproved globals rejected',
          'evidence': 'scripts/test-cash-flow-projection-worker.js'})
    ]
    service_nodes = [(name, 'supabase/functions/reports-jc/' + file, aliases, properties)
                     for name, file, aliases, properties in new_services] + artifact_services
    for name, file, aliases, properties in service_nodes:
        assert not any(n['name'] == name and n['type'] == 'service' for n in overrides['nodes'])
        overrides['nodes'].append({'type': 'service', 'name': name,
            'file': file, 'domain': 'finance',
            'aliases': aliases, 'source_of_truth': 'DERIVED',
            'properties': {**properties, 'financial_writes': 0, 'status': 'IMPLEMENTED', 'deployment_status': 'NOT_ASSERTED_BY_CODE_INDEX'}})
    for n in overrides['nodes']:
        if n['name'] == 'CashFlowReportModule' and n['type'] == 'admin_screen':
            n['aliases'] = list(dict.fromkeys(n.get('aliases', []) + ['Flujo de efectivo', 'Flujo mensual']))
            n['properties'].update({'source_basis': 'Original PV2 A/B/C/Z/AB/AC/AD; read-only Supabase savings and investor originals',
                'capital': 'One capital placement per authorized loan ID; request date; no transfer AE dependency',
                'support': 'Readable source sheets from one derived result shared by screen and Excel',
                'execution': 'Authorized Edge returns source snapshot; disposable local Worker executes the same pure projection',
                'invalidation': 'Context and request sequence checked before/after projection; terminate on context, period or screen change; no persisted financial cache'})
        if n['name'] == 'reports-jc' and n['type'] == 'edge_function':
            n['properties'].update({'cash_flow_execution': 'CASH_FLOW branch validates context before/after original reads and returns allowlisted source snapshot; no report CPU-heavy projection in production Edge',
                'cash_flow_inputs': 'cash-flow-inputs-v1; 20261104-original-components-v1; consultedAt from backend',
                'cash_flow_writes': 0, 'cash_flow_deployment_status': 'NOT_ASSERTED_BY_CODE_INDEX'})
        if n['name'] == 'CashFlowContractualQueryEngine' and n['type'] == 'service':
            n['properties']['status'] = 'RETAINED_NOT_USED_BY_CURRENT_CASH_FLOW'
            n['properties']['replacement'] = 'CashFlowOriginalLoanProjection reads original Z/AB/AC/AD; old engine is not called by current flow'
    removed_relations = [r for r in overrides['relationships'] if
        (r.get('from') == 'supabase/functions/reports-jc/cash-flow-consolidated.mjs' and r.get('to') == 'CashFlowContractualQueryEngine') or
        (r.get('from') in ['reports-jc', 'supabase/functions/reports-jc/cash-flow.mjs'] and r.get('to') == 'public.get_admin_reports_jc_cash_flow_contracts')]
    overrides['relationships'] = [r for r in overrides['relationships'] if r not in removed_relations]
    def relationship(frm, ft, to, tt, kind='USES'):
        r = {'from': frm, 'from_type': ft, 'to': to, 'to_type': tt, 'type': kind}
        if r not in overrides['relationships']:
            overrides['relationships'].append(r)
    for service in ['CashFlowSavingsSourceProjection', 'CashFlowSourceBases']:
        relationship('supabase/functions/reports-jc/cash-flow.mjs', 'file', service, 'service')
    relationship('supabase/functions/reports-jc/cash-flow-consolidated.mjs', 'file', 'CashFlowOriginalLoanProjection', 'service')
    relationship('supabase/functions/reports-jc/cash-flow-investors.mjs', 'file', 'CashFlowInvestorContinuity', 'service')
    relationship('CashFlowOriginalLoanProjection', 'service', 'Google SutiApp Final Reportes JC', 'external_legacy_source', 'READS')
    relationship('CashFlowSavingsSourceProjection', 'service', 'public.get_admin_reports_jc_cash_flow', 'rpc', 'READS_VIA_RPC')
    relationship('CashFlowInvestorContinuity', 'service', 'public.get_admin_reports_jc_cash_flow_investors', 'rpc', 'READS_VIA_RPC')
    relationship('SutiCashFlowExport', 'service', 'CashFlowSourceBases', 'service')
    relationship('reports-jc', 'edge_function', 'CashFlowInputTransport', 'service')
    relationship('CashFlowReportModule', 'admin_screen', 'CashFlowProjectionWorker', 'service')
    relationship('CashFlowProjectionWorker', 'service', 'CashFlowSnapshotProjection', 'service')
    relationship('CashFlowProjectionWorkerBuild', 'service', 'CashFlowProjectionWorker', 'service', 'GENERATES')
    relationship('CashFlowProjectionWorkerBuild', 'service', 'CashFlowSnapshotProjection', 'service', 'READS')
    for service in ['CashFlowOriginalLoanProjection', 'CashFlowSavingsSourceProjection', 'CashFlowInvestorContinuity', 'CashFlowSourceBases']:
        relationship('CashFlowSnapshotProjection', 'service', service, 'service')
    relationship('scripts/build-pages-site.js', 'file', 'CashFlowProjectionWorker', 'service')
    readers = [
        ('public.get_admin_reports_jc_cash_flow', '20261104000100_reports_jc_cash_flow_sources.sql',
         'Read-only enriched savings source rows, dates, identities and balance provenance; original financial rows unchanged'),
        ('public.get_admin_reports_jc_cash_flow_investors', '20261104000200_reports_jc_investor_sources.sql',
         'Read-only investor name, source row, original contract, recorded withdrawal/payment fields; balances derived in report with continuity')
    ]
    for name, file, description in readers:
        n = next((n for n in overrides['nodes'] if n['type'] == 'rpc' and n['name'] == name), None)
        if n is None:
            n = {'type': 'rpc', 'name': name, 'domain': 'finance', 'properties': {}}
            overrides['nodes'].append(n)
        n['file'] = 'supabase/migrations/' + file
        n.setdefault('properties', {}).update({'report_projection': description, 'authorization': 'Existing get_admin_reports_jc_context; ACL and SECURITY DEFINER scope preserved',
            'financial_writes': 0, 'status': 'IMPLEMENTED', 'deployment_status': 'NOT_ASSERTED_BY_CODE_INDEX'})
    timeout_file = 'supabase/migrations/20261104000300_reports_jc_cash_flow_timeout.sql'
    timeout_reader = next(n for n in overrides['nodes'] if n['type'] == 'rpc' and n['name'] == 'public.get_admin_reports_jc_cash_flow')
    timeout_reader['properties'].update({
        'statement_timeout': '30s; only this existing report reader function',
        'timeout_configuration_file': timeout_file,
        'timeout_boundary': 'Function body, OID, owner, ACL, STABLE, SECURITY DEFINER and search_path unchanged; no role/global timeout change',
        'timeout_recovery': 'supabase/recovery/20261104000300_reports_jc_cash_flow_timeout.sql; exact prior definition; apply recovery before reader 001 recovery',
        'timeout_evidence': 'scripts/test-cash-flow-timeout-sql.js'
    })
    relationship(timeout_file, 'file', 'public.get_admin_reports_jc_cash_flow', 'rpc', 'USES')
    changed = []
    trackable = {m.rel(path) for path in m.tracked_files()}
    for file, expected in manifest['candidateHashes'].items():
        path = TARGET / file
        assert path.is_file() and digest(path.read_bytes()) == expected, 'CANDIDATE_DRIFT:' + file
        if file in trackable and not file.startswith('supabase/recovery/') and file != 'app/bundle.js':
            changed.append(file)
    required = [item[1] for item in service_nodes] + ['supabase/migrations/' + item[1] for item in readers] + [timeout_file]
    assert all(f in changed for f in required), 'CANDIDATE_SOURCE_MISSING'
    override_file = ARCH + 'architecture-overrides.json'
    changed.append(override_file)
    preserved = {f: digest(json.dumps(v, sort_keys=True).encode()) for f, v in facts.items() if f not in changed}
    override_bytes = (json.dumps(overrides, ensure_ascii=False, indent=2) + '\n').encode()
    assert shutil.disk_usage(TARGET).free > 40 * 1024 * 1024, 'INSUFFICIENT_REGISTRY_SPACE'
    m.OVERRIDES.parent.mkdir(parents=True, exist_ok=True)
    m.OVERRIDES.write_bytes(override_bytes)
    for file in changed:
        facts[file] = m.analyze_file(TARGET / file, overrides)
        if file != override_file:
            facts[file]['domain'] = 'finance'
        fps[file] = digest((TARGET / file).read_bytes())
    assert all(digest(json.dumps(facts[f], sort_keys=True).encode()) == expected for f, expected in preserved.items())
    built = m.build_registry(facts, fps, overrides)
    built[0]['freshness'].update({'status': 'STALE', 'scope': SCOPE, 'scope_status': 'FRESH', 'scope_files': sorted(changed),
        'note': 'Exact candidate scope refreshed from published baseline. Unrelated baseline facts preserved; sparse checkout and old unrelated freshness are not declared globally fresh.'})
    m.save_registry(*built)
    assert root_hashes == {f: digest((ROOT / ARCH / f).read_bytes()) for f in root_hashes}, 'ROOT_REGISTRY_CHANGED'
    actual_changed, added, removed, current = m.current_changes(built[0])
    assert not set(changed).intersection(actual_changed + removed), 'FOCAL_REGISTRY_STALE'
    # Run the published Navigator freshness function itself. Its global result
    # stays honest in the sparse checkout; only the manifest scope is current.
    freshness_output = io.StringIO()
    with contextlib.redirect_stdout(freshness_output):
        freshness_exit = m.freshness(json_output=True)
    freshness_result = json.loads(freshness_output.getvalue())
    assert freshness_exit in (0, 2), 'NAVIGATOR_FRESHNESS_FAILED'
    assert freshness_result['changed'] == actual_changed
    assert freshness_result['added'] == added
    assert freshness_result['removed'] == removed
    checks = []
    for name, file, _, _ in service_nodes:
        result = m.lookup(name)
        assert any(n['name'] == name for n in result['nodes']), 'LOOKUP_MISSING:' + name
        assert file in result['primary_files'], 'LOOKUP_FILE_MISSING:' + name
        checks.append(name)
    lookup = m.lookup('Reporte Flujo de efectivo')
    assert 'app/cash-flow-report.jsx' in lookup['primary_files']
    evidence = {'status': 'PASS', 'scope': SCOPE, 'baseCommit': BASE, 'target': str(TARGET),
        'scopeFreshness': 'FRESH', 'globalFreshness': 'STALE' if actual_changed or added or removed else 'FRESH',
        'navigatorFreshness': {'exitCode': freshness_exit, 'status': freshness_result['status'],
            'implementation': 'Published generate-architecture-registry.py freshness(json_output=True)'},
        'globalChangeCounts': {'changed': len(actual_changed), 'added': len(added), 'removed': len(removed)},
        'scopeFiles': sorted(changed), 'scopeHashes': {f: fps[f] for f in changed},
        'unrelatedFactsPreserved': len(preserved), 'rootRegistryTouched': False,
        'sparseBaselineReads': sorted(baseline_read_paths),
        'newServices': checks, 'retiredRuntimeRelationships': removed_relations,
        'lookupPrimaryFiles': lookup['primary_files'], 'financialWrites': 0, 'productionWrites': 0,
        'outputs': {ARCH + f: digest((TARGET / ARCH / f).read_bytes()) for f in FILES}}
    out = ROOT / 'docs/qa/evidence/cash-flow-source-20261104/registry-manifest.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n', encoding='utf8', newline='\n')
    print(json.dumps({k: v for k, v in evidence.items() if k not in ['scopeHashes', 'outputs', 'scopeFiles', 'sparseBaselineReads']}, ensure_ascii=True))

if __name__ == '__main__':
    main()
