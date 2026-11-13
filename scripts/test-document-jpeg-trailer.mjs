// Synthetic fixtures only. No production writes or private document bytes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const require=createRequire(import.meta.url),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const deps=process.env.SUTIAPP_DOCUMENT_TEST_DEPS||path.resolve(root,'../../.tmp/document-architecture-lab/deps/node_modules');
const jpeg=require(path.join(deps,'jpeg-js')),{PNG}=require(path.join(deps,'pngjs'));
const parserRoot=process.env.DOCUMENT_PARSER_ROOT||root;
const {verifyDocumentStream,DOCUMENT_MAX_BYTES}=await import(pathToFileURL(path.join(parserRoot,'supabase/functions/_shared/document-stream.mjs')));
const {documentError,documentOperation}=await import(pathToFileURL(path.join(parserRoot,'supabase/functions/_shared/document-integration.mjs')));
const sha=b=>createHash('sha256').update(b).digest('hex'),checks=[];
async function check(name,fn){try{await fn();checks.push({name,status:'PASS'});}catch(e){checks.push({name,status:'FAIL',error:e.message});}}
const image=jpeg.encode({width:4,height:4,data:Buffer.alloc(64,150)},85).data;
const trailers=[Buffer.from('SEFT\0Samsung synthetic metadata\0SEFH'),Buffer.alloc(20,7),image,Buffer.alloc(1024*1024,42)];
function stream(bytes,chunk=65536){let at=0;return new ReadableStream({pull(c){if(at===bytes.length)return c.close();const end=Math.min(bytes.length,at+chunk);c.enqueue(bytes.subarray(at,end));at=end;}});}
const verify=(bytes,chunk=65536,hash=sha(bytes),size=bytes.length,mime='image/jpeg',options)=>verifyDocumentStream(stream(bytes,chunk),mime,hash,size,options);
await check('ordinary JPEG',async()=>assert.equal((await verify(image)).verified,true));
for(const [i,tail]of trailers.entries())for(const chunk of [1,7,65536])await check(`JPEG trailer ${i}, chunk ${chunk}`,async()=>{
 const bytes=Buffer.concat([image,tail]),result=await verify(bytes,chunk);
 assert.equal(result.sha256,sha(bytes));assert.equal(result.size,bytes.length);
 if(tail.length<2000)assert.equal(jpeg.decode(bytes).width,4);
});
await check('trailer participates in hash',async()=>{const bytes=Buffer.concat([image,trailers[0]]);await assert.rejects(verify(bytes,7,sha(image)),/BYTE_INTEGRITY_MISMATCH/);});
await check('declared size excludes trailer',async()=>{const bytes=Buffer.concat([image,trailers[0]]);await assert.rejects(verify(bytes,7,sha(bytes),image.length),/BYTE_INTEGRITY_MISMATCH/);});
await check('declared size exceeds object',async()=>await assert.rejects(verify(image,7,sha(image),image.length+1),/BYTE_INTEGRITY_MISMATCH/));
await check('missing EOI',async()=>await assert.rejects(verify(image.subarray(0,-2),7),/TRUNCATED_DOCUMENT/));
await check('truncated segment',async()=>await assert.rejects(verify(image.subarray(0,18),1),/TRUNCATED_DOCUMENT/));
await check('EOI without frame/scan',async()=>await assert.rejects(verify(Buffer.from([255,216,255,217])),/INVALID_JPEG/));
await check('oversized dimensions',async()=>{const bytes=Buffer.from(image),i=bytes.indexOf(Buffer.from([255,192]));assert(i>0);bytes.writeUInt16BE(65535,i+5);bytes.writeUInt16BE(65535,i+7);await assert.rejects(verify(bytes),/INVALID_IMAGE_DIMENSIONS/);});
await check('100MB cap unchanged',async()=>await assert.rejects(verify(image,7,sha(image),DOCUMENT_MAX_BYTES+1),/INVALID_DOCUMENT_FILE/));
await check('PNG CRC rejection unchanged',async()=>{const png=new PNG({width:2,height:2});png.data.fill(150);const bytes=PNG.sync.write(png);bytes[29]^=1;await assert.rejects(verify(bytes,7,sha(bytes),bytes.length,'image/png'),/INVALID_PNG_CRC/);});
await check('existingRead preserves original formats and verifies hash',async()=>{const bytes=Buffer.from('synthetic historic Office original');assert.equal((await verify(bytes,7,sha(bytes),bytes.length,'application/msword',{existingRead:true})).verified,true);await assert.rejects(verify(bytes,7,'0'.repeat(64),bytes.length,'application/msword',{existingRead:true}),/BYTE_INTEGRITY_MISMATCH/);});
await check('all deterministic parser errors are 422 terminal',()=>{for(const code of ['INVALID_DOCUMENT_FILE','INVALID_DOCUMENT_TRAILER','TRUNCATED_DOCUMENT','INVALID_IMAGE_DIMENSIONS','UNSUPPORTED_MIME','BYTE_INTEGRITY_MISMATCH','INVALID_PNG_CRC','INVALID_PNG_DATA','INVALID_PNG_FILTER','INVALID_PNG_CHUNK','INVALID_PNG','INVALID_JPEG','INVALID_WEBP','INVALID_PDF'])assert.deepEqual(documentError(Error(code)),{status:422,body:{error:code,recoverable:false}});});
await check('transient byte access remains recoverable',()=>assert.equal(documentError(Error('DOCUMENT_BYTES_UNAVAILABLE')).body.recoverable,true));
await check('permission denial remains 403',()=>assert.equal(documentError({code:'42501',message:'denied'}).status,403));
const operation='10000000-0000-4000-8000-000000000001';
async function complete(bytes,{denied=false,changed=false}={}){
 let writes=0,reads=0,fetches=0;const descriptor={bucket:'private-assets',path:'synthetic.jpg',mime:'image/jpeg',size:bytes.length,sha256:sha(bytes)};
 const user={rpc:async()=>{reads++;return denied?{error:{code:'42501',message:'DENIED'}}:{data:changed&&reads>1?{...descriptor,sha256:'0'.repeat(64)}:descriptor};}};
 const service={storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:'https://synthetic.invalid/object'}})})},rpc:async(name,args)=>{assert.equal(name,'complete_document_operation');assert.equal(args.p_receipt.sha256,sha(bytes));writes++;return{data:{status:'COMPLETE',document:{id:operation}}};}};
 const original=globalThis.fetch;globalThis.fetch=async()=>{fetches++;return new Response(stream(bytes,7));};
 try{return{result:await documentOperation({action:'COMPLETE',operation_id:operation},user,service),writes,fetches};}finally{globalThis.fetch=original;}
}
await check('COMPLETE registers appended JPEG after verification',async()=>{const r=await complete(Buffer.concat([image,trailers[0]]));assert.equal(r.result.status,200);assert.equal(r.writes,1);});
await check('COMPLETE rejects truncation without registration',async()=>{const r=await complete(image.subarray(0,-2));assert.equal(r.result.status,422);assert.equal(r.result.body.recoverable,false);assert.equal(r.writes,0);});
await check('COMPLETE denied before reading bytes',async()=>{const r=await complete(image,{denied:true});assert.equal(r.result.status,403);assert.equal(r.fetches,0);assert.equal(r.writes,0);});
await check('COMPLETE context recheck prevents registration',async()=>{const r=await complete(image,{changed:true});assert.equal(r.result.status,409);assert.equal(r.writes,0);});
const result={status:checks.every(c=>c.status==='PASS')?'PASS':'FAIL',syntheticOnly:true,checks};
const out=process.env.DOCUMENT_TEST_OUT||path.join(root,'docs/qa/evidence/document-jpeg-trailer/stream.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(result.status!=='PASS')process.exitCode=1;
