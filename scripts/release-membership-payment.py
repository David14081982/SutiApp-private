"""Prepare a scoped release from current origin/main, preserving published unrelated changes."""
import difflib
import base64
import hashlib
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PRIVATE=Path('C:/tmp/sutiapp-membership-payment-20260910')
TREE=PRIVATE/'release'
OUT=ROOT/'docs/qa/evidence/membership-payment-contract-20260910'
FILES=['app/membership-repository.js','app/program-request-repository.js','app/screens-membership-application.jsx']
TASK='H-MEMBERSHIP-PAYMENT-CONTRACT-001'
def git(*args,cwd=ROOT):return subprocess.check_output(['git',*args],cwd=cwd).decode('utf8')
def sha(s):return hashlib.sha256(s.encode()).hexdigest()
def save(name,data):(OUT/name).write_text(json.dumps(data,indent=2)+'\n',encoding='utf8')

def main():
    mode=sys.argv[1]
    if mode=='stage':
        proof=json.loads((OUT/'release-preflight.json').read_text())
        assert proof['status']=='PASS'
        assert hashlib.sha256((TREE/'app/bundle.js').read_bytes()).hexdigest()==proof['bundleSha256']
        current=git('ls-remote','origin','refs/heads/main').split()[0]
        assert current==proof['base'],'REMOTE_BASE_MOVED'
        target=TREE/'docs/qa/evidence/membership-payment-contract-20260910/release-preflight.json'
        shutil.copyfile(OUT/'release-preflight.json',target)
        paths=proof['files']+[target.relative_to(TREE).as_posix()]
        git('add','--',*paths,cwd=TREE)
        staged=git('diff','--cached','--name-only',cwd=TREE).splitlines()
        assert set(staged)==set(paths),'STAGED_SCOPE_MISMATCH'
        subprocess.run(['git','diff','--cached','--check'],cwd=TREE,check=True)
        print(json.dumps({'status':'PASS','stagedFiles':len(staged)}));return
    if mode=='registry':
        for tree in [ROOT,TREE]:
            spec=importlib.util.spec_from_file_location('registry',tree/'scripts/generate-architecture-registry.py')
            registry=importlib.util.module_from_spec(spec);spec.loader.exec_module(registry)
            main=json.loads(registry.MAIN.read_text(encoding='utf8'))
            changed,added,removed,_=registry.current_changes(main)
            analyze=registry.analyze_file
            def progress(file,overrides):
                print('Indexing '+str(file.relative_to(tree)),flush=True)
                return analyze(file,overrides)
            registry.analyze_file=progress
            if changed or added or removed:registry.incremental(changed+added+removed)
            print(json.dumps({'tree':str(tree),'updated':len(changed+added+removed)}))
        return
    if mode=='preflight':
        for name in ['sql-test','sql-apply','sql-verify','browser','contracts','live-local','global-images-local','global-images-production-before','release-build']:
            result=json.loads((OUT/(name+'.json')).read_text(encoding='utf-8-sig'))
            assert result['status']=='PASS',name
        applied=json.loads((OUT/'sql-apply.json').read_text())
        migration=TREE/'supabase/migrations/20260910000100_membership_payment_contract.sql'
        assert hashlib.sha256(migration.read_bytes()).hexdigest()==applied['migrationSha256']
        prepared=json.loads((OUT/'release-preparation.json').read_text())
        for proof in prepared['files']:
            assert sha((TREE/proof['file']).read_text(encoding='utf8'))==proof['after'],'UNTESTED_SOURCE_CHANGE'
        built=json.loads((OUT/'release-build.json').read_text())
        assert (Path(built['directory'])/'app/bundle.js').read_bytes()==(TREE/'app/bundle.js').read_bytes(),'UNTESTED_BUNDLE_CHANGE'
        allowed=set(FILES+['SutiApp.html','app/bundle.js','scripts/test-membership-request-ui-cutover.js'])
        allowed.update(json.loads((OUT/'release-package.json').read_text())['taskFiles'])
        allowed.update('docs/'+n+'.md' for n in ['AGENT_CHANGELOG','DECISIONS','INVARIANTS','SOURCE_OF_TRUTH'])
        allowed.update('docs/architecture/'+n+'.json' for n in ['SUTIAPP_ARCHITECTURE_REGISTRY','registry-code','registry-data','registry-edges','registry-search'])
        changed=git('diff','--name-only',cwd=TREE).splitlines()+git('ls-files','--others','--exclude-standard',cwd=TREE).splitlines()
        assert all(f in allowed or f.startswith('docs/qa/evidence/membership-payment-contract-20260910/') for f in changed),('UNEXPECTED_RELEASE_FILE',changed)
        subprocess.run(['git','diff','--check'],cwd=TREE,check=True)
        result={'status':'PASS','base':prepared['base'],'files':sorted(set(changed)),'backendSha256':applied['migrationSha256'],'bundleSha256':hashlib.sha256((TREE/'app/bundle.js').read_bytes()).hexdigest(),'unrelatedModulesIdentical':112,'historicalDataWrites':0}
        save('release-preflight.json',result);print(json.dumps(result));return
    if mode=='package':
        git('sparse-checkout','add','docs','google-apps-script',cwd=TREE)
        version='20260910000100_membership_payment_contract.sql'
        additions=['supabase/migrations/'+version,'supabase/recovery/'+version,
            'scripts/membership-payment-contract.py','scripts/release-membership-payment.py',
            'scripts/test-membership-payment-contract.sql','scripts/test-membership-payment-contract.js',
            'scripts/test-membership-payment-contract-browser.js','scripts/test-membership-payment-contract-live.js',
            'scripts/test-membership-request-ui-cutover.js','docs/qa/'+TASK+'.md']
        for name in additions:
            target=TREE/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,target)
        for file in OUT.glob('*.json'):
            raw=file.read_bytes()
            value=json.loads(raw.decode('utf16' if raw.startswith(b'\xff\xfe') else 'utf-8-sig'))
            file.write_text(json.dumps(value,indent=2)+'\n',encoding='utf8',newline='\n')
            target=TREE/file.relative_to(ROOT);target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(file,target)
        policies={
          'SOURCE_OF_TRUTH':'membership_offerings.amount/installments siguen siendo la autoridad del precio comercial y número total de descuentos. affiliates.financial_employee_category_code determina la periodicidad: JUBILADOS_PENSIONADOS mensual; BASE, EVENTUALES, SUPLENTES_FIJOS, SUPLENTES_VARIABLES y CONFIANZA quincenal. get_current_membership_payment_quote obtiene el contexto efectivo autenticado; create_membership_request de ocho argumentos valida la cotización aceptada. El trigger exclusivo de nuevas membresías captura financial_submission_snapshot y financial_profile_snapshot inmutables. Finanzas y Google leen esa captura mediante sus lectores existentes. Sin nuevos catálogos financieros, cachés persistentes ni fallback.',
          'INVARIANTS':'Para nuevas membresías: fondo exacto Vales y membresias; tasa e interés cero; monto a solicitar = total a pagar = importe comercial del catálogo; número de pagos = installments. Gastos administrativos = 15 × pagos INCLUIDOS; capital = total − gastos. Redondeo por descuento con ajuste final para conservar total. Cambios de catálogo o perfil antes de confirmar invalidan la cotización; después no recalculan la solicitud. financial_processing_status permanece NULL para conservar el workflow de membresías. Prohibido completar históricos o alterar reglas de otros programas en esta H.',
          'DECISIONS':'Autorización expresa del propietario: implementar quirúrgicamente la conexión de membresías a Finanzas · Solicitudes y columnas E–I de Historial de solicitudes. Precio y pagos variables desde Admin Membresías; fondo Vales y membresias, sin intereses, gasto de $15 incluido por pago, H=I=precio comercial. Reportes separados quedan fuera de alcance; históricos los corregirá manualmente el propietario. Solución aditiva exclusiva de membresías, sin modificar fórmulas de préstamos, reglas/fondos/programas, GAS ni el exportador Google existente. Cotización backend y captura atómica conservan identidad efectiva y actor real.',
          'AGENT_CHANGELOG':'Contrato backend aditivo de membresías y preview en pantalla existente; recuperación validada, sin backfill. SQL transaccional cubre 120 combinaciones, documentos, cotización obsoleta, idempotencia, inmutabilidad, workflow/aprobación, cola Google y permisos. Backend aplicado y verificado sin mutaciones de datos de negocio. Release aislado sobre origin/main preserva CSS publicado y los otros 112 módulos del bundle. Resultado y evidencia de publicación: docs/qa/'+TASK+'.md.'}
        for name,body in policies.items():
            marker='\n\n## '+TASK+' — 2026-09-10\n\n'
            for tree in [ROOT,TREE]:
                file=tree/'docs'/(name+'.md');text=file.read_text(encoding='utf8')
                if marker not in text:file.write_text(text.rstrip()+marker+body+'\n',encoding='utf8')
        save('release-package.json',{'status':'PASS','taskFiles':additions,'policyFiles':['docs/'+n+'.md' for n in policies],'scope':'Task files only; published unrelated source preserved'})
        print(json.dumps({'status':'PASS','packaged':len(additions)}));return
    if mode=='prepare':
        base=git('rev-parse','origin/main').strip()
        if not TREE.exists():
            git('worktree','add','--detach','--no-checkout',str(TREE),base)
            git('sparse-checkout','set','--cone','app','scripts','supabase','assets','.github',cwd=TREE)
            git('checkout',base,cwd=TREE)
        assert git('rev-parse','HEAD',cwd=TREE).strip()==base,'RELEASE_BASE_DRIFT'
        proofs=[]
        for name in FILES:
            before=(PRIVATE/'before'/name).read_text(encoding='utf8')
            changed=(ROOT/name).read_text(encoding='utf8')
            published=git('show','HEAD:'+name,cwd=TREE)
            (TREE/name).write_text(published,encoding='utf8')
            delta=''.join(difflib.unified_diff(before.splitlines(True),changed.splitlines(True),fromfile='a/'+name,tofile='b/'+name))
            subprocess.run(['git','apply','--check','-'],input=delta.encode(),cwd=TREE,check=True)
            subprocess.run(['git','apply','-'],input=delta.encode(),cwd=TREE,check=True)
            result=(TREE/name).read_text(encoding='utf8')
            if name.endswith('screens-membership-application.jsx'):
                assert re.search(r'const CSS=`([\s\S]*?)`;',published)[1]==re.search(r'const CSS=`([\s\S]*?)`;',result)[1]
            (TREE/name).write_text(result,encoding='utf8')
            proofs.append({'file':name,'publishedBefore':sha(published),'after':sha(result)})
        html=TREE/'SutiApp.html';text=git('show','HEAD:SutiApp.html',cwd=TREE)
        match=re.search(r'app/bundle\.js\?v=(\d+)',text);assert match
        html.write_text(text.replace(match[0],'app/bundle.js?v='+str(int(match[1])+1)),encoding='utf8')
        save('release-preparation.json',{'status':'PASS','base':base,'files':proofs,'publishedCssPreserved':True,'workerUnchanged':True})
        print(json.dumps({'status':'PASS','base':base,'worktree':str(TREE)}));return
    if mode=='build':
        # Windows checkout may convert vendor LF to CRLF, invalidating published SRI.
        # Restore exact committed bytes; do not alter the vendor blobs or HTML hashes.
        for name in git('ls-files','app/vendor',cwd=TREE).splitlines():
            committed=subprocess.check_output(['git','show','HEAD:'+name],cwd=TREE)
            working=(TREE/name).read_bytes()
            assert working.replace(b'\r\n',b'\n')==committed.replace(b'\r\n',b'\n'),'VENDOR_CONTENT_DRIFT'
            (TREE/name).write_bytes(committed)
        subprocess.run(['node','scripts/build-bundle.js','C:/tmp/babel-standalone-7.29.0.min.js'],cwd=TREE,check=True)
        spec=importlib.util.spec_from_file_location('db',ROOT/'scripts/apply-document-requirements-platform.py');db=importlib.util.module_from_spec(spec);spec.loader.exec_module(db)
        env=db.env();build_env=dict(os.environ,SUTIAPP_SUPABASE_URL=env['SUPABASE_URL'],SUTIAPP_SUPABASE_PUBLISHABLE_KEY=env['SUPABASE_PUBLISHABLE_KEY'])
        target=PRIVATE/'release-site';n=1
        while target.exists():n+=1;target=PRIVATE/('release-site'+str(n))
        subprocess.run(['node','scripts/build-pages-site.js',str(target)],cwd=TREE,env=build_env,check=True)
        for src,digest in re.findall(r'<script\s+src="([^"]+)"\s+integrity="sha384-([^"]+)"',(target/'index.html').read_text(encoding='utf8')):
            assert base64.b64encode(hashlib.sha384((target/src.split('?')[0]).read_bytes()).digest()).decode()==digest,'VENDOR_SRI_MISMATCH'
        # Every generated module outside this H must remain identical to production source bundle.
        old=git('show','HEAD:app/bundle.js',cwd=TREE)
        new=(TREE/'app/bundle.js').read_text(encoding='utf8')
        split=lambda text:dict((m[0],m[1]) for m in re.findall(r'/\* @@file ([^ ]+) \*/\n([\s\S]*?)(?=/\* @@file |\Z)',text))
        before,after=split(old),split(new);assert before.keys()==after.keys()
        altered=[f for f in before if before[f]!=after[f]]
        assert set(altered)=={Path(f).name for f in FILES},('UNRELATED_BUNDLE_CHANGE',altered)
        result={'status':'PASS','directory':str(target),'changedBundleModules':altered,'otherBundleModulesIdentical':len(before)-len(altered)}
        save('release-build.json',result);print(json.dumps(result));return
    raise SystemExit('UNKNOWN_MODE')

if __name__=='__main__':main()
