// The presentation extension of the seven existing snapshot contracts. No request values persist here.
export const LAYOUT_VERSION='suti-layout-3';
const f=(key,label,format='TEXT',required=false,group='Datos generales')=>({key,label,format,required,group,kind:'FIELD'});
const financial=[f('operation.financial.financialResult.fund','Fondo','TEXT',false,'Financiamiento'),
 ...[['amount','Monto autorizado','MONEY',true],['paymentCount','Número de pagos','INTEGER',true],['paymentPeriod','Periodicidad','TEXT'],['rate','Tasa aplicada','PERCENT'],['interest','Total de intereses','MONEY'],['administrativeFeePerPayment','Cuota administrativa por pago','MONEY'],['administrativeFeeTotal','Cuota administrativa total','MONEY'],['total','Total autorizado','MONEY'],['paymentPerPeriod','Pago por periodo','MONEY'],['lastPayment','Último pago','MONEY']].map(([k,l,t,r])=>f('operation.financial.financialResult.'+k,l,t,r||false,'Financiamiento'))];
export const AFFILIATE_FIELDS=[['rfc','RFC'],['curp','CURP'],['phone','Teléfono registrado'],['email','Correo registrado'],['address','Domicilio'],['city','Ciudad'],['employment_position','Puesto'],['employment_area','Área de trabajo'],['employment_level','Nivel laboral'],['occupation','Ocupación'],['subdirectorate','Subdirección'],['employment_entry_date','Fecha de ingreso laboral'],['institute_entry_date','Fecha de ingreso al instituto'],['union_position','Cargo sindical'],['union_enrollment_date','Fecha de afiliación sindical']];
export function layoutFields(type,version=LAYOUT_VERSION){
 const fields=[f('identity.full_name','Beneficiario','TEXT',true),f('identity.numero_control','Número de control','TEXT',true),f('operation.folio','Folio','TEXT',true),f('operation.program','Programa','TEXT',true),f('operation.approved_at','Fecha de autorización','DATE',true),f('identity.union','Sindicato'),f('identity.category','Categoría'),f('identity.unit','Adscripción')];
 if(version!=='suti-layout-1')fields.push(f('document.title','Título del documento'));
 if(version==='suti-layout-1')fields.push(f('document.note','Alcance de la autorización','TEXT',true));
 else fields.push(...AFFILIATE_FIELDS.map(([key,label])=>f('identity.affiliate.'+key,label,'TEXT',false,'Base de afiliados')));
 const add=(key,label,format='TEXT',required=false)=>fields.push(f(key,label,format,required,'Datos del documento'));
 if(['LOAN_APPROVAL','PROGRAM_FINANCING_APPROVAL','MEMBERSHIP_APPROVAL'].includes(type))fields.push(...financial);
 switch(type){
 case 'LOAN_APPROVAL': add('bank.bank_name','Banco');if(version===LAYOUT_VERSION){add('bank.card_number','Tarjeta de depósito completa');add('bank.clabe','CLABE completa');add('bank.account_holder','Titular de la cuenta');}else{add('bank.card_last4','Tarjeta (últimos 4 dígitos)','MASKED_BANK_ACCOUNT');add('bank.clabe_last4','CLABE (últimos 4 dígitos)','MASKED_BANK_ACCOUNT');}break;
 case 'PROGRAM_FINANCING_APPROVAL': for(const [k,l,t] of [['product.name','Producto','TEXT'],['authorized_price','Precio autorizado','MONEY'],['down_payment','Enganche','MONEY'],['financed_amount','Monto financiado','MONEY']])add('operation.financial.'+k,l,t,true);add('operation.financial.price_source','Origen del precio');add('operation.financial.financing_conditions.rate_source','Condiciones de financiamiento');break;
 case 'MEMBERSHIP_APPROVAL':add('operation.financial.offering.company','Empresa');add('operation.financial.offering.concept','Concepto');break;
 case 'SAVINGS_ENROLLMENT_APPROVAL':add('operation.new_contribution_amount','Aportación autorizada','MONEY',true);add('operation.process','Proceso y periodicidad','TEXT',true);add('operation.effective_from','Fecha efectiva','DATE',true);add('operation.reason','Observación registrada');add('operation.date_exception','Excepción de fecha autorizada');break;
 case 'SAVINGS_CONTRIBUTION_CHANGE':add('operation.previous_contribution_amount','Aportación anterior','MONEY');add('operation.new_contribution_amount','Nueva aportación','MONEY',true);add('operation.process','Proceso y periodicidad');add('operation.effective_from','Fecha efectiva','DATE',true);add('operation.reason','Observación registrada');add('operation.date_exception','Excepción de fecha autorizada');break;
 case 'SAVINGS_CESSATION_APPROVAL':add('operation.effective_from','Fecha efectiva','DATE',true);add('operation.reason','Motivo registrado');break;
 case 'SAVINGS_WITHDRAWAL_APPROVAL':add('operation.withdrawal_kind','Tipo de retiro');add('operation.requested_amount','Monto solicitado','MONEY',true);add('operation.authorized_amount','Monto autorizado','MONEY',true);add('operation.component','Modalidad');add('operation.continue_saving','Continuidad del ahorro');add('operation.reason','Motivo registrado');add('operation.exception','Excepción autorizada');break;
 default:throw Error('DOCUMENT_TYPE_NOT_SUPPORTED');
 }
 fields.push({key:'signers',label:'Firmantes',kind:'SIGNERS',required:true,group:'Bloques'});
 if(['LOAN_APPROVAL','PROGRAM_FINANCING_APPROVAL'].includes(type))fields.push({key:'payment_schedule',label:'Calendario de pagos',kind:'PAYMENT_SCHEDULE',required:type==='PROGRAM_FINANCING_APPROVAL',group:'Bloques'});
 return fields;
}
export function fieldValue(snapshot,key,model){
 const o=snapshot.operation,i=snapshot.identity;
 if(key==='document.note')return model.note;
 if(key==='document.title')return model.title;
 if(key==='identity.union')return i.union_label||i.union_code;
 if(key==='identity.category')return i.category_label||i.category_code;
 if(key==='operation.financial.offering.company')return o.financial?.offering?.company_raw||o.financial?.offering?.company;
 if(key==='operation.exception')return o.authorized_exception||o.date_exception;
 const raw=key.split('.').reduce((v,k)=>v?.[k],snapshot);
 if(key==='operation.process'||key.endsWith('.paymentPeriod'))return ({'1':'Proceso 1 · quincenal','3':'Proceso 3 · quincenal',JUB:'Mensual · jubilado',QUINCENAL:'Quincenal',BIWEEKLY:'Quincenal',MONTHLY:'Mensual',MENSUAL:'Mensual'})[raw]||raw;
 if(key==='operation.withdrawal_kind')return ({PARTIAL:'Parcial',TOTAL:'Total'})[raw]||raw;
 if(key==='operation.component')return ({CAPITAL:'Capital',YIELD:'Rendimiento',BOTH:'Capital y rendimiento'})[raw]||raw;
 if(key==='operation.continue_saving')return raw===true?'Continúa ahorrando':raw===false?'Cese posterior al retiro':null;
 return raw;
}
export function formatField(value,format,missing='hide'){
 if(value===null||value===undefined||value==='')return missing==='na'?'No aplica':missing==='empty'?'':null;
 if(format==='TEXT')return String(value);
 if(format==='MASKED_BANK_ACCOUNT')return '**** '+String(value).slice(-4);
 if(format==='DATE'){const d=new Date(String(value).slice(0,10)+'T12:00:00Z');if(!Number.isFinite(d.getTime()))throw Error('DOCUMENT_LAYOUT_DATE_INVALID');return new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(d);}
 if(!Number.isFinite(Number(value)))throw Error('DOCUMENT_LAYOUT_NUMBER_INVALID');
 if(format==='MONEY')return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(value));
 if(format==='PERCENT')return Number(value).toFixed(2)+' %';
 if(format==='INTEGER')return String(Math.trunc(Number(value)));
 throw Error('DOCUMENT_LAYOUT_FORMAT_INVALID');
}
// Only explicitly disclosed, frozen deposit snapshots can expand older layout bindings.
export function boundField(snapshot,element,model){
 const aliases={'bank.card_last4':'card_number','bank.clabe_last4':'clabe'};
 if(snapshot.bank?.disclosure==='FULL_DEPOSIT'&&aliases[element.field])return formatField(snapshot.bank[aliases[element.field]],'TEXT',element.missing);
 return formatField(fieldValue(snapshot,element.field,model),element.format,element.missing);
}
export const TABLE_COLUMNS=[{key:'number',label:'Pago',format:'INTEGER'},{key:'date',label:'Fecha',format:'DATE'},{key:'payment',label:'Importe',format:'MONEY'},{key:'remaining_total',label:'Saldo restante',format:'MONEY'}];
// Strict allowlists prevent payload values, scripts, arbitrary source paths and unbounded rendering.
export function validateLayout(layout,type,template,{draft=false}={}){
 const errors=[],fields=layoutFields(type,layout?.version),byKey=new Map(fields.map(x=>[x.key,x])),ids=new Set(),used=new Set();
 const fail=t=>{if(errors.length<30)errors.push(t);};
 if(!template?.id||!template.page_size)fail('Selecciona una plantilla existente.');
 if(!layout||!['suti-layout-1','suti-layout-2',LAYOUT_VERSION].includes(layout.version)||layout.unit!=='mm'||!Number.isInteger(layout.pages)||layout.pages<1||layout.pages>30||!Array.isArray(layout.elements)||layout.elements.length>200)return ['El diseño debe contener de 1 a 30 páginas y hasta 200 elementos.'];
 if(Object.keys(layout).some(k=>!['version','unit','pages','elements'].includes(k)))fail('El diseño sólo admite distribución y presentación.');
 const W=template?.page_size?.width*25.4/72,H=template?.page_size?.height*25.4/72,m=template?.margins;
 for(const e of layout.elements){
  if(!e||typeof e!=='object'){fail('Elemento inválido.');continue;}
  const allowed=['id','kind','field','page','x','y','width','height','font','size','weight','align','color','format','missing','text','label','labelPosition','autoColumns','signatureImages','followSchedule','heading','columns','gap','orientation','tableColumns','header','headerColor','rowsPerPage'];
  if(e.heading!==undefined&&(e.kind!=='SIGNERS'||typeof e.heading!=='string'||e.heading.length>120))fail('Firmantes: título de hasta 120 caracteres.');
  if(e.followSchedule!==undefined&&(e.kind!=='SIGNERS'||typeof e.followSchedule!=='boolean'))fail('Firmantes: posición posterior al calendario inválida.');
  if(e.followSchedule){const schedule=layout.elements.find(x=>x.kind==='PAYMENT_SCHEDULE');if(!schedule||schedule.page>e.page||schedule.page===e.page&&layout.elements.indexOf(schedule)>layout.elements.indexOf(e))fail('Firmantes: coloca el calendario antes del bloque de firmas.');}
  if(e.signatureImages!==undefined&&(e.kind!=='SIGNERS'||!Array.isArray(e.signatureImages)||e.signatureImages.length>100||e.signatureImages.some(s=>s!==null&&(!s||Object.keys(s).some(k=>!['width','height'].includes(k))||!Number.isFinite(s.width)||!Number.isFinite(s.height)||s.width<8||s.width>200||s.height<4||s.height>60))))fail('Firmantes: cada imagen admite ancho de 8 a 200 mm y alto de 4 a 60 mm.');
  if(e.color!==undefined&&!['ink','brand'].includes(e.color))fail('Color de texto inválido.');
  if(e.headerColor!==undefined&&(e.kind!=='PAYMENT_SCHEDULE'||!['ink','brand'].includes(e.headerColor)))fail('Color de encabezado inválido.');
  if(e.labelPosition!==undefined&&(e.kind!=='FIELD'||!['above','inline'].includes(e.labelPosition)))fail('Posición de etiqueta inválida.');
  if(e.autoColumns!==undefined&&(e.kind!=='SIGNERS'||typeof e.autoColumns!=='boolean'))fail('Distribución de firmas inválida.');
  if(e.label!==undefined&&(e.kind!=='FIELD'||typeof e.label!=='string'||e.label.length>120))fail('La etiqueta debe ser un texto de hasta 120 caracteres.');
  if(Object.keys(e).some(k=>!allowed.includes(k)))fail('Un elemento contiene propiedades no permitidas.');
  if(typeof e.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(e.id)||ids.has(e.id))fail('Identificador de elemento duplicado o inválido.');ids.add(e.id);
  const d=byKey.get(e.field),label=(d?.label||('Texto: '+String(e.text||'').slice(0,48)))+' (página '+e.page+')';
  if(!['FIELD','TEXT','SIGNERS','PAYMENT_SCHEDULE'].includes(e.kind)||e.kind!=='TEXT'&&(!d||d.kind!==e.kind))fail('Campo no disponible para este tipo documental.');
  if(e.kind==='TEXT'&&(typeof e.text!=='string'||!e.text.trim()||e.text.length>2000||e.field!==undefined))fail('Escribe un texto de hasta 2000 caracteres.');
  if(e.kind!=='TEXT'&&e.text!==undefined)fail('Los campos dinámicos no almacenan valores.');
  if(d){used.add(d.key);if(d.kind!=='FIELD'&&layout.elements.filter(x=>x.field===e.field).length>1)fail(label+': sólo admite un bloque.');}
  if(!Number.isInteger(e.page)||e.page<1||e.page>layout.pages||![e.x,e.y,e.width,e.height].every(Number.isFinite)||e.width<8||e.height<4||e.x<0||e.y<0||e.x+e.width>W+.01||e.y+e.height>H+.01)fail(label+': elemento fuera de la página o tamaño inválido.');
  if(layout.version==='suti-layout-1'&&m&&(e.x<m.left-.01||e.y<m.top-.01||e.x+e.width>W-m.right+.01||e.y+e.height>H-m.bottom-7+.01))fail(label+': respeta los márgenes seguros y el pie de página.');
  if(!['Helvetica','TimesRoman','Courier'].includes(e.font)||!['regular','semibold','bold'].includes(e.weight)||!['left','center','right'].includes(e.align)||!Number.isFinite(e.size)||e.size<6||e.size>36)fail(label+': tipografía inválida.');
  if(e.kind==='FIELD'&&(!['hide','na','empty'].includes(e.missing)||e.format!==d?.format))fail(label+': utiliza el formato definido por el contrato.');
  const signerColumns=e.orientation==='vertical'?1:e.columns;
  if(e.kind==='SIGNERS'&&(!Number.isInteger(e.columns)||e.columns<1||e.columns>6||!['horizontal','vertical'].includes(e.orientation)||!Number.isFinite(e.gap)||e.gap<0||e.gap>20||e.height<30||(e.width-(signerColumns-1)*e.gap)/signerColumns<25))fail('Firmantes: deja al menos 30 mm de alto y 25 mm por columna.');
  if(e.kind==='PAYMENT_SCHEDULE'&&(!Array.isArray(e.tableColumns)||!e.tableColumns.length||new Set(e.tableColumns).size!==e.tableColumns.length||e.tableColumns.some(k=>!TABLE_COLUMNS.some(c=>c.key===k))||!e.tableColumns.includes('number')||!e.tableColumns.includes('payment')||typeof e.header!=='boolean'||!Number.isInteger(e.rowsPerPage)||e.rowsPerPage<1||e.rowsPerPage>100||e.height<20||e.width/e.tableColumns.length<18))fail('Calendario: revisa columnas, filas y espacio disponible.');
 }
 for(const d of fields.filter(d=>d.required&&!draft))if(!used.has(d.key))fail('Falta el campo obligatorio: '+d.label+'.');
 if(!draft)for(let i=0;i<layout.elements.length;i++)for(let j=i+1;j<layout.elements.length;j++){const a=layout.elements[i],b=layout.elements[j];if(a&&b&&a.page===b.page&&Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>.2&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>.2)fail('Elementos superpuestos en la página '+a.page+': '+(byKey.get(a.field)?.label||String(a.text).slice(0,35))+' / '+(byKey.get(b.field)?.label||String(b.text).slice(0,35))+'.');}
 return [...new Set(errors)];
}
export function initialLayout(type,template){
 const W=template.page_size.width*25.4/72,H=template.page_size.height*25.4/72,m=template.margins,w=W-m.left-m.right;
 let y=m.top,page=1,column=0;const elements=[],fields=layoutFields(type);
 const selected=fields.filter(d=>d.kind==='FIELD'&&d.group!=='Base de afiliados'&&d.key!=='document.title');
 const add=(d,wide=false)=>{
  if(wide&&column){y+=17;column=0;}
  const height=d.kind==='SIGNERS'?55:d.kind==='PAYMENT_SCHEDULE'?75:d.key==='document.title'?12:14;
  if(y+height>H-m.bottom){page++;y=m.top;column=0;}
  elements.push({id:'initial_'+elements.length,kind:d.kind,field:d.key,page,x:m.left+(wide?0:column*(w+5)/2),y,width:wide?w:(w-5)/2,height,font:'Helvetica',size:d.key==='document.title'?13:9,weight:d.key==='document.title'?'bold':'regular',align:'left',...(d.kind==='FIELD'?{format:d.format,missing:'hide',label:d.key==='document.title'?'':d.label}:{}),...(d.kind==='SIGNERS'?{columns:3,gap:5,orientation:'horizontal',autoColumns:false}:{}),...(d.kind==='PAYMENT_SCHEDULE'?{tableColumns:TABLE_COLUMNS.map(x=>x.key),header:true,rowsPerPage:10}:{})});
  if(wide){y+=height+3;}else if(column){y+=17;column=0;}else column=1;
 };
 add(fields.find(d=>d.key==='document.title'),true);
 selected.forEach(d=>add(d,d.key==='identity.full_name'));
 const schedule=fields.find(d=>d.kind==='PAYMENT_SCHEDULE');if(schedule)add(schedule,true);
 add(fields.find(d=>d.kind==='SIGNERS'),true);
 return {version:LAYOUT_VERSION,unit:'mm',pages:page,elements};
}
