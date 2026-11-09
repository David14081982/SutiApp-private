'use strict';
const R=require('./document-100mb.cjs'),{C,fs,path,area,candidate,evidence,save,body,migration,recovery}=R;
const assert=require('node:assert/strict'),crypto=require('node:crypto'),{Readable}=require('node:stream'),{pathToFileURL}=require('node:url');
const MAX=100*1024*1024,dir=path.join(area,'fixtures'),deps=path.join(C.root,'.tmp/document-architecture-lab/deps/node_modules');
const digest=async file=>{const h=crypto.createHash('sha256');for await(const b of fs.createReadStream(file))h.update(b);return h.digest('hex');};
const stream=file=>Readable.toWeb(fs.createReadStream(file,{highWaterMark:65536}),{strategy:{highWaterMark:65536,size:x=>x.byteLength}});
async function fixtures(){
 fs.mkdirSync(dir,{recursive:true});const {PNG}=require(path.join(deps,'pngjs')),jpeg=require(path.join(deps,'jpeg-js')),{PDFDocument}=require(path.join(deps,'pdf-lib'));
 const pixels=new PNG({width:4,height:4});pixels.data.fill(155);const png=PNG.sync.write(pixels),jpg=jpeg.encode({width:4,height:4,data:pixels.data},85).data;
 const table=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
 const crc=(n,b)=>{for(const v of b)n=table[(n^v)&255]^(n>>>8);return n>>>0;};
 const zero=Buffer.alloc(1024*1024),spaces=Buffer.alloc(1024*1024,32);
 const pad=(fd,n,b,visit)=>{while(n){const chunk=b.subarray(0,Math.min(n,b.length));fs.writeSync(fd,chunk);if(visit)visit(chunk);n-=chunk.length;}};
 const p=await PDFDocument.create();p.addPage([300,200]).drawText('SUTIAPP - PRUEBA 100 MB',{x:20,y:100,size:12});const pdf=Buffer.from(await p.save({useObjectStreams:false})),split=pdf.lastIndexOf('startxref');assert(split>0);
 let fd=fs.openSync(path.join(dir,'100mb.pdf'),'w');fs.writeSync(fd,pdf.subarray(0,split));pad(fd,MAX-pdf.length,spaces);fs.writeSync(fd,pdf.subarray(split));fs.closeSync(fd);
 fd=fs.openSync(path.join(dir,'100mb.jfif'),'w');fs.writeSync(fd,jpg.subarray(0,2));let left=MAX-jpg.length;
 while(left){let count=Math.min(left,65537);if(left-count>0&&left-count<4)count-=4;const header=Buffer.from([255,239,0,0]);header.writeUInt16BE(count-2,2);fs.writeSync(fd,header);pad(fd,count-4,zero);left-=count;}fs.writeSync(fd,jpg.subarray(2));fs.closeSync(fd);
 fd=fs.openSync(path.join(dir,'100mb.png'),'w');fs.writeSync(fd,png.subarray(0,33));const n=MAX-png.length-12,h=Buffer.alloc(8);h.writeUInt32BE(n);h.write('npAD',4);fs.writeSync(fd,h);let crcValue=crc(0xffffffff,h.subarray(4));pad(fd,n,zero,b=>{crcValue=crc(crcValue,b);});const tail=Buffer.alloc(4);tail.writeUInt32BE((crcValue^0xffffffff)>>>0);fs.writeSync(fd,tail);fs.writeSync(fd,png.subarray(33));fs.closeSync(fd);
 const webp=Buffer.from(R.json(path.join(C.root,'scripts/fixtures/document-100mb-webp.json')).base64,'base64');assert.equal(webp.readUInt32LE(4)+8,webp.length);
 fd=fs.openSync(path.join(dir,'100mb.webp'),'w');webp.writeUInt32LE(MAX-8,4);fs.writeSync(fd,webp);const extra=MAX-webp.length-8,chunk=Buffer.alloc(8);chunk.write('JUNK');chunk.writeUInt32LE(extra,4);fs.writeSync(fd,chunk);pad(fd,extra,zero);fs.closeSync(fd);
 const files=[];for(const [name,mime]of [['100mb.pdf','application/pdf'],['100mb.jfif','image/jpeg'],['100mb.png','image/png'],['100mb.webp','image/webp']]){const file=path.join(dir,name);assert.equal(fs.statSync(file).size,MAX);files.push({name,mime,size:MAX,sha256:await digest(file)});}
 save(path.join(area,'fixture-manifest.json'),files);return files;
}
async function physical(){
 const files=fs.existsSync(path.join(area,'fixture-manifest.json'))?R.json(path.join(area,'fixture-manifest.json')):await fixtures();
 const {verifyDocumentStream}=await import(pathToFileURL(path.join(candidate,'supabase/functions/_shared/document-stream.mjs')));let peak=process.memoryUsage().rss;const monitor=setInterval(()=>{peak=Math.max(peak,process.memoryUsage().rss);},5),checks=[];
 try{for(const f of files){const start=performance.now();assert.equal((await verifyDocumentStream(stream(path.join(dir,f.name)),f.mime,f.sha256,MAX)).verified,true);checks.push({name:f.name,status:'PASS',size:MAX,ms:Math.round(performance.now()-start)});console.log('PASS '+f.name);}
  await assert.rejects(verifyDocumentStream(stream(path.join(dir,files[0].name)),files[0].mime,files[0].sha256,MAX+1),/INVALID_DOCUMENT_FILE/);
  await assert.rejects(verifyDocumentStream(stream(path.join(dir,files[0].name)),files[0].mime,'0'.repeat(64),MAX),/BYTE_INTEGRITY_MISMATCH/);
  await assert.rejects(verifyDocumentStream(stream(path.join(dir,files[0].name)),'image/png',files[0].sha256,MAX),/INVALID_PNG/);
  const old=Buffer.from('existing canonical Office original');const hash=C.sha(old);assert.equal((await verifyDocumentStream(new Blob([old]).stream(),'application/msword',hash,old.length,{existingRead:true})).verified,true);
  const out={status:'PASS',checks,oversizeDenied:true,alteredHashDenied:true,mimeMismatchDenied:true,existingOriginalFormatsPreserved:true,peakRssBytes:peak,memoryBudgetBytes:256*1024*1024,sourceSha256:C.sha(fs.readFileSync(path.join(candidate,'supabase/functions/_shared/document-stream.mjs')))};assert(peak<256*1024*1024,'MEMORY_BUDGET_EXCEEDED');save(path.join(evidence,'stream-tests.json'),out);console.log(JSON.stringify(out));
 }finally{clearInterval(monitor);}
}
async function database(){
 const L=require('./document-lab/local.cjs'),restore=R.json(path.join(C.area,'restore-check.json')),db=L.connect({host:'127.0.0.1',port:restore.port,user:'postgres',database:restore.database,statement_timeout:60000});await db.connect();
 const before=R.json(path.join(C.root,'scripts/fixtures/document-100mb-before.json'));try{await db.query('begin');for(const f of before.functions)await db.query(f.definition);
  const tables=['public.affiliate_documents','public.private_assets','public.request_documents','public.program_requests'];
  const fingerprint=async()=>{const out={};for(const t of tables)out[t]=(await db.query(`select count(*)::int count,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from ${t} t`)).rows[0];return out;};const originals=await fingerprint();
  await db.query(body(migration));assert.deepEqual(await fingerprint(),originals);
  for(const f of before.functions){const r=(await db.query('select proacl::text acl,pg_get_userbyid(proowner) owner from pg_proc where oid=$1::regprocedure',[f.signature])).rows[0];assert.equal(r.acl,f.acl);assert.equal(r.owner,f.owner);}
  await db.query('savepoint fixtures');const actor=crypto.randomUUID(),affiliate=crypto.randomUUID(),session=crypto.randomUUID(),email='100mb-'+actor+'@example.invalid';
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[actor,email]);await db.query('insert into auth.sessions(id,user_id,not_after) values($1,$2,now()+interval \'1 hour\')',[session,actor]);
  await db.query("insert into public.affiliates(id,numero_control,full_name,auth_user_id,historical_email_raw,historical_email_normalized,auth_eligibility,auth_ineligibility_reason,record_origin) values($1,$2,'LOCAL 100MB TEST',$3,$4,$4,'missing_email','missing_email','ADMIN_AFFILIATES')",[affiliate,'DOC-TEST-100MB-'+affiliate,actor,email]);
  const type=(await db.query('select id from public.document_types where enabled limit 1')).rows[0].id,claims={sub:actor,role:'authenticated',session_id:session};await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims)]);await db.query('set local role authenticated');
  const op=crypto.randomUUID(),args=[op,type,MAX,'a'.repeat(64)];const prepared=(await db.query("select public.prepare_document_operation($1,'SELF_SERVICE',null,$2,'application/pdf',$3,$4,null,'FILE','') r",args)).rows[0].r;assert.equal(Number(prepared.size),MAX);
  await db.query('savepoint too_large');await assert.rejects(db.query("select public.prepare_document_operation($1,'SELF_SERVICE',null,$2,'application/pdf',$3,$4,null,'FILE','')",[crypto.randomUUID(),type,MAX+1,'a'.repeat(64)]),/INVALID_DOCUMENT_FILE/);await db.query('rollback to savepoint too_large');
  await db.query('savepoint foreign_context');await assert.rejects(db.query("select public.prepare_document_operation($1,'SELF_SERVICE',$2,$3,'application/pdf',$4,$5,null,'FILE','')",[crypto.randomUUID(),crypto.randomUUID(),type,MAX,'a'.repeat(64)]),/DOCUMENT_CONTEXT_DENIED/);await db.query('rollback to savepoint foreign_context');
  await db.query('reset role');await db.query('savepoint retained');await assert.rejects(db.query(body(recovery)),/RETAIN_ACCEPTED_DOCUMENTS/);await db.query('rollback to savepoint retained');
  await db.query('rollback to savepoint fixtures');await db.query(body(recovery));for(const f of before.functions)assert.equal((await db.query('select pg_get_functiondef($1::regprocedure) definition',[f.signature])).rows[0].definition,f.definition);
  assert.deepEqual(await fingerprint(),originals);await db.query(body(migration));await db.query('rollback');const out={status:'PASS',maxBytes:MAX,exactLimitAccepted:true,oneByteOverDenied:true,crossAffiliateDenied:true,aclOwnersPreserved:true,historyPreserved:originals,recoveryExact:true,recoveryRetainsAcceptedLargeFiles:true,migrationSha256:C.sha(fs.readFileSync(migration)),productionWrites:0};save(path.join(evidence,'database-tests.json'),out);console.log(JSON.stringify(out));
 }finally{await db.query('rollback');await db.end();}
}
module.exports={fixtures};
if(require.main===module)(async()=>{const mode=process.argv[2];if(mode==='stream')await physical();else if(mode==='database')await database();else throw Error('MODE_REQUIRED');})().catch(e=>{console.error(JSON.stringify({status:'FAIL',error:e.message,context:e.where,stack:e.stack}));process.exitCode=1;});
