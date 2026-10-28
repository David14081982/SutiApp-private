"""Synthetic local Git fixtures; no network, credentials or real workbook.

All Git initialization/commits occur in newly created ignored test directories.
The application repository is never staged or committed. Fixtures are retained.
"""
import base64
import copy
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
import zipfile

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
GUARD = ROOT / 'scripts/verify-reports-jc-public-release.py'
spec = importlib.util.spec_from_file_location('public_release_guard', GUARD)
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)
BASE = ROOT / '.tmp/reports-jc'
BASE.mkdir(parents=True, exist_ok=True)
FIXTURES = Path(tempfile.mkdtemp(prefix='public-release-tests-', dir=BASE)).resolve()
assert FIXTURES.is_relative_to(BASE.resolve())
ENV = {**os.environ, 'GIT_CONFIG_GLOBAL': os.devnull, 'GIT_CONFIG_NOSYSTEM': '1', 'GIT_OPTIONAL_LOCKS': '0'}
passed = []


def command(root, *args):
    result = subprocess.run(args, cwd=root, env=ENV, capture_output=True)
    assert result.returncode == 0, (args[0], result.returncode)
    return result.stdout


def git(root, *args):
    return command(root, 'git', '-c', 'core.autocrlf=false', '-c', 'user.name=Synthetic test',
                   '-c', 'user.email=synthetic@example.invalid', *args)


def write(root, path, data):
    target = root / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data if isinstance(data, bytes) else data.encode())


def fixture(name, technical_metadata=None):
    root = FIXTURES / name
    root.mkdir()
    git(root, 'init', '-q')
    write(root, '.gitignore', '.tmp/\n/supabase/functions/reports-jc/template.mjs\n')
    write(root, 'app/allowed.js', '// baseline\n')
    staged = ['.gitignore', 'app/allowed.js']
    if technical_metadata is not None:
        write(root, guard.TECHNICAL_METADATA, json.dumps(technical_metadata))
        staged.append(guard.TECHNICAL_METADATA)
    git(root, 'add', *staged)
    git(root, 'commit', '-qm', 'Synthetic baseline')
    baseline = git(root, 'rev-parse', 'HEAD').decode().strip()
    write(root, 'app/allowed.js', '// reviewed release\n')
    manifest = {'baselineCommit': baseline, 'files': {'app/allowed.js': digest(root / 'app/allowed.js')}}
    return root, manifest


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def reject(root, manifest, expected):
    try:
        guard.verify(root, manifest)
    except guard.Rejected as error:
        assert error.code == expected, (error.code, expected)
    else:
        raise AssertionError('Expected rejection: ' + expected)


def done(name):
    passed.append(name)


def shared_strings_xml(prefixed=False, namespace='http://schemas.openxmlformats.org/spreadsheetml/2006/main'):
    qualify = lambda name: '{' + namespace + '}' + name if prefixed else name
    element = ET.Element(qualify('sst'), {} if prefixed else {'xmlns': namespace})
    ET.SubElement(ET.SubElement(element, qualify('si')), qualify('t')).text = 'SYNTHETIC ONLY'
    return ET.tostring(element, encoding='utf-8')


def scanner_tests():
    namespace = b'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
    fragments = b"const opening = '<sst'; const namespace = '" + namespace + b"';"
    guard.scan(fragments, 'scripts/synthetic-parser.js')
    guard.scan(shared_strings_xml(namespace='urn:synthetic') + fragments, 'scripts/synthetic-other-xml.js')
    for path in [GUARD, Path(__file__).resolve()]:
        guard.scan(path.read_bytes(), path.relative_to(ROOT).as_posix())
    done('source_fragments_and_guard_test_self_scan_pass')
    raw = shared_strings_xml()
    prefixed = shared_strings_xml(prefixed=True)
    embedded = b'const payload = ' + bytes([96]) + raw + bytes([96]) + b';'
    escaped = json.dumps({'payload': raw.decode()}).encode()
    for payload in [raw, prefixed, embedded, escaped]:
        try:
            guard.scan(payload, 'scripts/disguised-payload.js')
        except guard.Rejected as error:
            assert error.code == 'PRIVATE_WORKBOOK_PAYLOAD'
        else:
            raise AssertionError('Complete shared-strings XML was accepted')
    done('raw_prefixed_embedded_and_json_escaped_xml_rejected')


