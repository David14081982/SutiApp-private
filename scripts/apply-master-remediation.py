#!/usr/bin/env python3
"""Fail-closed tombstone for the rejected master-remediation runner.

The former version applied 20260823000200 directly through the Management API.
That migration is rejected because it collapses operation-specific authority into
``*.write`` and its recovery is not equivalent.  Keep this filename so stale
operator instructions cannot silently execute the unsafe path.
"""
import json


REJECTED_MIGRATION = '20260823000200_section_ownership_and_public_reads.sql'


def main():
    print(json.dumps({
        'status': 'BLOCKED',
        'classification': 'FORBIDDEN_AS_IS',
        'migration': REJECTED_MIGRATION,
        'writes_attempted': 0,
        'reason': 'Granular section/action authorization and equivalent recovery are absent.',
    }, sort_keys=True))
    raise SystemExit(2)


if __name__ == '__main__':
    main()
