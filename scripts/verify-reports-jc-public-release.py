"""Read-only gate for an isolated public Reportes JC release checkout.

Manifest: {"baselineCommit": "<40 hex>", "files": {"relative/path": "<sha256>"}}.
The reviewed manifest must be kept outside the public checkout. No credentials,
network, Git mutations, original workbook access or automatic deletion is used.
"""
import argparse
import base64
import copy
from datetime import datetime
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import xml.etree.ElementTree as ET
import zipfile

ORIGINAL_SHA = 'da8c9785b4f4a62bc087403a06492766cf8dae59e2d239589396a31f842e32eb'
PRIVATE_TEMPLATE = 'supabase/functions/reports-jc/template.mjs'
CODE_SUFFIXES = {'.js', '.mjs', '.jsx', '.ts', '.tsx', '.py', '.sql', '.css', '.html', '.json', '.yml', '.yaml'}
ROOT_FILES = {'.gitignore', 'SutiApp.html', 'sw.js', 'manifest.json'}
CODE_ROOTS = ('app/', 'scripts/', 'supabase/functions/reports-jc/', 'supabase/migrations/', 'supabase/recovery/')
TECHNICAL_METADATA = 'docs/qa/evidence/screen-permissions-20260924/production-metadata.json'
ARCHITECTURE_JSON = {f'docs/architecture/{name}' for name in (
    'architecture-overrides.json', 'SUTIAPP_ARCHITECTURE_REGISTRY.json',
    'registry-code.json', 'registry-data.json', 'registry-edges.json', 'registry-search.json')}
VISIBILITY_ANCHOR = "('sutifinanzas','program_requests.read',array[]::text[])"
VISIBILITY_ADDITION = ",('reportes_jc','savings.reports',array[]::text[])"
JC_SECTION = {
    'section_key': 'admin_reportes_jc', 'display_name': 'Reportes JC',
    'data_boundary': 'Read-only Google loan/request and canonical savings case counts; authenticated template export',
    'allowed_actions': ['read', 'update'], 'enforcement_status': 'ENFORCED',
    'module_key': 'reportes_jc',
    'module_read_permissions': ['program_requests.read', 'savings.read', 'savings.reports'],
    'module_write_permissions': [], 'module_sections': [], 'module_total_only': False,
    'module_order': 100,
}


class Rejected(Exception):
    def __init__(self, code, paths=()):
        super().__init__(code)
        self.code, self.paths = code, sorted(set(paths))


def git(root, *args):
    result = subprocess.run(['git', '-c', 'core.fsmonitor=false', *args], cwd=root,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            env={**os.environ, 'GIT_OPTIONAL_LOCKS': '0'})
    if result.returncode:
        raise Rejected('GIT_READ_FAILED')
    return result.stdout


def names(raw):
    return {value.decode('utf-8') for value in raw.split(b'\0') if value}


def public_path(value):
    if not isinstance(value, str) or not value or '\\' in value or ':' in value or '\0' in value:
        return False
    path = PurePosixPath(value)
    if path.is_absolute() or any(part in ('', '.', '..') for part in value.split('/')):
        return False
    lower = value.lower()
    if lower == PRIVATE_TEMPLATE or any(part.startswith('.') for part in path.parts) and value != '.gitignore':
        return False
    if value == TECHNICAL_METADATA or value in ARCHITECTURE_JSON:
        return True
    if not (value in ROOT_FILES or value.startswith(CODE_ROOTS)):
        return False
    if re.search(r'(^|/)(exports?|backups?|uploads?|secrets?)(/|$)', lower):
        return False
    if re.search(r'credentials?|service[-_]account|client_secret', path.name, re.I):
        return False
    return value in ROOT_FILES or path.suffix.lower() in CODE_SUFFIXES or path.name in ('LICENSE', 'LICENSE.md', 'LICENSE.markdown')


