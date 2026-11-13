// Bounded-memory physical verification. Never trust a client receipt.
import {createHash} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {createCRC32} from './document-crc.mjs';
export const DOCUMENT_MAX_BYTES=100*1024*1024;
const fail=code=>{throw new Error(code);};
const pixels=(w,h)=>{if(!w||!h||w*h>24000000)fail('INVALID_IMAGE_DIMENSIONS');};

// Pull only the bytes needed by a structural parser. Buffered transport data is
// bounded by its incoming chunk, not by total object size.
class Reader {
 constructor(stream,expected,hash){this.reader=stream.getReader();this.expected=expected;this.hash=hash;this.buffer=new Uint8Array();this.offset=0;this.total=0;this.consumed=0;this.ended=false;this.peak=0;}
 async piece(max){if(this.offset===this.buffer.length){const {value,done}=await this.reader.read();if(done){this.ended=true;return null;}this.buffer=value;this.offset=0;this.total+=value.length;this.peak=Math.max(this.peak,value.length);if(this.total>this.expected||this.total>DOCUMENT_MAX_BYTES)fail('BYTE_INTEGRITY_MISMATCH');this.hash.update(value);}
  const n=Math.min(max,this.buffer.length-this.offset),part=this.buffer.subarray(this.offset,this.offset+n);this.offset+=n;this.consumed+=n;return part;
 }
 async bytes(n){const out=Buffer.alloc(n);let at=0;while(at<n){const p=await this.piece(n-at);if(!p)fail('TRUNCATED_DOCUMENT');out.set(p,at);at+=p.length;}return out;}
 async skip(n,visit){while(n>0){const p=await this.piece(Math.min(n,65536));if(!p)fail('TRUNCATED_DOCUMENT');if(visit)await visit(p);n-=p.length;}}
 async drain(visit){for(;;){const p=await this.piece(65536);if(!p)break;if(visit)await visit(p);}}
 async end(){if(await this.piece(1))fail('INVALID_DOCUMENT_TRAILER');}
 async close(){await this.reader.cancel().catch(()=>{});this.reader.releaseLock();}
}

