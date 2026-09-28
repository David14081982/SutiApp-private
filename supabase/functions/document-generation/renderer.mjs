// No financial calculators: every value below is read from the sealed approval.
// Shared by the server worker, synthetic previews and isolated contract tests.
import {AFFILIATE_FIELDS} from './layout.mjs';
import {drawLayout} from './render-layout.mjs';
export const RENDERER_VERSION='pdf-lib-1.17.1/suti-1';
export const TITLES=Object.freeze({
 LOAN_APPROVAL:'Autorización de préstamo',PROGRAM_FINANCING_APPROVAL:'Financiamiento autorizado',MEMBERSHIP_APPROVAL:'Solicitud de membresía autorizada',
 SAVINGS_ENROLLMENT_APPROVAL:'Incorporación al ahorro autorizada',SAVINGS_CONTRIBUTION_CHANGE:'Cambio de aportación autorizado',
 SAVINGS_CESSATION_APPROVAL:'Cese de aportaciones autorizado',SAVINGS_WITHDRAWAL_APPROVAL:'Retiro de ahorro autorizado'
});
const present=v=>v!==undefined&&v!==null&&v!=='';
const money=v=>present(v)?new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:2}).format(Number(v)):null;
const date=v=>present(v)?String(v).slice(0,10):null;
const period=v=>({QUINCENAL:'Quincenal',MONTHLY:'Mensual',BIWEEKLY:'Quincenal',MENSUAL:'Mensual',JUB:'Mensual · jubilado','1':'Proceso 1 · quincenal','3':'Proceso 3 · quincenal'}[v]||v);
function required(v,name){if(!present(v))throw Error('DOCUMENT_REQUIRED_'+name);return v;}
function pairs(rows){return rows.filter(([,v])=>present(v));}
function finance(f){
 required(f,'FINANCIAL_SNAPSHOT');const r=required(f.financialResult,'FINANCIAL_RESULT');
 return pairs([['Fondo',r.fund],['Importe',money(required(r.amount,'AMOUNT'))],['Número de pagos',required(r.paymentCount,'PAYMENT_COUNT')],
 ['Periodicidad',period(r.paymentPeriod)],['Tasa aplicada',present(r.rate)?String(r.rate)+'%'+(r.ratePeriod?' · '+r.ratePeriod:''):null],
 ['Interés',money(r.interest)],['Cuota administrativa por pago',money(r.administrativeFeePerPayment)],['Cuota administrativa total',money(r.administrativeFeeTotal)],
 ['Total autorizado',money(r.total)],['Pago por periodo',money(r.paymentPerPeriod)],['Último pago',money(r.lastPayment)]]);
}
export function documentContract(snapshot){
 const type=required(snapshot.document_type,'TYPE'),o=required(snapshot.operation,'OPERATION'),i=required(snapshot.identity,'IDENTITY'),f=o.financial;
 if(!TITLES[type])throw Error('DOCUMENT_TYPE_NOT_SUPPORTED');
 const common=pairs([['Folio de solicitud',required(o.folio,'FOLIO')],['Solicitante',required(i.full_name,'NAME')],['Número de control',required(i.numero_control,'CONTROL')],['Programa',required(o.program,'PROGRAM')],['Fecha de autorización',date(required(o.approved_at,'APPROVED_AT'))],['Sindicato',i.union_label||i.union_code],['Categoría',i.category_label||i.category_code],['Adscripción registrada',i.unit]]);
 let sections=[],note='',schedule=null;
 switch(type){
 case 'PROGRAM_FINANCING_APPROVAL':
  required(f,'FINANCIAL_SNAPSHOT');required(f.product?.name,'PRODUCT');
  sections=[{title:'Producto y condiciones autorizadas',rows:pairs([['Producto',f.product.name],['Precio autorizado',money(required(f.authorized_price,'PRICE'))],['Enganche',money(required(f.down_payment,'DOWN_PAYMENT'))],['Monto financiado',money(required(f.financed_amount,'FINANCED_AMOUNT'))],['Origen del precio',f.price_source],['Condiciones de financiamiento',f.financing_conditions?.rate_source]])},{title:'Resumen financiero',rows:finance(f)}];
  schedule=required(f.payment_schedule,'PAYMENT_SCHEDULE');note='Se documentan las condiciones autorizadas de esta solicitud. Este documento no acredita entrega del bien ni pago realizado.';break;
 case 'LOAN_APPROVAL':
  sections=[{title:'Resumen financiero autorizado',rows:finance(f)}];schedule=f.payment_schedule||null;
  if(snapshot.bank)sections.push({title:'Referencia bancaria de la solicitud',rows:pairs([['Banco',snapshot.bank.bank_name],['Tarjeta',snapshot.bank.card_last4?'**** '+snapshot.bank.card_last4:null],['CLABE',snapshot.bank.clabe_last4?'************** '+snapshot.bank.clabe_last4:null]])});
  note='Autorización de la solicitud. No acredita depósito ni entrega de dinero.';break;
 case 'MEMBERSHIP_APPROVAL':
  sections=[{title:'Membresía solicitada',rows:pairs([['Empresa',f?.offering?.company_raw||f?.offering?.company],['Concepto',f?.offering?.concept]])},{title:'Plan autorizado',rows:finance(f)}];
  note='La solicitud fue autorizada. Este documento no acredita activación, vigencia ni renovación de la membresía.';break;
 case 'SAVINGS_ENROLLMENT_APPROVAL':
  sections=[{title:'Incorporación autorizada',rows:pairs([['Aportación autorizada',money(required(o.new_contribution_amount,'CONTRIBUTION'))],['Proceso y periodicidad',period(required(o.process,'PROCESS'))],['Fecha efectiva',date(required(o.effective_from,'EFFECTIVE_DATE'))],['Observación registrada',o.reason],['Excepción de fecha autorizada',o.date_exception]])}];
  note='Se autoriza la incorporación al ahorro en la fecha indicada. La aportación prevista no acredita dinero recibido.';break;
 case 'SAVINGS_CONTRIBUTION_CHANGE':
  sections=[{title:'Cambio de aportación',rows:pairs([['Aportación anterior',money(o.previous_contribution_amount)],['Nueva aportación',money(required(o.new_contribution_amount,'CONTRIBUTION'))],['Proceso y periodicidad',period(o.process)],['Fecha efectiva',date(required(o.effective_from,'EFFECTIVE_DATE'))],['Observación registrada',o.reason],['Excepción de fecha autorizada',o.date_exception]])}];
  note='Se autoriza el cambio de aportación desde la fecha indicada.';break;
 case 'SAVINGS_CESSATION_APPROVAL':
  sections=[{title:'Cese de aportaciones',rows:pairs([['Fecha efectiva',date(required(o.effective_from,'EFFECTIVE_DATE'))],['Motivo registrado',o.reason]])}];
  note='Se documenta únicamente el cese de aportaciones. No constituye retiro, liquidación ni entrega del saldo de ahorro.';break;
 case 'SAVINGS_WITHDRAWAL_APPROVAL':
  if(o.request_type!=='WITHDRAW'||o.withdrawal_kind==='EXTRAORDINARY')throw Error('DOCUMENT_EXTRAORDINARY_NOT_SUPPORTED');
  sections=[{title:'Retiro autorizado',rows:pairs([['Tipo de retiro',{PARTIAL:'Parcial',TOTAL:'Total'}[o.withdrawal_kind]||o.withdrawal_kind],['Monto solicitado',money(required(o.requested_amount,'REQUESTED_AMOUNT'))],['Monto autorizado',money(required(o.authorized_amount,'AUTHORIZED_AMOUNT'))],['Modalidad',{CAPITAL:'Capital',YIELD:'Rendimiento',BOTH:'Capital y rendimiento'}[o.component]||o.component],['Continuidad del ahorro',o.continue_saving===true?'Continúa ahorrando':o.continue_saving===false?'Cese posterior al retiro':null],['Motivo registrado',o.reason],['Excepción autorizada',o.authorized_exception||o.date_exception]])}];
  note='Se autoriza el retiro por el importe indicado. Este documento no acredita que el dinero haya sido entregado.';break;
 }
 return {title:TITLES[type],common,sections,note,schedule};
}