def workbook_payload(data):
    if hashlib.sha256(data).hexdigest() == ORIGINAL_SHA:
        return True
    if data.startswith(b'PK\x03\x04'):
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                paths = archive.namelist()
                if 'xl/workbook.xml' in paths or any(p.lower().endswith(('.xlsx', '.xls', '.csv')) for p in paths):
                    return True
        except (OSError, zipfile.BadZipFile):
            return True
    # Long base64 literals are inspected in memory. This catches renamed copies
    # of the module without banning harmless TEMPLATE_BASE64 imports/generators.
    for candidate in re.findall(rb'[A-Za-z0-9+/]{512,}={0,2}', data):
        try:
            decoded = base64.b64decode(candidate, validate=True)
        except (ValueError, base64.binascii.Error):
            continue
        if decoded.startswith(b'PK\x03\x04') and workbook_payload(decoded):
            return True
    # Require a complete, namespace-qualified shared-strings element. Parser
    # source can legitimately mention a tag fragment and namespace separately.
    # Also inspect XML literals escaped inside a JSON/JavaScript string.
    xml = data.replace(b'\\"', b'"').replace(b"\\'", b"'").replace(b'\\/', b'/')
    elements = rb'<(?P<tag>(?:[A-Za-z_][\w.-]*:)?sst)(?=[\s/>])[^>]*?(?:/>|>[\s\S]*?</(?P=tag)\s*>)'
    for match in re.finditer(elements, xml):
        try:
            element = ET.fromstring(match.group(0))
        except ET.ParseError:
            continue
        if element.tag == '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sst':
            return True
    return False


def scan(data, path):
    if workbook_payload(data):
        raise Rejected('PRIVATE_WORKBOOK_PAYLOAD', [path])
    if re.search(rb'-----BEGIN (?:RSA |EC )?PRIVATE KEY-----', data):
        # A declaration/validation string is public code; actual PEM key blocks
        # contain base64 material between both delimiters.
        if re.search(rb'-----BEGIN (?:RSA |EC )?PRIVATE KEY-----\s+[A-Za-z0-9+/=\s]{128,}-----END', data):
            raise Rejected('PRIVATE_KEY_PAYLOAD', [path])


def validate_metadata_delta(before_bytes, after_bytes):
    """Validate a future focal readback; this is not proof of live installation.

Preserve the general snapshot capturedAt and every other object/ACL/signature.
Only append the migrated section, insert its visibility tuple and record a
separate UTC reportsJcReadbackAt timestamp after the actual readback.
"""
    try:
        before = json.loads(before_bytes)
        after = json.loads(after_bytes)
        if not isinstance(before, dict) or not isinstance(after, dict) or 'reportsJcReadbackAt' in before:
            raise ValueError()
        timestamp = after.get('reportsJcReadbackAt')
        if not isinstance(timestamp, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z', timestamp):
            raise ValueError()
        datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        expected = copy.deepcopy(before)
        if any(row.get('section_key') == 'admin_reportes_jc' or row.get('module_key') == 'reportes_jc' for row in expected['sections']):
            raise ValueError()
        expected['sections'].append(copy.deepcopy(JC_SECTION))
        functions = [row for row in expected['functions'] if row.get('schema') == 'admin_support_private' and row.get('name') == 'module_visible']
        if len(functions) != 1:
            raise ValueError()
        definition = functions[0]['definition']
        if not isinstance(definition, str) or definition.count(VISIBILITY_ANCHOR) != 1 or VISIBILITY_ADDITION in definition:
            raise ValueError()
        functions[0]['definition'] = definition.replace(VISIBILITY_ANCHOR, VISIBILITY_ANCHOR + VISIBILITY_ADDITION, 1)
        expected['reportsJcReadbackAt'] = timestamp
        # JSON canonical comparison is type-strict (false is not numeric zero).
        canonical = lambda value: json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':'), allow_nan=False)
        if canonical(after) != canonical(expected):
            raise ValueError()
    except (ValueError, TypeError, KeyError, AttributeError):
        raise Rejected('METADATA_DELTA_INVALID', [TECHNICAL_METADATA]) from None