def metadata_tests():
    baseline = {
        'capturedAt': '2026-10-04T22:37:49.418Z', 'productionWrites': 0,
        'permissionConstraint': {'synthetic': True}, 'rolePermissions': [],
        'audienceScreens': [], 'sections': [{'section_key': 'synthetic_existing', 'module_total_only': True}],
        'functions': [{'schema': 'admin_support_private', 'name': 'module_visible',
                       'signature': 'admin_support_private.module_visible(uuid,text)',
                       'definition': 'synthetic SQL values ' + guard.VISIBILITY_ANCHOR + ';',
                       'acl': '{synthetic=EXECUTE}'},
                      {'schema': 'synthetic', 'name': 'unchanged', 'definition': 'SYNTHETIC'}],
        'policies': [], 'tables': [],
    }
    expected_section = {
        'section_key': 'admin_reportes_jc', 'display_name': 'Reportes JC',
        'data_boundary': 'Read-only Google loan/request and canonical savings case counts; authenticated template export',
        'allowed_actions': ['read', 'update'], 'enforcement_status': 'ENFORCED', 'module_key': 'reportes_jc',
        'module_read_permissions': ['program_requests.read', 'savings.read', 'savings.reports'],
        'module_write_permissions': [], 'module_sections': [], 'module_total_only': False, 'module_order': 100,
    }
    updated = copy.deepcopy(baseline)
    updated['sections'].append(expected_section)
    updated['functions'][0]['definition'] = baseline['functions'][0]['definition'].replace(
        "('sutifinanzas','program_requests.read',array[]::text[])",
        "('sutifinanzas','program_requests.read',array[]::text[]),('reportes_jc','savings.reports',array[]::text[])")
    updated['reportsJcReadbackAt'] = '2026-10-28T01:02:03.456Z'
    encode = lambda value: json.dumps(value).encode()
    guard.validate_metadata_delta(encode(baseline), encode(updated))
    done('exact_focal_metadata_delta_accepted')
    mutations = [
        lambda x: x.update(capturedAt='2026-10-28T01:02:03.456Z'),
        lambda x: x.update(productionWrites=1),
        lambda x: x['sections'][0].update(section_key='changed_other_section'),
        lambda x: x['sections'][-1].update(module_total_only=0),
        lambda x: x['sections'][-1].update(module_write_permissions=['synthetic.write']),
        lambda x: x['sections'][-1].update(module_order=99),
        lambda x: x['sections'].append(copy.deepcopy(expected_section)),
        lambda x: x['rolePermissions'].append({'permission': 'synthetic.write'}),
        lambda x: x['functions'][0].update(acl='{synthetic=ALL}'),
        lambda x: x['functions'][0].update(signature='changed_signature'),
        lambda x: x['functions'][0].update(definition=x['functions'][0]['definition'] + ' altered logic'),
        lambda x: x['functions'][1].update(definition='changed unrelated function'),
        lambda x: x['policies'].append({'synthetic': 'unrelated policy'}),
        lambda x: x.update(extra='synthetic unapproved field'),
        lambda x: x.pop('reportsJcReadbackAt'),
        lambda x: x.update(reportsJcReadbackAt='invalid'),
    ]
    for mutate in mutations:
        wrong = copy.deepcopy(updated)
        mutate(wrong)
        try:
            guard.validate_metadata_delta(encode(baseline), encode(wrong))
        except guard.Rejected as error:
            assert error.code == 'METADATA_DELTA_INVALID'
        else:
            raise AssertionError('Unrelated metadata change accepted')
    done('sixteen_unrelated_metadata_changes_rejected')
    assert all(guard.public_path(path) for path in guard.ARCHITECTURE_JSON)
    assert len(guard.ARCHITECTURE_JSON) == 6
    assert not guard.public_path('docs/architecture/unreviewed.json')
    assert not guard.public_path('docs/qa/evidence/reports-jc/real.json')
    done('only_six_architecture_json_and_one_metadata_path_allowed')
    root, manifest = fixture('technical-metadata', baseline)
    write(root, guard.TECHNICAL_METADATA, encode(updated))
    manifest['files'][guard.TECHNICAL_METADATA] = digest(root / guard.TECHNICAL_METADATA)
    assert guard.verify(root, manifest)['technicalMetadata'] == 'FOCAL_DELTA_VERIFIED_NOT_RUNTIME_PROOF'
    git(root, 'add', guard.TECHNICAL_METADATA)
    assert guard.verify(root, manifest)['status'] == 'PASS'
    wrong = copy.deepcopy(updated)
    wrong['functions'][0]['acl'] = '{synthetic=ALL}'
    write(root, guard.TECHNICAL_METADATA, encode(wrong))
    git(root, 'add', guard.TECHNICAL_METADATA)
    write(root, guard.TECHNICAL_METADATA, encode(updated))
    reject(root, manifest, 'METADATA_DELTA_INVALID')
    git(root, 'commit', '-qm', 'Synthetic unauthorized metadata')
    git(root, 'add', guard.TECHNICAL_METADATA)
    git(root, 'commit', '-qm', 'Synthetic metadata cleanup')
    reject(root, manifest, 'METADATA_DELTA_INVALID')
    done('metadata_checked_in_worktree_index_and_history')
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, 'w') as z:
        z.writestr('xl/workbook.xml', '<workbook>SYNTHETIC</workbook>')
    try:
        guard.scan(archive.getvalue(), 'docs/architecture/registry-code.json')
    except guard.Rejected as error:
        assert error.code == 'PRIVATE_WORKBOOK_PAYLOAD'
    else:
        raise AssertionError('Architecture exception bypassed workbook scanner')
    done('technical_json_retains_payload_scan')