async function png(r){
 const checksum=await createCRC32();
 if(!(await r.bytes(8)).equals(Buffer.from([137,80,78,71,13,10,26,10])))fail('INVALID_PNG');
 let header=false,data=false,closedData=false,done=false,width,height,depth,color,interlace,inflate,writer,inflated=0,expected=0;
 let inflationError;
 while(!done){const h=await r.bytes(8),n=h.readUInt32BE(0),kind=h.toString('ascii',4);if(n>r.expected-r.consumed-4||!/^[A-Za-z]{4}$/.test(kind))fail('INVALID_PNG');checksum.init();checksum.update(h.subarray(4));
  if(!header&&kind!=='IHDR')fail('INVALID_PNG');
  if(kind==='IHDR'){
   if(header||n!==13)fail('INVALID_PNG');const b=await r.bytes(n);checksum.update(b);width=b.readUInt32BE(0);height=b.readUInt32BE(4);pixels(width,height);depth=b[8];color=b[9];interlace=b[12];
   const channels={0:1,2:3,3:1,4:2,6:4}[color];if(!channels||![1,2,4,8,16].includes(depth)||b[10]||b[11]||interlace>1||color===3&&depth===16||[2,4,6].includes(color)&&depth<8)fail('INVALID_PNG');
   const passes=interlace?[[0,0,8,8],[4,0,8,8],[0,4,4,8],[2,0,4,4],[0,2,2,4],[1,0,2,2],[0,1,1,2]]:[[0,0,1,1]];
   const rows=[];for(const[x,y,dx,dy]of passes){const w=Math.max(0,Math.ceil((width-x)/dx)),h=Math.max(0,Math.ceil((height-y)/dy));if(w&&h){const length=1+Math.ceil(w*channels*depth/8);rows.push({length,count:h});expected+=length*h;}}
   const ds=new DecompressionStream('deflate');writer=ds.writable.getWriter();
   inflate=(async()=>{let pass=0,row=0,offset=0;for await(const part of ds.readable){inflated+=part.length;if(inflated>expected)fail('INVALID_PNG_DATA');for(let at=0;at<part.length;){if(pass>=rows.length)fail('INVALID_PNG_DATA');if(offset===0&&part[at]>4)fail('INVALID_PNG_FILTER');const take=Math.min(part.length-at,rows[pass].length-offset);at+=take;offset+=take;if(offset===rows[pass].length){offset=0;if(++row===rows[pass].count){row=0;pass++;}}}}})().catch(e=>{inflationError=e;});header=true;
  }else if(kind==='IDAT'){
   if(closedData)fail('INVALID_PNG');data=true;await r.skip(n,async b=>{checksum.update(b);if(inflationError)throw inflationError;await writer.write(b);});
  }else {if(data)closedData=true;if(kind==='IEND'){if(n!==0||!data)fail('INVALID_PNG');done=true;}else if(kind[0]===kind[0].toUpperCase()&&!['PLTE'].includes(kind))fail('INVALID_PNG_CHUNK');await r.skip(n,b=>{checksum.update(b);});}
  if(parseInt(checksum.digest(),16)!==(await r.bytes(4)).readUInt32BE(0))fail('INVALID_PNG_CRC');
 }
 await writer.close();await inflate;if(inflationError||inflated!==expected)fail('INVALID_PNG_DATA');await r.end();
}
async function jpeg(r){
 if((await r.bytes(2)).readUInt16BE(0)!==0xffd8)fail('INVALID_JPEG');let frame=false,scan=false,entropy=false,pending=null;
 for(;;){let marker=pending;pending=null;
  if(entropy){for(;;){const part=await r.piece(65536);if(!part)fail('TRUNCATED_DOCUMENT');const at=part.indexOf(255);if(at<0)continue;const unread=part.length-at-1;r.offset-=unread;r.consumed-=unread;let m;do{m=(await r.bytes(1))[0];}while(m===255);if(m===0||m>=208&&m<=215)continue;marker=m;entropy=false;break;}}
  if(marker===null){if((await r.bytes(1))[0]!==255)fail('INVALID_JPEG');do{marker=(await r.bytes(1))[0];}while(marker===255);}
  // Phones may append metadata or a secondary image after the primary EOI.
  // Drain, rather than ignore, it so size and SHA-256 still cover ALL bytes.
  if(marker===217){if(!frame||!scan)fail('INVALID_JPEG');await r.drain();return;}
  if(marker===216||marker===0||marker>=208&&marker<=215)fail('INVALID_JPEG');
  const n=(await r.bytes(2)).readUInt16BE(0)-2;if(n<0)fail('INVALID_JPEG');
  if([192,193,194].includes(marker)){if(n<6)fail('INVALID_JPEG');const b=await r.bytes(6);pixels(b.readUInt16BE(3),b.readUInt16BE(1));if(b[0]!==8||![1,3,4].includes(b[5])||n!==6+3*b[5])fail('INVALID_JPEG');frame=true;await r.skip(n-6);}
  else if(marker===218){if(!frame||n<4)fail('INVALID_JPEG');await r.skip(n);scan=true;entropy=true;}
  else await r.skip(n);
 }
}
async function webp(r){
 const h=await r.bytes(12);if(h.toString('ascii',0,4)!=='RIFF'||h.toString('ascii',8)!=='WEBP'||h.readUInt32LE(4)+8!==r.expected)fail('INVALID_WEBP');let frame=false,dimensions=false,first=true;
 while(r.consumed<r.expected){const ch=await r.bytes(8),kind=ch.toString('ascii',0,4),n=ch.readUInt32LE(4);if(n+(n%2)>r.expected-r.consumed||first&&!['VP8X','VP8 ','VP8L'].includes(kind))fail('INVALID_WEBP');first=false;
  const take=Math.min(n,10),b=await r.bytes(take);
  if(kind==='VP8X'){if(n!==10)fail('INVALID_WEBP');pixels(b.readUIntLE(4,3)+1,b.readUIntLE(7,3)+1);dimensions=true;}
  if(kind==='VP8 '){if(n<10||b.toString('hex',3,6)!=='9d012a')fail('INVALID_WEBP');pixels(b.readUInt16LE(6)&16383,b.readUInt16LE(8)&16383);frame=dimensions=true;}
  if(kind==='VP8L'){if(n<5||b[0]!==47)fail('INVALID_WEBP');const bits=b.readUInt32LE(1);pixels((bits&16383)+1,((bits>>>14)&16383)+1);frame=dimensions=true;}
  if(kind==='ANMF')frame=true;
  await r.skip(n-take+(n%2));
 }if(!frame||!dimensions)fail('INVALID_WEBP');await r.end();
}
async function pdf(r){
 const head=await r.bytes(8);if(!/^%PDF-(1\.[0-7]|2\.0)/.test(head.toString('ascii')))fail('INVALID_PDF');
 let tail=Buffer.from(head),objects=false,pages=false,root=false,previous='';
 const decode=new TextDecoder('windows-1252');
 await r.drain(part=>{const b=Buffer.from(part.buffer,part.byteOffset,part.byteLength);if(!objects||!pages||!root){const s=previous+decode.decode(b);objects ||= /\d+\s+\d+\s+obj\b/.test(s);pages ||= /\/Type\s*\/(?:Page|ObjStm)\b/.test(s);root ||= /\/Root\s+\d+\s+\d+\s+R/.test(s);previous=s.slice(-256);}tail=b.length>=4096?Buffer.from(b.subarray(-4096)):Buffer.concat([tail,b]).subarray(-4096);});
 const end=tail.toString('latin1'),matches=[...end.matchAll(/startxref\s+(\d+)\s+%%EOF/g)],last=matches.at(-1);if(!objects||!pages||!root||!last||Number(last[1])>=r.expected||!/^\s*$/.test(end.slice(last.index+last[0].length)))fail('INVALID_PDF');
}
export async function verifyDocumentStream(stream,mime,sha256,size,{existingRead=false}={}){
 size=Number(size);if(!Number.isSafeInteger(size)||size<1||size>DOCUMENT_MAX_BYTES||!/^[a-f0-9]{64}$/.test(sha256||''))fail('INVALID_DOCUMENT_FILE');
 const hash=createHash('sha256'),r=new Reader(stream,size,hash);
 try{if(existingRead)await r.drain();else if(mime==='image/png')await png(r);else if(mime==='image/jpeg')await jpeg(r);else if(mime==='image/webp')await webp(r);else if(mime==='application/pdf')await pdf(r);else fail('UNSUPPORTED_MIME');
  const actual=hash.digest('hex');if(r.total!==size||actual!==sha256)fail('BYTE_INTEGRITY_MISMATCH');return{verified:true,integrityVerified:true,sha256:actual,size,mime,verified_at:new Date().toISOString()};
 }finally{await r.close();}
}
export async function verifyStoredDocument(service,d,options={}){
 const signed=await service.storage.from(d.bucket).createSignedUrl(d.path,180);if(signed.error||!signed.data?.signedUrl)fail('DOCUMENT_BYTES_UNAVAILABLE');
 const response=await fetch(signed.data.signedUrl,{signal:AbortSignal.timeout(120000),cache:'no-store'});if(!response.ok||!response.body)fail('DOCUMENT_BYTES_UNAVAILABLE');
 return verifyDocumentStream(response.body,d.mime,d.sha256,Number(d.size),options);
}