def verify(root, manifest):
    root = Path(root).resolve()
    if Path(git(root, 'rev-parse', '--show-toplevel').decode().strip()).resolve() != root:
        raise Rejected('ISOLATED_CHECKOUT_ROOT_REQUIRED')
    baseline, files = manifest.get('baselineCommit'), manifest.get('files')
    if not isinstance(baseline, str) or not re.fullmatch(r'[0-9a-f]{40}', baseline) or not isinstance(files, dict) or not files:
        raise Rejected('MANIFEST_INVALID')
    if any(not public_path(path) for path in files):
        raise Rejected('PRIVATE_OR_NONCODE_PATH', [p for p in files if not public_path(p)])
    if any(not isinstance(value, str) or not re.fullmatch(r'[0-9a-f]{64}', value) for value in files.values()):
        raise Rejected('MANIFEST_HASH_INVALID')
    if git(root, 'rev-parse', baseline + '^{commit}').decode().strip() != baseline:
        raise Rejected('BASELINE_COMMIT_INVALID')
    git(root, 'merge-base', '--is-ancestor', baseline, 'HEAD')
    if git(root, 'ls-files', '--', PRIVATE_TEMPLATE).strip():
        raise Rejected('PRIVATE_TEMPLATE_TRACKED', [PRIVATE_TEMPLATE])
    changed = names(git(root, 'diff', '--name-only', '--no-renames', '-z', baseline, '--'))
    indexed = names(git(root, 'diff', '--cached', '--name-only', '--no-renames', '-z', baseline, '--'))
    untracked = names(git(root, 'ls-files', '--others', '--exclude-standard', '-z'))
    all_changes = changed | indexed | untracked
    commits = git(root, 'rev-list', baseline + '..HEAD').decode().split()
    commit_paths = {}
    for commit in commits:
        commit_paths[commit] = names(git(root, 'diff', '--name-only', '--no-renames', '-z', baseline, commit, '--'))
        all_changes |= commit_paths[commit]
    if all_changes - files.keys():
        raise Rejected('UNEXPECTED_RELEASE_PATHS', all_changes - files.keys())
    metadata_baseline = None
    if TECHNICAL_METADATA in files:
        try:
            metadata_baseline = git(root, 'show', baseline + ':' + TECHNICAL_METADATA)
        except Rejected:
            raise Rejected('METADATA_BASELINE_REQUIRED', [TECHNICAL_METADATA]) from None

    def inspect_blob(data, path):
        scan(data, path)
        if path == TECHNICAL_METADATA:
            validate_metadata_delta(metadata_baseline, data)

    for path, expected in files.items():
        target = root / path
        if target.is_symlink() or not target.is_file() or not target.resolve().is_relative_to(root):
            raise Rejected('REGULAR_LOCAL_FILE_REQUIRED', [path])
        data = target.read_bytes()
        inspect_blob(data, path)
        if hashlib.sha256(data).hexdigest() != expected:
            raise Rejected('WORKTREE_HASH_MISMATCH', [path])
        if path in indexed:
            entry = git(root, 'ls-files', '--stage', '-z', '--', path).split(b'\0')
            if len(entry) != 2 or not entry[0].startswith((b'100644 ', b'100755 ')):
                raise Rejected('REGULAR_INDEX_BLOB_REQUIRED', [path])
            mode, blob, stage = entry[0].split(b'\t', 1)[0].split()
            if stage != b'0':
                raise Rejected('UNMERGED_INDEX', [path])
            staged = git(root, 'cat-file', 'blob', blob.decode())
            inspect_blob(staged, path)
            if hashlib.sha256(staged).hexdigest() != expected:
                raise Rejected('INDEX_HASH_MISMATCH', [path])
    # A file added and removed in local release commits still exists in public
    # Git history. Inspect every new commit, not only the final working tree.
    for commit, paths in commit_paths.items():
        for path in paths:
            entry = git(root, 'ls-tree', '-z', commit, '--', path)
            if not entry:
                continue
            mode, kind, blob = entry.split(b'\t', 1)[0].split()
            if mode not in (b'100644', b'100755') or kind != b'blob':
                raise Rejected('REGULAR_COMMIT_BLOB_REQUIRED', [path])
            inspect_blob(git(root, 'cat-file', 'blob', blob.decode()), path)
    return {'status': 'PASS', 'baselineCommit': baseline, 'manifestFiles': len(files),
            'changedPaths': sorted(all_changes), 'newCommitsInspected': len(commits),
            'privateWorkbookIncluded': False, 'mutations': 0, 'networkRequests': 0,
            'technicalMetadata': 'FOCAL_DELTA_VERIFIED_NOT_RUNTIME_PROOF' if metadata_baseline is not None else 'NOT_INCLUDED'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', required=True)
    parser.add_argument('--manifest', required=True)
    args = parser.parse_args()
    try:
        manifest = json.loads(Path(args.manifest).read_text(encoding='utf-8-sig'))
        if not isinstance(manifest, dict):
            raise Rejected('MANIFEST_INVALID')
        result = verify(args.root, manifest)
    except Rejected as error:
        result = {'status': 'FAIL', 'code': error.code, 'paths': error.paths, 'mutations': 0}
    except (OSError, ValueError, UnicodeError):
        result = {'status': 'FAIL', 'code': 'RELEASE_INSPECTION_FAILED', 'mutations': 0}
    print(json.dumps(result, ensure_ascii=True))
    return 0 if result['status'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
