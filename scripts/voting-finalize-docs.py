import pathlib,json,shutil,subprocess
root=pathlib.Path(__file__).resolve().parent.parent
release=root/'tmp/voting-release'
authority='''

## H-SUTIAPP-VOTACIONES-PRODUCTION-001 — Votaciones

Supabase `voting_consultations`, `voting_questions` y `voting_votes` son las autoridades únicas de consultas, audiencia, preguntas, fecha de cierre, padrón convocado y votos. `VotingRepository` sólo transporta RPC; las pantallas mantienen borradores/proyecciones efímeros en memoria. Sin localStorage, seeds, conteos demo ni fallback. Resultados y porcentajes se derivan de votos reales; el padrón convocado lo configura Admin.

Auth → `get_effective_affiliate_id()` → affiliates resuelve al votante. Los códigos de sindicato/categoría y el motor `matches_current_affiliate_audience` existentes se reutilizan; cargo sindical proviene de `affiliates.union_position_raw`, y la lista nominal compara correos históricos normalizados del mismo maestro. La vista asistida usa el afiliado efectivo; emitir votos está prohibido durante impersonación. Cada voto conserva snapshot de identidad de negocio y folio UUID generado en backend, con UNIQUE inmediato por afiliado/consulta/pregunta y trigger inmutable.

Permisos: catálogo de pantallas existente `admin_votaciones` para administración/resultados; `admin_votaciones_nominal` para exportación identificada explícita. Acciones granulares reutilizan `admin_section_responsibilities`. Principal recibe permisos explícitos; administrar consultas no concede nominal a cuentas limitadas. La tabla de votos carece de acceso directo browser. Las RPC separan resultados propios/post-voto de resultados Admin y exportación nominal. `admin_audit_log` registra creación, edición, publicación, archivo, duplicación, exportaciones y emisión sin exponer respuesta en metadata genérica.

Eliminar archiva consultas/preguntas y preserva votos. Preguntas con votos conservan texto y explicación; duplicar crea preguntas nuevas, ocultas y sin votos. Cierre al final de la fecha indicada en America/Hermosillo. Export CSV UTF-8 BOM, `sep=;`, escape de comillas y neutralización de fórmulas. Migración `20260915000200` aplicada; recovery revoca RPC y preserva íntegramente historia. Sin impacto financiero/Google/Storage/Auth global.
'''
log='''

## H-SUTIAPP-VOTACIONES-PRODUCTION-001

Módulo afiliado entre carrusel y Tu sindicato y editor Admin basados en HTML owner. Estilos e iconos extraídos y encapsulados; tamaños consumen tokens actuales de producción. Supabase es autoridad exclusiva; nuevo schema aditivo, RPC/identidad backend, voto definitivo, audiencia, permisos separados, folios, exportaciones y bitácora. Tabla histórica inmutable; archivo lógico. Publicación aislada sobre origin/main, conservando 120 chunks ajenos del bundle sin cambio.

Evidencia: docs/qa/evidence/voting-20260915 y docs/audits/H-SUTIAPP-VOTACIONES-PRODUCTION-001.md. Matriz SQL con ROLLBACK PASS a la primera, navegador focal PASS tras corregir entorno aislado, seguridad adicional PASS. La concurrencia se garantiza mediante UNIQUE inmediato y locks compartidos; no se ejecutó carga productiva ni se dejaron votos/consultas de ejemplo. Consultar result.md para estado final de despliegue/regresiones.
'''
for target in [root,release]:
 for name,text in [('docs/SOURCE_OF_TRUTH.md',authority),('docs/AGENT_CHANGELOG.md',log)]:
  p=target/name;s=p.read_text(encoding='utf-8');marker='## H-SUTIAPP-VOTACIONES-PRODUCTION-001';
  if marker not in s:p.write_text(s+text,encoding='utf-8')
# Update only semantic metadata for this new domain; generated graph remains derived.
p=release/'docs/architecture/architecture-overrides.json';data=json.loads(p.read_text(encoding='utf-8'))
data['domain_rules']=[r for r in data['domain_rules'] if r['domain']!='voting']+[{'domain':'voting','patterns':['votaciones','voting','votos','consultas sindicales']}]
data['nodes']=[n for n in data['nodes'] if n.get('domain')!='voting']+[
 {'type':'screen','name':'VotingHome','file':'app/screens-voting.jsx','domain':'voting','aliases':['Votaciones afiliado','Votaciones'],'source_of_truth':'SUPABASE'},
 {'type':'admin_screen','name':'VotingAdmin','file':'app/screens-voting.jsx','domain':'voting','aliases':['Votaciones Admin','Votos identificados'],'source_of_truth':'SUPABASE'},
 {'type':'repository','name':'VotingRepository','file':'app/voting-repository.js','domain':'voting','source_of_truth':'SUPABASE','properties':{'authority':'voting_consultations + voting_questions + voting_votes','identity':'get_effective_affiliate_id','audit':'admin_audit_log'}}]
base=subprocess.check_output(['git','show','origin/main:docs/architecture/architecture-overrides.json'],cwd=release).decode('utf-8')
base=base.replace('"domain_rules": [','"domain_rules": [\n    '+json.dumps(data['domain_rules'][-1],ensure_ascii=False)+',',1)
base=base.replace('"nodes": [','"nodes": [\n'+''.join('    '+json.dumps(n,ensure_ascii=False)+',\n' for n in data['nodes'][-3:]),1)
p.write_text(base,encoding='utf-8')
for name in ['voting-build-release.js','voting-verify-release.js','test-voting-security-extra.sql','voting-finalize-docs.py','voting-prepare-design.py','test-voting-browser.js','voting-registry.py']:
 shutil.copyfile(root/'scripts'/name,release/'scripts'/name)
evidence=release/'docs/qa/evidence/voting-20260915';evidence.mkdir(parents=True,exist_ok=True)
for file in (root/'docs/qa/evidence/voting-20260915').iterdir():
 if 'failure' not in file.name and file.is_file():shutil.copyfile(file,evidence/file.name)
print('Voting authority, evidence and registry metadata prepared')
