import importlib.util
import csv
import io
import unittest

spec=importlib.util.spec_from_file_location('migration','scripts/savings-beneficiaries-csv.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class MigrationTests(unittest.TestCase):
    def run_plan(self, records, affiliates=None):
        out=io.StringIO(newline='');writer=csv.writer(out)
        writer.writerow(['Folio','Email','Nombre Agremiado','Firma','Nombre del beneficiario','Porcentaje'])
        writer.writerows(records)
        return m.plan(out.getvalue().encode(),{'affiliates':affiliates or [{'id':'a','control':'001','archived':False}],
            'participants':[{'id':'p','control':'001','affiliate_id':'a','identity':'RESOLVED'}]})
    def test_exact_control_and_decimal(self):
        r=self.run_plan([['001','','','','Persona A','33.33'],['001','','','','Persona B','66.67'],['1','','','','Persona C','100']])
        self.assertEqual([v['reason'] for v in r],['VALID','VALID','AFFILIATE_MATCH_0'])
    def test_overallocation_is_never_repaired(self):
        r=self.run_plan([['001','','','','Persona A','100'],['001','','','','Persona A','100']])
        self.assertTrue(all(v['reason']=='OVER_100' for v in r));self.assertEqual(len(r),2)
        self.assertEqual(r[0]['raw_record']['Porcentaje'],'100')
    def test_missing_owner_and_invalid_percent(self):
        for percentage in ['NaN','Infinity','0','-1','2.001','1000','6500035']:
            self.assertNotEqual(self.run_plan([['001','','','','Persona A',percentage]])[0]['reason'],'VALID')
        self.assertEqual(self.run_plan([['','','','','Persona A','100']])[0]['reason'],'MISSING_CONTROL')
    def test_csv_quoted_multiline_preserved(self):
        name='Persona, "Nombre"\nApellido'
        r=self.run_plan([['001','','','',name,'75']])[0]
        self.assertEqual(r['raw_record']['Nombre del beneficiario'],name);self.assertEqual(r['reason'],'VALID')
    def test_duplicate_identity_blocked(self):
        a=[{'id':str(n),'control':'001','archived':False} for n in range(2)]
        self.assertEqual(self.run_plan([['001','','','','Persona A','100']],a)[0]['reason'],'AFFILIATE_MATCH_2')

if __name__=='__main__':unittest.main()