export function syntheticSnapshot(type,program,config){
 if(!TITLES[type])throw Error('DOCUMENT_TYPE_NOT_SUPPORTED');
 const financial={product:{name:'Producto de ejemplo'},offering:{company_raw:'Empresa de ejemplo',concept:'Membresía de ejemplo'},authorized_price:12000,down_payment:2000,financed_amount:10000,price_source:'PRICE_CASH',financialResult:{fund:'Fondo de ejemplo',rate:0,administrativeFeePerPayment:0,lastPayment:2500,amount:10000,paymentCount:4,paymentPeriod:'QUINCENAL',interest:0,administrativeFeeTotal:0,total:10000,paymentPerPeriod:2500},payment_schedule:{rows:[1,2,3,4].map((n)=>({number:n,date:'2026-10-'+String(n*5).padStart(2,'0'),payment:2500,remaining_total:10000-n*2500}))}};
 return {...config,document_type:type,contract_version:'1',renderer_version:RENDERER_VERSION,event_id:'PREVIEW',identity:{full_name:'Persona de ejemplo',numero_control:'EJEMPLO',union_label:'Sindicato de ejemplo',category_label:'Categoría de ejemplo',unit:'Unidad de ejemplo',affiliate:Object.fromEntries(AFFILIATE_FIELDS.map(([key,label])=>[key,label+' de ejemplo']))},operation:{id:'PREVIEW',folio:'VISTA PREVIA',program,approved_at:'2026-09-28T12:00:00Z',financial,new_contribution_amount:400,previous_contribution_amount:200,process:'1',effective_from:'2026-10-30',request_type:'WITHDRAW',withdrawal_kind:'PARTIAL',requested_amount:500,authorized_amount:500,component:'CAPITAL',continue_saving:true},
  bank:type==='LOAN_APPROVAL'?{bank_name:'BANCO DEMO',card_last4:'1234',clabe_last4:'5678'}:undefined,
  signers:(config.signers||[]).map((s,n)=>({...s,full_name:'Firmante de ejemplo '+(n+1),title:'Cargo de ejemplo',asset:null}))};
}

