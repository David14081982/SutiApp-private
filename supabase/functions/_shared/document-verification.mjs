// Same physical validation algorithm exercised in phases 0-3. Dependencies are injected, not mocked.
import {Buffer} from 'node:buffer';
import {createHash} from 'node:crypto';
export function documentVerifier({PNG,jpeg,PDFDocument,webp}){
const hash=b=>createHash('sha256').update(b).digest('hex');
const fail=code=>{throw Error(code);};
return async function validate(bytes,mime,expected,size,{existingRead=false}={}){
 if(bytes.length!==Number(size)||hash(bytes)!==expected)fail('BYTE_INTEGRITY_MISMATCH');
 // Existing evidence retains the exact bytes originally registered. Decoding
 // limits for new uploads must not prevent access to a protected original.
 // This mode is selected only by the server's read handler, never its payload.
 if(existingRead) return {integrityVerified:true,sha256:hash(bytes),size:bytes.length,mime};
 if(mime==='image/png') { if(bytes.length<24||bytes.readUInt32BE(16)*bytes.readUInt32BE(20)>24000000)fail('INVALID_PNG_DIMENSIONS');const p=PNG.sync.read(bytes,{checkCRC:true});if(!p.width||!p.height)fail('INVALID_PNG'); }
 else if(mime==='image/jpeg') { const p=jpeg.decode(bytes,{maxResolutionInMP:24,maxMemoryUsageInMB:128});if(!p.width||!p.height||bytes.at(-2)!==255||bytes.at(-1)!==217)fail('INVALID_JPEG'); }
 else if(mime==='image/webp') {
  if(bytes.length<20||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP'||bytes.readUInt32LE(4)+8!==bytes.length)fail('INVALID_WEBP');
  let width=0,height=0,offset=12;
  while(offset<bytes.length){if(offset+8>bytes.length)fail('INVALID_WEBP');const kind=bytes.toString('ascii',offset,offset+4),length=bytes.readUInt32LE(offset+4),at=offset+8;if(at+length+(length%2)>bytes.length)fail('INVALID_WEBP');
   if(kind==='VP8X'){if(length!==10)fail('INVALID_WEBP');width=bytes.readUIntLE(at+4,3)+1;height=bytes.readUIntLE(at+7,3)+1;}
   if(kind==='VP8 '&&!width){if(length<10||bytes.toString('hex',at+3,at+6)!=='9d012a')fail('INVALID_WEBP');width=bytes.readUInt16LE(at+6)&16383;height=bytes.readUInt16LE(at+8)&16383;}
   if(kind==='VP8L'&&!width){if(length<5||bytes[at]!==47)fail('INVALID_WEBP');const bits=bytes.readUInt32LE(at+1);width=(bits&16383)+1;height=((bits>>>14)&16383)+1;}
   if(width*height>24000000)fail('INVALID_WEBP_DIMENSIONS');offset=at+length+(length%2);
  }
  if(!width||!height||!webp)fail('INVALID_WEBP');const image=await webp(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));if(!image||image.width!==width||image.height!==height)fail('INVALID_WEBP');
 }
 else if(mime==='application/pdf') {if(!bytes.subarray(0,5).equals(Buffer.from('%PDF-'))||!bytes.subarray(-1024).includes(Buffer.from('%%EOF')))fail('INVALID_PDF');const p=await PDFDocument.load(bytes,{ignoreEncryption:false,throwOnInvalidObject:true});if(p.getPageCount()<1)fail('INVALID_PDF');}
 else fail('UNSUPPORTED_MIME');
 return {verified:true,sha256:hash(bytes),size:bytes.length,mime,verified_at:new Date().toISOString()};
};
}
