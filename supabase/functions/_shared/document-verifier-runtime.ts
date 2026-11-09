// Pinned codecs with packaged WASM bytes; no runtime filesystem dependency.
import {PNG} from 'npm:pngjs@7.0.0';
import jpeg from 'npm:jpeg-js@0.4.4';
import {PDFDocument} from 'npm:pdf-lib@1.17.1';
import decode,{init} from 'npm:@jsquash/webp@1.5.0/decode.js';
import {base64} from './webp-decoder-bytes.mjs';
import {documentVerifier} from './document-verification.mjs';
let ready:Promise<unknown>|undefined;
export async function candidateDocumentVerifier(){
 ready ||= (async()=>{await init(await WebAssembly.compile(Uint8Array.from(atob(base64),c=>c.charCodeAt(0))));})();
 await ready;
 return documentVerifier({PNG,jpeg,PDFDocument,webp:decode});
}
