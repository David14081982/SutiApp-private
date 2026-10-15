'use strict';
// Installed catalog only, no production rows. Recreates types/keys and critical
// affiliate constraints/defaults; permissions use explicit isolated principals.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),{PGlite}=require(path.join(root,'.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
const cat=JSON.parse(fs.readFileSync(path.join(root,'scripts/fixtures/affiliate-control-change-schema.json'),'utf8'));
const quote=s=>'"'+s.replaceAll('"','""')+'"',id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const stmts=[
"create role anon;create role authenticated;create role service_role;create schema auth;create schema extensions;",
"create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);",
"create function extensions.gen_random_uuid() returns uuid language sql as $$select gen_random_uuid()$$;",
"create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;",
"create function has_admin_permission(text) returns boolean language sql stable as $$select coalesce(current_setting('test.permissions',true),'[]')::jsonb ? $1$$;",
"create function admin_module_boundary(text[],text) returns boolean language sql stable as $$select current_setting('test.boundary',true)='true'$$;",
"grant usage on schema public,auth to authenticated,anon;"
];
const tables=new Map();
for(const c of cat.columns){const key=c.schema+'.'+c.table;if(!tables.has(key))tables.set(key,[]);tables.get(key).push(c);}
for(const schema of new Set(cat.columns.map(c=>c.schema)))if(schema!=='public')stmts.push('create schema '+quote(schema)+';');
for(const [key,columns] of tables){
 const [schema,table]=key.split('.'),critical=schema==='public'&&['affiliates','affiliate_admin_events'].includes(table);
 const cols=columns.map(c=>quote(c.name)+' '+c.type+(critical&&c.default?' default '+c.default:'')+(critical&&c.not_null?' not null':''));
 stmts.push('create table '+quote(schema)+'.'+quote(table)+'('+cols.join(',')+');');
}
for(const k of cat.constraints.filter(c=>['p','u'].includes(c.type)))
 stmts.push('alter table '+quote(k.schema)+'.'+quote(k.table)+' add constraint '+quote(k.name)+' '+k.definition+';');
for(const k of cat.constraints.filter(c=>c.type==='f')){
 const m=/REFERENCES (?:(\w+)\.)?(\w+)\(/.exec(k.definition);assert(m,k.definition);
 if(m[1]==='auth'&&m[2]!=='users')throw Error('Unexpected auth dependency '+m[2]);
 stmts.push('alter table '+quote(k.schema)+'.'+quote(k.table)+' add constraint '+quote(k.name)+' '+k.definition+';');
}
for(const k of cat.constraints.filter(c=>c.type==='c'&&c.schema==='public'&&['affiliates','affiliate_admin_events'].includes(c.table)))
 stmts.push('alter table public.'+quote(k.table)+' add constraint '+quote(k.name)+' '+k.definition+';');
for(const ddl of cat.affiliate_indexes)if(!ddl.includes('affiliates_pkey')&&!ddl.includes('affiliates_source_identity_unique'))stmts.push(ddl+';');
const trig=cat.affiliate_triggers.find(t=>t.name==='affiliates_set_updated_at');stmts.push(trig.function+';',trig.definition+';');
stmts.push(cat.functions.find(f=>f.name==='has_certified_affiliate_auth_link').definition+';');
stmts.push("alter table affiliates enable row level security;alter table affiliates force row level security;");
stmts.push("insert into auth.users(id,email) values('"+id(9)+"','admin@example.test');");
for(let n=1;n<=8;n++)stmts.push("insert into affiliates(id,numero_control,full_name,auth_eligibility,auth_ineligibility_reason,record_origin) values('"+id(n)+"','CAT-"+n+"','Synthetic catalog fixture','missing_email','missing_email','ADMIN_AFFILIATES');");
const setup=stmts.join('\n'),dir=path.join(root,'.tmp/affiliate-control-change');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'catalog-setup.sql'),setup+'\n');
async function main(){
 const db=new PGlite(),q=async(s,p=[])=>(await db.query(s,p)).rows;
 try{
 await db.exec(setup);
 const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261015000100_affiliate_control_change.sql'),'utf8');
 await db.exec(migration);
 await q("select set_config('test.uid',$1,false),set_config('test.permissions','[\"affiliates.read\",\"affiliates.write\"]',false),set_config('test.boundary','true',false)",[id(9)]);
 await db.exec('set role authenticated');
 const t=Date.now(),report=(await q('select preview_admin_affiliate_control($1,$2) r',[id(1),'CAT-NEW']))[0].r,elapsed=Date.now()-t;
 assert.equal(report.blockers.length,0);assert(report.tables_checked>70);
 const result=(await q('select change_admin_affiliate_control($1,$2,$3,$4,$5,$6) r',[id(1),'CAT-NEW',report.expected_updated_at,report.fingerprint,'',id(101)]))[0].r;
 assert.equal(result.change.new_control,'CAT-NEW');assert.equal(result.change.old_control,'CAT-1');
 await db.exec('reset role');assert.equal((await q('select numero_control from affiliates where id=$1',[id(1)]))[0].numero_control,'CAT-NEW');
 const evidence={status:'PASS',catalogTables:tables.size,catalogConstraints:cat.constraints.length,inspectedTables:report.tables_checked,emptyCatalogPreviewMs:elapsed,criticalAffiliateConstraintsAndTimestampTrigger:true,realCertifiedAccessFunction:true,productionRowsCopied:0,productionWrites:0};
 fs.writeFileSync(path.join(root,'docs/qa/evidence/affiliate-control-change/catalog-test.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
 }finally{await db.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
