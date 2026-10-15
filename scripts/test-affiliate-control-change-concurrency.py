"""Real local PostgreSQL, multiple independent sessions; synthetic data only."""
import concurrent.futures
import json
import os
import socket
import time
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / '.tmp/affiliate-control-change'
BIN = Path('C:/Program Files/PostgreSQL/18/bin')
DATA = WORK / 'pgdata'
LOG = WORK / 'postgres.log'
CREATE_NO_WINDOW = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
sock = socket.socket()
sock.bind(('127.0.0.1',0))
PORT = sock.getsockname()[1]
DBNAME = 'control_test_'+str(int(time.time()))
sock.close()
def run(exe,args,check=True):
    if exe=='pg_ctl.exe':
        with (WORK/'pg-control.log').open('a',encoding='utf-8') as log:
            return subprocess.run([str(BIN/exe),*args],stdout=log,stderr=subprocess.STDOUT,creationflags=CREATE_NO_WINDOW,check=check)
    return subprocess.run([str(BIN/exe),*args],capture_output=True,text=True,encoding='utf-8',errors='replace',creationflags=CREATE_NO_WINDOW,check=check)
def args():
    return ['-h','127.0.0.1','-p',str(PORT),'-U','postgres','-d',DBNAME,'-X','-qAt','-v','ON_ERROR_STOP=1']
def sql(query,check=True):
    return run('psql.exe',args()+['-c',query],check)
def literal(value):
    return 'null' if value is None else "'"+str(value).replace("'","''")+"'"
def ident(n):
    return '00000000-0000-4000-8000-'+str(n).zfill(12)
AUTH = "select set_config('test.uid','"+ident(9)+"',false);select set_config('test.permissions','[\"affiliates.read\",\"affiliates.write\"]',false);select set_config('test.boundary','true',false);set role authenticated;"
def report(n,target):
    out=sql(AUTH+"select preview_admin_affiliate_control("+literal(ident(n))+","+literal(target)+")::text;").stdout
    return json.loads(out.strip().splitlines()[-1])
def save(r,action):
    vals=[r['affiliate_id'],r['new_control'],r['expected_updated_at'],r['fingerprint'],'',ident(action)]
    return "select change_admin_affiliate_control("+','.join(map(literal,vals))+")::text;"
def race(first,second,expected):
    # The first connection announces its successful write while holding locks.
    proc=subprocess.Popen([str(BIN/'psql.exe'),*args(),'-c',"begin;"+AUTH+first+"select 'LOCK_HELD';select pg_sleep(1.0);commit;"],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8',creationflags=CREATE_NO_WINDOW)
    output=[]
    for line in proc.stdout:
        output.append(line)
        if line.strip()=='LOCK_HELD':
            break
    else:
        raise RuntimeError('First writer failed: '+proc.stderr.read())
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        fut=pool.submit(sql,second,False)
        rest,err=proc.communicate(timeout=15)
        assert proc.returncode==0,err
        other=fut.result(timeout=15)
    if expected:
        assert other.returncode!=0 and expected in other.stderr,other.stderr+other.stdout
    else:
        assert other.returncode==0,other.stderr
    return other
def main():
    assert DATA.resolve().is_relative_to(WORK.resolve())
    if not DATA.exists():
        run('initdb.exe',['-D',str(DATA),'-U','postgres','-A','trust','--no-locale','-E','UTF8','--wal-segsize=1'])
    run('pg_ctl.exe',['-D',str(DATA),'-l',str(LOG),'-o',f'-h 127.0.0.1 -p {PORT}','-w','start'])
    checks=[]
    try:
        bootstrap=args();bootstrap[bootstrap.index('-d')+1]='postgres'
        run('psql.exe',bootstrap+['-c','create database '+DBNAME])
        setup=(WORK/'catalog-setup.sql').read_text(encoding='utf-8')
        for role in ['anon','authenticated','service_role']:
            setup=setup.replace('create role '+role+';', "do $$ begin if not exists(select 1 from pg_roles where rolname='"+role+"') then create role "+role+";end if;end $$;")
        setup_file=WORK/"concurrency-setup.sql"
        setup_file.write_text(setup,encoding="utf-8")
        run("psql.exe",args()+["-f",str(setup_file)])
        run('psql.exe',args()+['-f',str(ROOT/'supabase/migrations/20261015000100_affiliate_control_change.sql')])
        a,b=report(1,'RACE-A'),report(1,'RACE-B')
        race(save(a,201),AUTH+save(b,202),'AFFILIATE_VERSION_CONFLICT')
        checks.append('same affiliate: stale parallel writer rejected after row/table lock')
        a,b=report(2,'RACE-SHARED'),report(3,'RACE-SHARED')
        race(save(a,203),AUTH+save(b,204),'AFFILIATE_CONTROL_BLOCKED')
        checks.append('different affiliates: one desired number cannot be assigned twice')
        a=report(4,'RACE-RESERVED')
        insert="insert into affiliates(numero_control,full_name,auth_eligibility,auth_ineligibility_reason,record_origin) values('RACE-RESERVED','Synthetic collision','missing_email','missing_email','ADMIN_AFFILIATES');"
        race(save(a,205),insert,'AFFILIATE_CONTROL_RESERVED')
        checks.append('ordinary concurrent creation respects reservation after waiting for change')
        a=report(5,'RACE-RETRY')
        other=race(save(a,206),AUTH+save(a,206),None)
        assert json.loads(other.stdout.strip().splitlines()[-1])['replayed']
        checks.append('simultaneous duplicate action returns same event, no duplicate audit')
        counts=json.loads(sql("select jsonb_build_object('changes',(select count(*) from affiliate_control_changes),'events',(select count(*) from affiliate_admin_events),'affiliates',(select count(*) from affiliates));").stdout.strip())
        assert counts=={'changes':4,'events':4,'affiliates':8},counts
        result={'status':'PASS','engine':'PostgreSQL 18 / local loopback only','checks':checks,'counts':counts,'productionWrites':0}
        (ROOT/'docs/qa/evidence/affiliate-control-change/concurrency.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
        print(json.dumps(result))
    finally:
        run('pg_ctl.exe',['-D',str(DATA),'-m','fast','-w','stop'],check=False)
if __name__=='__main__':
    main()