export function createRenderer(PDFLib){
 const {PDFDocument,StandardFonts,rgb}=PDFLib,mm=72/25.4;
 return async function render(snapshot,loadAsset,{preview=false,draft=false}={}){
  if(snapshot.renderer_version!==RENDERER_VERSION)throw Error('DOCUMENT_RENDERER_VERSION_UNSUPPORTED');
  const model=documentContract(snapshot),tpl=required(snapshot.template,'TEMPLATE'),signers=required(snapshot.signers,'SIGNERS');
  if(!Array.isArray(signers)||!signers.length)throw Error('DOCUMENT_SIGNERS_REQUIRED');
  const templateBytes=await loadAsset(tpl.asset),template=await PDFDocument.load(templateBytes,{updateMetadata:false});
  if(template.getPageCount()!==1)throw Error('DOCUMENT_TEMPLATE_SINGLE_PAGE_REQUIRED');
  const pdf=await PDFDocument.create(),base=template.getPage(0),{width,height}=base.getSize(),m=tpl.margins;
  const left=m.left*mm,right=width-m.right*mm,top=height-m.top*mm,bottom=m.bottom*mm;
  if(![left,right,top,bottom].every(Number.isFinite)||right-left<120||top-bottom<150)throw Error('DOCUMENT_SAFE_AREA_INVALID');
  const font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const background=base.node.Contents()?await pdf.embedPage(base):null,ink=rgb(.078,.129,.239),muted=rgb(.35,.39,.47),brand=rgb(.57,0,.133);
  const when=new Date(snapshot.operation.approved_at);if(!Number.isFinite(when.getTime()))throw Error('DOCUMENT_DATE_INVALID');
  pdf.setCreationDate(when);pdf.setModificationDate(when);pdf.setProducer(RENDERER_VERSION);pdf.setCreator('SutiApp');pdf.setTitle(model.title);
  if(snapshot.layout?.definition){const pages=await drawLayout({snapshot,model,pdf,PDFLib,background,width,height,loadAsset,preview,draft});return {bytes:await pdf.save({useObjectStreams:false,addDefaultPage:false,objectsPerTick:100}),pages};}
  let page,y;const pages=[];
  function newPage(){page=pdf.addPage([width,height]);pages.push(page);if(background)page.drawPage(background,{x:0,y:0,width,height});y=top;
   if(preview){page.drawText('VISTA PREVIA / DATOS DE EJEMPLO',{x:left,y:y-11,size:10,font:bold,color:brand});y-=24;}
   for(const titleLine of lines(model.title,right-left,11,bold)){page.drawText(titleLine,{x:left,y:y-11,size:11,font:bold,color:brand});y-=15;}y-=9;
  }
  function lines(value,maxWidth,size=10,f=font){
   const out=[];for(const paragraph of String(value).replace(/\r/g,'').split('\n')){let line='';for(const word of paragraph.split(/\s+/)){const candidate=line?line+' '+word:word;
    if(f.widthOfTextAtSize(candidate,size)<=maxWidth){line=candidate;continue;}if(line){out.push(line);line='';}
    let piece='';for(const ch of word){if(f.widthOfTextAtSize(piece+ch,size)>maxWidth){if(!piece)throw Error('DOCUMENT_GLYPH_TOO_WIDE');out.push(piece);piece='';}piece+=ch;}line=piece;
   }out.push(line);}return out;
  }
  function ensure(h){if(y-h<bottom+18)newPage();if(y-h<bottom+18)throw Error('DOCUMENT_BLOCK_TOO_TALL');}
  function paragraph(value,{size=10,f=font,color=ink,widthLimit=right-left}={}){for(const line of lines(value,widthLimit,size,f)){ensure(size+5);page.drawText(line,{x:left,y:y-size,size,font:f,color});y-=size+5;}}
  function heading(value){ensure(40);y-=8;paragraph(value,{size:11,f:bold,color:brand});}
  function fieldRows(rows){for(const [key,value] of rows)paragraph(key+': '+value);}
  newPage();fieldRows(model.common);paragraph(model.note,{color:muted});
  for(const section of model.sections){if(!section.rows.length)continue;heading(section.title);fieldRows(section.rows);}
  if(model.schedule){
   const rows=required(model.schedule.rows,'SCHEDULE_ROWS');if(!Array.isArray(rows)||!rows.length)throw Error('DOCUMENT_SCHEDULE_EMPTY');
   heading('Calendario autorizado');const widths=[.10,.27,.30,.33].map(n=>(right-left)*n);
   const header=()=>{ensure(24);let x=left;['Pago','Fecha','Importe','Saldo restante'].forEach((v,n)=>{page.drawText(v,{x,y:y-10,size:9,font:bold,color:brand});x+=widths[n];});y-=21;};header();
   for(const row of rows){const cells=[required(row.number,'ROW_NUMBER'),date(required(row.date,'ROW_DATE')),money(required(row.payment,'ROW_PAYMENT')),money(row.remaining_total)??''];
    const text=cells.map((v,n)=>lines(v,widths[n]-6,9)),h=Math.max(...text.map(a=>a.length))*13+6;if(y-h<bottom+18){newPage();header();}ensure(h);
    let x=left;text.forEach((cell,n)=>{cell.forEach((v,k)=>page.drawText(v,{x,y:y-10-k*13,size:9,font,color:ink}));x+=widths[n];});y-=h;
   }
  }
  heading('Firmas institucionales');
  // Flowing blocks support any number of signers; never clip names/titles or signatures.
  for(const s of signers){
   const labels=[required(s.full_name,'SIGNER_NAME'),required(s.title,'SIGNER_TITLE'),required(s.role,'SIGNER_ROLE')];
   const block=labels.flatMap(v=>lines(v,right-left,10));ensure(Math.min(55+block.length*15,top-bottom-70));
   if(!preview){const bytes=await loadAsset(required(s.asset,'SIGNATURE_ASSET'));const image=s.asset.mime==='image/png'?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);const scale=Math.min(140/image.width,38/image.height);page.drawImage(image,{x:left,y:y-38,width:image.width*scale,height:image.height*scale});}
   else page.drawText('Firma de ejemplo',{x:left,y:y-24,size:10,font,color:muted});
   y-=43;page.drawLine({start:{x:left,y},end:{x:Math.min(left+200,right),y},thickness:.5,color:ink});y-=4;block.forEach(v=>paragraph(v));y-=8;
  }
  pages.forEach((p,n)=>{const footer='SutiApp · Página '+(n+1)+' de '+pages.length;p.drawText(footer,{x:left,y:bottom+4,size:8,font,color:muted});});
  return {bytes:await pdf.save({useObjectStreams:false,addDefaultPage:false,objectsPerTick:100}),pages:pages.length};
 };
}
