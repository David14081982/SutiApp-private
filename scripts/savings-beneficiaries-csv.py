"""Private, deterministic CSV migration plan; no runtime CSV dependency."""
import csv
import hashlib
import io
import json
import os
from collections import defaultdict, Counter
from decimal import Decimal, InvalidOperation
from pathlib import Path

EXPECTED_SHA = '180cfe246a816b583b06c0420c7c4f0c412b8d32055f7916e15ef0ff90eefed2'
PRIVATE = Path('.tmp/beneficiaries-20260918')

def plan(content, inventory):
    reader = csv.DictReader(io.StringIO(content.decode('utf-8-sig'), newline=''))
    assert reader.fieldnames == ['Folio','Email','Nombre Agremiado','Firma','Nombre del beneficiario','Porcentaje'], 'CSV_COLUMNS_CHANGED'
    groups = defaultdict(list)
    for ordinal, row in enumerate(reader, 2):
        assert None not in row and all(v is not None for v in row.values()), 'CSV_ROW_INVALID'
        groups[row['Folio']].append({'source_row': ordinal, 'raw_record': row})
    result=[]
    for control, rows in groups.items():
        affiliates=[a for a in inventory['affiliates'] if a['control']==control]
        participants=[p for p in inventory['participants'] if p['control']==control]
        reason='VALID'; participant=None
        if not control.strip(): reason='MISSING_CONTROL'
        elif len(affiliates)!=1: reason='AFFILIATE_MATCH_'+str(len(affiliates))
        elif affiliates[0]['archived']: reason='ARCHIVED'
        elif len(participants)!=1 or participants[0]['affiliate_id']!=affiliates[0]['id'] or participants[0]['identity']!='RESOLVED': reason='PARTICIPANT_UNRESOLVED'
        else:
            participant=participants[0]['id']
            try:
                percentages=[Decimal(r['raw_record']['Porcentaje']) for r in rows]
                if any(not v.is_finite() or v<=0 or v!=v.quantize(Decimal('.01')) for v in percentages): reason='PERCENTAGE_INVALID'
                elif sum(percentages)>100: reason='OVER_100'
                elif any(not 3<=len(r['raw_record']['Nombre del beneficiario'].strip())<=180 for r in rows): reason='NAME_INVALID'
                elif len(rows)>20: reason='TOO_MANY_BENEFICIARIES'
            except (InvalidOperation, ValueError): reason='PERCENTAGE_INVALID'
        for row in rows:
            result.append({**row,'numero_control':control,'participant_id':participant,
                'reason':reason,'status':'IMPORTED' if reason=='VALID' else 'PENDING_REVIEW'})
    return sorted(result,key=lambda r:r['source_row'])

if __name__=='__main__':
    content=Path(os.environ.get('SUTIAPP_BENEFICIARIES_CSV', str(PRIVATE/'source.csv'))).read_bytes()
    assert hashlib.sha256(content).hexdigest()==EXPECTED_SHA, 'SOURCE_CHANGED_REAUDIT_REQUIRED'
    inventory=json.loads((PRIVATE/'inventory.json').read_text(encoding='utf-8'))
    rows=plan(content,inventory)
    assert len(rows)==210 and sum(r['status']=='IMPORTED' for r in rows)==112, 'AUDIT_COUNTS_CHANGED'
    (PRIVATE/'source.csv').write_bytes(content)
    (PRIVATE/'import-plan.json').write_text(json.dumps({'source_sha256':EXPECTED_SHA,'rows':rows},ensure_ascii=False,indent=2),encoding='utf-8')
    summary={'status':'PASS','source_sha256':EXPECTED_SHA,'total':len(rows),'statuses':dict(Counter(r['status'] for r in rows)),'reasons':dict(Counter(r['reason'] for r in rows))}
    out=Path('docs/qa/evidence/savings-beneficiaries-20260918');out.mkdir(parents=True,exist_ok=True)
    (out/'csv-plan.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(summary))
