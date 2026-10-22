'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..'),base=path.join(root,'.tmp/renta-car/edge');
async function main(){
 for(const slug of ['document-generation','financial-legacy']){const b=JSON.parse(fs.readFileSync(path.join(base,slug,'before.json')));fs.mkdirSync(path.join(base,slug,'before'),{recursive:true});for(const [n,s]of Object.entries(b.sources))fs.writeFileSync(path.join(base,slug,'before',n),s);}
 const module=(slug,stage,file)=>import(pathToFileURL(path.join(base,slug,stage,file)));
 const old=await module('document-generation','before','renderer.mjs'),next=await module('document-generation','candidate','renderer.mjs'),oldLayout=await module('document-generation','before','layout.mjs'),nextLayout=await module('document-generation','candidate','layout.mjs');
 const PDFLib=require(path.join(root,'.tmp/renta-car/deps/node_modules/pdf-lib')),doc=await PDFLib.PDFDocument.create();doc.addPage([612,792]);const bytes=await doc.save();
 const config={template:{id:"synthetic-template",asset:{},page_size:{width:612,height:792},margins:{top:25,bottom:25,left:20,right:20}},signers:[{full_name:'Persona de prueba',title:'Prueba',role:'Autoriza'}]};
 const pdfs=[];for(const type of Object.keys(old.TITLES)){
  const snapshot=old.syntheticSnapshot(type,'auto',config);assert.deepEqual(next.documentContract(snapshot),old.documentContract(snapshot));assert.deepEqual(nextLayout.layoutFields(type),oldLayout.layoutFields(type));
  const a=await old.createRenderer(PDFLib)(snapshot,async()=>bytes,{preview:true}),b=await next.createRenderer(PDFLib)(snapshot,async()=>bytes,{preview:true});assert.equal(Buffer.compare(a.bytes,b.bytes),0,'Existing PDF changed: '+type);pdfs.push(type);
 }
 const rental=next.syntheticSnapshot('RENTA_CAR_APPROVAL','renta',config),renderRental=next.createRenderer(PDFLib);
 const rentalPdf=await renderRental(rental,async()=>bytes,{preview:true});rental.signature_data='data:image/png;base64,NOT_AN_IMAGE';rental.identity.signature_data=rental.signature_data;const signed=await renderRental(rental,async()=>bytes,{preview:true});assert.equal(Buffer.compare(rentalPdf.bytes,signed.bytes),0);
 const parsed=await PDFLib.PDFDocument.load(rentalPdf.bytes),streams=parsed.getPages().flatMap(p=>p.node.Contents().asArray().map(ref=>Buffer.from(PDFLib.decodePDFRawStream(parsed.context.lookup(ref)).decode()).toString())).join('\n').toUpperCase();assert(streams.includes(Buffer.from('$5,000.00').toString('hex').toUpperCase()),'RENTAL_TOTAL_NOT_RENDERED');
 fs.writeFileSync(path.join(root,'docs/qa/evidence/renta-car/live-renderer-rental-preview.pdf'),rentalPdf.bytes);
 const prior=await module('financial-legacy','before','request-google-sync.js'),after=await module('financial-legacy','candidate','request-google-sync.js');
 const programs=['prestamo','caja','nomina','auto','casa','terrenos','aires','puertas','tours','solar','computo','farma','donativos','cirugias','membership'];
 for(const program_id of programs){const request={id:'synthetic',program_id,numero_control:'00001',created_at:'2026-10-22T09:30:00Z',financial_submission_snapshot:{contract_version:program_id==='membership'?'MEMBERSHIP_PAYMENT_V1':'PROGRAM_PRODUCT_PAYMENT_V1',offering:{company:'Empresa de prueba'},financialResult:{fund:'Fondo sintético',amount:10000,rate:3,paymentCount:4,total:11200}},notes:'Nota sintética'};assert.deepEqual(after.buildRequestRegisterRow(request,[],null),prior.buildRequestRegisterRow(request,[],null));}
 const result={status:'PASS',existingPdfsByteIdentical:pdfs,rentalTotalRendered:true,rentalPdfIgnoresDigitalSignature:true,otherProgramsRegisterIdentical:programs,productionDataWrites:0};fs.writeFileSync(path.join(root,'docs/qa/evidence/renta-car/release-parity.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