scanner_tests()
metadata_tests()
if '--metadata-only' in sys.argv:
    receipt = {'status': 'PASS', 'scope': 'technical metadata exception only', 'tests': passed,
               'syntheticOnly': True, 'networkRequests': 0, 'realMetadataWrites': 0, 'applicationGitWrites': 0}
    (BASE / 'public-release-metadata-tests.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(receipt))
    raise SystemExit(0)


root, manifest = fixture('valid-unstaged')
before = git(root, 'status', '--porcelain=v1', '-z')
assert guard.verify(root, manifest)['status'] == 'PASS'
assert git(root, 'status', '--porcelain=v1', '-z') == before
done('valid_unstaged_and_read_only')

root, manifest = fixture('valid-staged')
git(root, 'add', 'app/allowed.js')
assert guard.verify(root, manifest)['status'] == 'PASS'
git(root, 'commit', '-qm', 'Synthetic reviewed release')
assert guard.verify(root, manifest)['newCommitsInspected'] == 1
done('valid_staged_and_committed')

for stage in (False, True):
    root, manifest = fixture('extra-' + str(stage))
    write(root, 'scripts/unreviewed.js', '// synthetic extra\n')
    if stage:
        git(root, 'add', 'scripts/unreviewed.js')
    reject(root, manifest, 'UNEXPECTED_RELEASE_PATHS')
done('extra_untracked_and_staged_rejected')

for index, private in enumerate(['docs/qa/evidence/real.json', guard.PRIVATE_TEMPLATE,
                                 'app/export.xlsx', 'scripts/annual.zip', '../escape.js']):
    root, manifest = fixture('private-path-' + str(index))
    manifest['files'][private] = '0' * 64
    reject(root, manifest, 'PRIVATE_OR_NONCODE_PATH')
done('private_paths_and_traversal_rejected_even_if_allowlisted')

root, manifest = fixture('wrong-hash')
write(root, 'app/allowed.js', '// different from review\n')
reject(root, manifest, 'WORKTREE_HASH_MISMATCH')
done('manifest_hash_enforced')

root, manifest = fixture('staged-old-content')
git(root, 'add', 'app/allowed.js')
write(root, 'app/allowed.js', '// final unstaged revision\n')
manifest['files']['app/allowed.js'] = digest(root / 'app/allowed.js')
reject(root, manifest, 'INDEX_HASH_MISMATCH')
done('index_cannot_hide_different_content')

archive_bytes = io.BytesIO()
with zipfile.ZipFile(archive_bytes, 'w') as archive:
    archive.writestr('xl/workbook.xml', '<workbook>SYNTHETIC ONLY</workbook>')
synthetic_zip = archive_bytes.getvalue()
synthetic_base64 = b'const disguised = "' + base64.b64encode(synthetic_zip + b'\0' * 512) + b'";'
for name, payload in [('renamed-xlsx', synthetic_zip), ('encoded-xlsx', synthetic_base64),
                      ('raw-xml', shared_strings_xml())]:
    root, manifest = fixture(name)
    write(root, 'app/allowed.js', payload)
    manifest['files']['app/allowed.js'] = digest(root / 'app/allowed.js')
    reject(root, manifest, 'PRIVATE_WORKBOOK_PAYLOAD')
done('renamed_encoded_and_extracted_workbook_rejected')

root, manifest = fixture('hidden-index-workbook')
write(root, 'app/allowed.js', synthetic_base64)
git(root, 'add', 'app/allowed.js')
write(root, 'app/allowed.js', '// reviewed release\n')
reject(root, manifest, 'PRIVATE_WORKBOOK_PAYLOAD')
done('staged_payload_rejected_after_worktree_cleanup')

root, manifest = fixture('history-payload')
write(root, 'app/allowed.js', synthetic_base64)
git(root, 'add', 'app/allowed.js')
git(root, 'commit', '-qm', 'Synthetic forbidden intermediate payload')
write(root, 'app/allowed.js', '// reviewed release\n')
git(root, 'add', 'app/allowed.js')
git(root, 'commit', '-qm', 'Synthetic cleanup')
reject(root, manifest, 'PRIVATE_WORKBOOK_PAYLOAD')
done('intermediate_commit_payload_rejected')

root, manifest = fixture('tracked-template')
write(root, guard.PRIVATE_TEMPLATE, '// synthetic, no real workbook\n')
git(root, 'add', '-f', guard.PRIVATE_TEMPLATE)
reject(root, manifest, 'PRIVATE_TEMPLATE_TRACKED')
done('forced_private_template_tracking_rejected')

generator = str(ROOT / 'scripts/build-reports-jc-template.js')
node_test = "const {assertPrivateTarget}=require(process.argv[1]);try{assertPrivateTarget(process.argv[2],require('path').join(process.argv[2],'supabase/functions/reports-jc/template.mjs'));console.log('PASS');}catch(e){console.log(e.message);process.exitCode=1;}"
for scenario, expected in [('ignored', 'PASS'), ('not-ignored', 'PRIVATE_TEMPLATE_NOT_IGNORED'), ('tracked', 'PRIVATE_TEMPLATE_TRACKED')]:
    root, manifest = fixture('generator-' + scenario)
    if scenario == 'not-ignored':
        write(root, '.gitignore', '.tmp/\n')
    if scenario == 'tracked':
        write(root, guard.PRIVATE_TEMPLATE, '// synthetic only\n')
        git(root, 'add', '-f', guard.PRIVATE_TEMPLATE)
    result = subprocess.run(['node', '-e', node_test, generator, str(root)], env=ENV, capture_output=True, text=True)
    assert result.stdout.strip() == expected, (scenario, result.stdout.strip())
    assert result.returncode == (0 if scenario == 'ignored' else 1)
done('generator_requires_effective_ignore_and_untracked_target')

root, manifest = fixture('cli')
manifest_file = FIXTURES / 'manifest.json'
manifest_file.write_text(json.dumps(manifest), encoding='utf-8')
result = command(root, sys.executable, str(GUARD), '--root', str(root), '--manifest', str(manifest_file))
assert json.loads(result)['status'] == 'PASS'
manifest['files']['app/allowed.js'] = '0' * 64
manifest_file.write_text(json.dumps(manifest), encoding='utf-8')
result = subprocess.run([sys.executable, str(GUARD), '--root', str(root), '--manifest', str(manifest_file)], env=ENV, capture_output=True)
assert result.returncode == 1 and json.loads(result.stdout)['code'] == 'WORKTREE_HASH_MISMATCH'
done('cli_machine_readable_pass_and_fail')

receipt = {'status': 'PASS', 'tests': passed, 'syntheticOnly': True, 'networkRequests': 0,
           'realCredentialReads': 0, 'realWorkbookReads': 0, 'applicationGitWrites': 0,
           'fixtureDirectory': FIXTURES.relative_to(ROOT).as_posix()}
(BASE / 'public-release-guard-tests.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
print(json.dumps(receipt))
