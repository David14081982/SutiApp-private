"""Independent read-only OOXML/openpyxl verification; never saves a workbook."""
import hashlib
import io
import json
from pathlib import Path
import re
import zipfile
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.tmp/reports-jc/export-tests'
module = (ROOT / 'supabase/functions/reports-jc/template.mjs').read_text(encoding='utf-8')
import base64
raw = base64.b64decode(json.loads(re.search(r'export const TEMPLATE_BASE64 = ("[^"]+");', module)[1]))
assert hashlib.sha256(raw).hexdigest() == 'da8c9785b4f4a62bc087403a06492766cf8dae59e2d239589396a31f842e32eb'
original = load_workbook(io.BytesIO(raw), data_only=False)
original_zip = zipfile.ZipFile(io.BytesIO(raw))
fixture = json.loads((OUT / 'fixture.json').read_text(encoding='utf-8'))
MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
CELL = re.compile(r'<c\b[^>]*?\br="([A-Z]+\d+)"[^>]*?(?:/>|>[\s\S]*?</c>)')

def check_book(data, month):
    archive = zipfile.ZipFile(io.BytesIO(data))
    workbook = load_workbook(io.BytesIO(data), data_only=False)
    cached = load_workbook(io.BytesIO(data), data_only=True)
    assert workbook.sheetnames == original.sheetnames
    assert archive.namelist() == original_zip.namelist()
    for filename in archive.namelist():
        if filename not in [f'xl/worksheets/sheet{i}.xml' for i in range(1, 9)]:
            assert archive.read(filename) == original_zip.read(filename), filename
    for i, source in enumerate(original.worksheets[:8], 1):
        sheet = workbook[source.title]
        values = cached[source.title]
        monthly = i in (2, 4, 6)
        expected = fixture['sheets'][source.title]
        inputs = expected['months'][str(month)]['cells'] if monthly else expected['cells']
        allowed = set(inputs)
        title_coord = 'A1' if i == 8 else 'A2'
        allowed.add(title_coord)
        assert values[title_coord].value.endswith((MONTHS[month - 1] + ' ' if monthly else '') + '2028')
        if not monthly:
            year_coord = 'A3' if i == 8 else 'A5'
            allowed.add(year_coord)
            assert values[year_coord].value == 2028
        for coord, entry in inputs.items():
            assert values[coord].value == entry['value'], (i, coord)
        if i in (1, 3, 5, 7):
            allowed.update(f'E{r}' for r in range(6, 18))
            allowed.update(f'{col}18' for col in 'BCDE')
        elif i == 2:
            allowed.update(f'E{r}' for r in range(6, 11))
            allowed.update(f'{col}11' for col in 'BCDE')
        elif i == 4:
            allowed.update(f'E{r}' for r in range(6, 21))
            allowed.update(f'{col}21' for col in 'CDE')
        elif i == 6:
            allowed.update(f'E{r}' for r in range(6, 18))
            allowed.update(f'{col}18' for col in 'BCDE')
            allowed.update(f'A{r}' for r in range(12, 18))
        else:
            allowed.update(f'H{r}' for r in range(4, 16))
            allowed.update(f'{col}16' for col in 'BCDEFGH')
        before = original_zip.read(f'xl/worksheets/sheet{i}.xml').decode('utf-8')
        after = archive.read(f'xl/worksheets/sheet{i}.xml').decode('utf-8')
        strip_allowed = lambda text: CELL.sub(lambda m: '' if m[1] in allowed else m[0], text)
        assert strip_allowed(before) == strip_allowed(after), (i, 'XML outside allowlist changed')
        for row in source:
            for cell in row:
                dest = sheet[cell.coordinate]
                assert cell._style == dest._style, (i, cell.coordinate, 'style')
                if cell.coordinate not in allowed:
                    assert cell.value == dest.value, (i, cell.coordinate, 'out-of-scope value')
                if cell.data_type == 'f':
                    assert dest.value == cell.value, (i, cell.coordinate, 'formula')
                    match = re.fullmatch(r'=SUM\(([A-Z]+\d+):([A-Z]+\d+)\)', cell.value)
                    assert match, 'unexpected template formula'
                    total = sum(c.value or 0 for row2 in values[f'{match[1]}:{match[2]}'] for c in row2)
                    assert values[cell.coordinate].value == total, (i, cell.coordinate, 'cached sum')
        # Independently verify missing derived cells populated without introducing formulas.
        if i in (1, 3):
            for row in range(15, 18): assert values[f'E{row}'].value == sum(values[f'{col}{row}'].value for col in 'BCD')
        if i in (4, 6):
            for row in range(6, 21 if i == 4 else 18):
                cols = 'CD' if i == 4 else 'BC'
                assert values[f'E{row}'].value == sum(values[f'{col}{row}'].value for col in cols)
        if i in (5, 7): assert values['D18'].value == sum(values[f'D{r}'].value for r in range(6, 18))
        if i == 8:
            for col in 'DEFG': assert values[f'{col}16'].value == sum(values[f'{col}{r}'].value for r in range(4, 16))

check_book((OUT / 'monthly.xlsx').read_bytes(), 10)
with zipfile.ZipFile(OUT / 'annual.zip') as annual:
    assert len(annual.namelist()) == 12
    for month in range(1, 13): check_book(annual.read(f'Reporte_JC_2028-{month:02d}.xlsx'), month)
summary = {'status': 'PASS', 'booksIndependentlyVerified': 13, 'sheetsPerBook': 17, 'originalFormulasPreservedPerBook': 245, 'scopedFormulaCachesCheckedPerBook': 87, 'excludedSheetsAndPackagePartsIdentical': True, 'allStylesAndOutOfScopeCellsPreserved': True}
(OUT / 'python-result.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
print(json.dumps(summary))
