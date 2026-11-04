/* Read-only XLSX export of the authorized monthly report. No financial recalculation. */
(function(root){
 'use strict';
 const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 const REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
 const statuses={RECORDED:'Registrado',SCHEDULED:'Programado',PENDING:'Pendiente autorizado',PARTIAL:'Información parcial',UNAVAILABLE:'Sin determinar',NOT_APPLICABLE:'No aplica'};
 const groups={savings:'Ahorro Voluntario',SAVINGS:'Ahorro Voluntario',loans:'Préstamos de Caja de Ahorro',LOANS:'Préstamos de Caja de Ahorro',caja:'Préstamos de Caja de Ahorro'};
 const finite=value=>typeof value==='number'&&Number.isFinite(value);
 const stateLabel=c=>{if(['UNAVAILABLE','NOT_APPLICABLE'].includes(c.status))return '';if(c.calculationStatus==='CALCULATED'&&!['SCHEDULED','PARTIAL'].includes(c.status))return 'Calculado';return c.status==='CALCULATED'?'Calculado':statuses[c.status]||'';};
 const basisLabel=value=>({DETERMINED_ZERO_BALANCES:'Préstamos identificados con saldo cero; ver IDs y Base Contratos',"PV2_ORIGINAL_COMPONENTS": "Cuota y desglose originales de HISTORIAL P V2", "ORIGINAL_PLACEMENT_DATE": "Fecha de solicitud del pr\u00e9stamo autorizado", "UNIQUE_AUTHORIZED_LOAN": "Pr\u00e9stamo autorizado, contado una vez por ID", "UNIQUE_AUTHORIZED_LOAN_MONTH": "Pr\u00e9stamo autorizado, contado una vez por ID y mes", "ORIGINAL_PRINCIPAL_MINUS_SOURCE_AD": "Capital original menos capital AD recuperado", "REGISTERED_CALENDAR_AFTER_CUTOFF": "Cuotas futuras registradas por fecha A", "AUTHORIZED_PRINCIPAL_NO_CALENDAR": "Capital autorizado sin calendario vinculado", "NON_CASH_BASIS_CHANGE": "Cambio entre bases de saldo; sin movimiento de efectivo", "CONTRACT_CONTINUITY": "Continuidad de capital entre contratos", "ORIGINAL_WITHDRAWAL_UNDATED": "Retiro registrado en origen sin fecha asignable", "PROJECTED_CAPITAL_FROM_OBLIGATIONS": "Saldo proyectado aplicando obligaciones programadas",CONTRACTUAL_ALLOCATION:'Distribución contractual',DERIVED_FORECAST:'Proyección derivada de condiciones contractuales',REGISTERED_MOVEMENT:'Movimiento registrado',REGISTERED_CONTRACT:'Condiciones registradas',REGISTERED_BALANCE:'Saldo registrado',RECORDED_TRANSFER:'Transferencia registrada',RECORDED_UNALLOCATED:'Importe B registrado; desglose incompleto',CONTRACT_CAPITAL_CALCULATION:'Capital calculado conforme al contrato',CONTRACT_YIELD_CALCULATION:'Rendimiento calculado conforme al contrato',CONTRACT_OBLIGATION:'Obligación contractual',CONTRACT_PENDING_CALCULATION:'Obligaciones menos pagos registrados',CONTRACT_MATURITY_PROJECTION:'Devolución programada al vencimiento'})[value]||'Dato registrado en la fuente';
 function validSigns(c){if(!c.sourceSigns)return true;if(typeof c.sourceSigns!=='object'||Array.isArray(c.sourceSigns))return false;const ids=new Set(c.sourceIds||[]);return Object.entries(c.sourceSigns).every(([id,sign])=>finite(sign)&&ids.has(id));}
 const xml=value=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
 const col=index=>{let result='';for(let n=index+1;n;n=Math.floor((n-1)/26))result=String.fromCharCode(65+(n-1)%26)+result;return result;};
 function cell(value,style=0){return {value,style};}
 function numeric(value,style=6){return cell(finite(value)?value:null,finite(value)?style:0);}
 function cellXml(item,row,index,numberStyle=0){const c=typeof item==='object'&&item!==null?item:cell(item,finite(item)?numberStyle:0);if(c.value==null&&!c.style)return '';const attrs=' r="'+col(index)+row+'" s="'+(c.style||0)+'"';if(c.value!=null&&!finite(c.value)&&String(c.value).length>32767)throw Error('Un texto de origen supera el límite de Excel; no se truncó información.');return c.value==null?'<c'+attrs+'/>':finite(c.value)?'<c'+attrs+'><v>'+c.value+'</v></c>':'<c'+attrs+' t="inlineStr"><is><t xml:space="preserve">'+xml(c.value)+'</t></is></c>';}
 function sheetXml(rows,{widths,merges=[],freeze=1,landscape=false,filter=false,numberStyle=0}){
  if(rows.length>1048576||widths.length>16384)throw Error('La base supera el límite de Excel; no se truncó información.');
  const lastCol=col(widths.length-1),lastRow=rows.length;
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="'+NS+'"><dimension ref="A1:'+lastCol+lastRow+'"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane xSplit="1" ySplit="'+freeze+'" topLeftCell="B'+(freeze+1)+'" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="B'+(freeze+1)+'" sqref="B'+(freeze+1)+'"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="23"/><cols>'+widths.map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>').join('')+'</cols><sheetData>'+rows.map((r,i)=>'<row r="'+(i+1)+'"'+(r.height?' ht="'+r.height+'" customHeight="1"':'')+'>'+r.map((c,j)=>cellXml(c,i+1,j,numberStyle)).join('')+'</row>').join('')+'</sheetData>'+(filter?'<autoFilter ref="A1:'+lastCol+lastRow+'"/>':'')+(merges.length?'<mergeCells count="'+merges.length+'">'+merges.map(range=>'<mergeCell ref="'+range+'"/>').join('')+'</mergeCells>':'')+'<pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="'+(landscape?'landscape':'portrait')+'" fitToWidth="1" fitToHeight="0"/></worksheet>';
 }
 function stylesXml(){
  const fills=['none','gray125','152238','8B003B','233956','E8EDF4','DCE9F0','F7E5ED','FFF3D6'];
  const fonts=[['233956',false,11],['FFFFFF',true,16],['FFFFFF',true,11],['233956',true,11],['8B5E13',false,10]];
  const xf=(font,fill,num=0)=>'<xf numFmtId="'+num+'" fontId="'+font+'" fillId="'+fill+'" borderId="0" xfId="0" applyAlignment="1" applyNumberFormat="1"><alignment vertical="center" horizontal="'+(num?'right':'left')+'" wrapText="1"/></xf>';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="'+NS+'"><numFmts count="3"><numFmt numFmtId="164" formatCode="'+xml('#,##0.00;[Red](#,##0.00);"–"')+'"/><numFmt numFmtId="165" formatCode="'+xml('#,##0;[Red](#,##0);"–"')+'"/><numFmt numFmtId="166" formatCode="'+xml('0.00%;[Red](0.00%);"–"')+'"/></numFmts><fonts count="5">'+fonts.map(([color,bold,size])=>'<font><name val="Calibri"/><sz val="'+size+'"/><color rgb="FF'+color+'"/>'+(bold?'<b/>':'')+'</font>').join('')+'</fonts><fills count="9">'+fills.map((fill,i)=>i<2?'<fill><patternFill patternType="'+fill+'"/></fill>':'<fill><patternFill patternType="solid"><fgColor rgb="FF'+fill+'"/><bgColor indexed="64"/></patternFill></fill>').join('')+'</fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1">'+xf(0,0)+'</cellStyleXfs><cellXfs count="18">'+[xf(0,0),xf(1,2),xf(4,8),xf(2,3),xf(2,4),xf(3,5),xf(0,0,164),xf(0,0,165),xf(0,0,166),xf(3,6,164),xf(3,7,164),xf(3,6),xf(3,7),xf(4,0),xf(4,8),xf(4,8,164),xf(4,8,165),xf(4,8,166)].join('')+'</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
 }
 function prepare(report){
  if(!report||!/^\d{4}-\d{2}$/.test(report.from||'')||!Array.isArray(report.months)||report.months.length!==12||!Array.isArray(report.rows)||report.rows.some(row=>!Array.isArray(row.cells)||row.cells.length!==12))throw Error('El reporte no contiene doce meses válidos.');
  if(report.rows.some(row=>row.cells.some(c=>!validSigns(c))))throw Error('Las relaciones del subtotal no son válidas; no se generó el archivo.');
  const rows=[],merges=[],notes=[['Tipo','Referencia','Concepto','Mes','Estado','Subtotal identificado (no total)','Observación','Fuentes'].map(label=>cell(label,3))];
  function addNote(values){const parts=values.map(c=>typeof c.value==='string'?Array.from({length:Math.max(1,Math.ceil(c.value.length/24000))},(_,i)=>c.value.slice(i*24000,(i+1)*24000)):[c.value]),count=Math.max(...parts.map(p=>p.length));for(let i=0;i<count;i++)notes.push(values.map((c,j)=>cell(parts[j][i]??(i&&j<5?String(c.value??'')+' (continuación)':null),c.style)));}
  const line=(text,style,height=26)=>{const r=Array.from({length:13},(_,i)=>cell(i===0?text:'',style));r.height=height;rows.push(r);merges.push('A'+rows.length+':M'+rows.length);};
  line('SUTIAPP | FLUJO MENSUAL DE EFECTIVO',1,38);
  line('Consulta autorizada · Importes en MXN · Corte: '+report.asOf+' · Consulta: '+report.consultedAt,2,30);
  rows.push([]);
  rows.push([cell('CONCEPTO FINANCIERO',3),...report.months.map(month=>cell(month.label,3))]);
  const orderedGroups=[...new Set(report.rows.map(row=>row.group))];
  for(const group of orderedGroups){
   line(groups[group]||group,4);let section=null;
   for(const row of report.rows.filter(item=>item.group===group)){
    if(row.section&&row.section!==section){line(row.section,5);section=row.section;}
    const labelStyle=row.emphasis==='total'?12:row.emphasis==='subtotal'?11:0;
    const numStyle=row.unit==='count'?7:row.unit==='percent'?8:row.emphasis==='total'?10:row.emphasis==='subtotal'?9:6;
    const outputRow=rows.length+1;
    const values=row.cells.map((c,index)=>{
     const value=c.status==='PARTIAL'?c.knownAmount:c.amount,isKnown=!['UNAVAILABLE','NOT_APPLICABLE'].includes(c.status)&&finite(value);
     const textNotes=(c.notes||[]).map(n=>typeof n==='string'?n:n.message||n.code||'').filter(Boolean);
     if(c.status==='PARTIAL')textNotes.unshift('Se muestra el subtotal identificado; faltan datos para completar el total mensual.');
     if(!isKnown)textNotes.unshift(c.status==='NOT_APPLICABLE'?'No aplica a este mes.':'Importe sin determinar; no equivale a cero.');
     if(finite(c.percentage))textNotes.push(c.percentage+'% del importe bruto del mismo fondo, mes y estado.');
     if(c.sourceSigns)textNotes.push('El detalle conserva importes de origen. Los factores indican cómo se suman o restan al subtotal de esta celda.');
     addNote([cell('Celda'),cell(col(index+1)+outputRow),cell(row.label),cell(report.months[index].key),cell(stateLabel(c)),numeric(c.status==='PARTIAL'?c.knownAmount:null,row.unit==='count'?7:6),cell(textNotes.join(' ')),cell((c.sourceIds||[]).map(id=>id+(c.sourceSigns&&finite(c.sourceSigns[id])?' · '+(c.sourceSigns[id]<0?'Resta':'Suma')+' × '+c.sourceSigns[id]:'')).join(' | '))]);
     return isKnown?numeric(row.unit==='percent'?value/100:value,c.status==='PARTIAL'?(row.unit==='count'?16:row.unit==='percent'?17:15):numStyle):cell(null,numStyle);
    });
    rows.push([cell(row.label,labelStyle),...values]);
   }
  }
  for(const issue of report.issues||[])addNote([cell('Observación'),cell(issue.code),cell(''),cell((issue.months||[]).join(', ')),cell('Revisión de fuente'),cell(null),cell(issue.message||issue.code),cell((issue.sourceIds||[]).join(' | '))]);
  for(const r of report.unassigned||[])addNote([cell('Fuera de distribución mensual'),cell(r.sourceId||r.id),cell(report.rows.find(row=>row.id===r.kind)?.label||'Concepto sin clasificación disponible'),cell(r.date||'Sin fecha suficiente'),cell(r.overdue?'Pendiente vencido':statuses[r.status]||'Sin asignar'),numeric(r.amount),cell(r.source||''),cell(r.id)]);
  const labels=new Map(report.rows.map(r=>[r.id,r.label]));const detailLabel=r=>labels.get(r.kind)||({investor_contract_continuity:'Continuidad entre contratos',investor_capital_bridge:'Relaci\u00f3n de saldo anterior con saldo final'})[r.kind]||'Registro de origen';
  const details=[["Fuente", "Referencia de origen", "Concepto del reporte", "ID del pr\u00e9stamo", "N\u00famero de control", "Contrato", "N\u00famero de cuota", "Per\u00edodo", "Fecha", "Importe aplicado al concepto", "Cuota B registrada", "Capital AD", "Inter\u00e9s AB", "Administraci\u00f3n Z", "Capital %", "Inter\u00e9s %", "Administraci\u00f3n %", "Estado del c\u00e1lculo", "Origen del desglose", "Referencia del c\u00e1lculo", "Referencia de la cuota completa", "Nombre", "Programa", "Importe sin desglose", "Diferencia de redondeo", "Pr\u00e9stamos incluidos en el registro agrupado", "Cuotas incluidas en el registro agrupado"].map(label=>cell(label,3))],seen=new Set();
  const byId=new Map((report.records||[]).map(r=>[r.id,r]));
  for(const item of report.records||[]){
   const parent=item.parentRecordId&&byId.get(item.parentRecordId);if(item.parentRecordId&&(!parent||parent.id===item.id||parent.parentRecordId))throw Error('El detalle contiene referencias de origen inválidas; no se generó el archivo.');
   const r=parent?{...parent,...item}:item;
   if(seen.has(r.id))throw Error('El detalle contiene referencias duplicadas; no se generó el archivo.');seen.add(r.id);
   const basis=basisLabel(r.basis);
   details.push([cell(r.source),cell(r.sourceId||r.id),cell(detailLabel(r)),cell(r.loanId),cell(r.folio),cell(r.contractId),cell(r.installment),cell(r.period),cell(r.date),numeric(r.amount),numeric(r.registeredAmount),numeric(r.principal),numeric(r.interest),numeric(r.administration),...['principal','interest','administration'].map(k=>numeric(finite(r.percentages?.[k])?r.percentages[k]/100:null,8)),cell(stateLabel(r)),cell(basis),cell(r.id),cell(item.parentRecordId),cell(r.name||r.borrowerName||r.investorName),cell(r.fund||r.program),numeric(r.unallocated),numeric(r.rounding),cell(Array.isArray(r.loanIds)?r.loanIds.join(' | '):null),cell(Array.isArray(r.quotaIds)?r.quotaIds.join(' | '):null)]);
  }
  return {rows,merges,notes,details};
 }
 function baseSheets(report,data){
  const source=report.sourceBases,names=['Base PV2','Base Solicitudes','Base Ahorro','Base Inversores','Base Contratos'];
  if(source?.version!==1||source.consultedAt!==report.consultedAt||source.savingsInputsAvailable!==true||!Array.isArray(source.tables)||source.tables.length!==names.length||names.some((n,i)=>source.tables[i]?.name!==n))throw Error('Actualiza la consulta para descargar las bases de origen completas.');
  const bases=source.tables.map(t=>{
   if(!Array.isArray(t.columns)||!t.columns.length||!Array.isArray(t.rows)||t.rows.some(r=>!Array.isArray(r)||r.length!==t.columns.length||r.some(v=>v!==null&&typeof v!=='string'&&!finite(v))))throw Error('La base de origen no es válida.');
   const styles=t.columns.map(label=>/tasa/i.test(label)?8:/fila|plazo|número de (?:cuota|pagos)|# de pagos|proceso/i.test(label)?7:6);
   return {name:t.name,rows:[[cell(t.authority+' · '+t.classification+' · Corte '+report.asOf+' · Consulta '+report.consultedAt,2)],t.columns.map(v=>cell(v,3)),...t.rows.map(r=>r.map((v,i)=>cell(v,finite(v)?styles[i]:0)))],options:{widths:t.columns.map(label=>/nombre|inversionista|programa|fondo|explicación|referencia/i.test(label)?34:22),freeze:2,landscape:true,numberStyle:6}};
  });
  // Source rows stay once in their base. This separate, explicitly derived base
  // keeps each calculation and the signs/links of its displayed subtotal.
  const width=Math.max(data.details[0].length,data.notes[0].length)+1;
  const calc=[[cell('DERIVADO · Cálculos y relaciones · '+report.consultedAt,2)],
   [cell('Tipo',3),...data.details[0]],...data.details.slice(1).map(r=>[cell('Cálculo'),...r]),
   [cell('Relaciones de celdas',3),...data.notes[0]],...data.notes.slice(1).map(r=>[cell('Relación / incidencia'),...r])];
  bases.push({name:'Base Cálculo',rows:calc,options:{widths:Array(width).fill(26),freeze:2,landscape:true}});return bases;
 }
 async function build(report){
  const data=prepare(report),Zip=root.JSZip||(typeof module!=='undefined'&&module.exports?require('./vendor/jszip-3.10.1/jszip.min.js'):null);
  if(!Zip)throw Error('El componente local de Excel no está disponible.');
  const bases=baseSheets(report,data),zip=new Zip(),names=['Flujo mensual',...bases.map(b=>b.name)],xmlHead='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  zip.file('[Content_Types].xml',xmlHead+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+names.map((_,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>');
  zip.file('_rels/.rels',xmlHead+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="'+REL+'/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml',xmlHead+'<workbook xmlns="'+NS+'" xmlns:r="'+REL+'"><bookViews><workbookView/></bookViews><sheets>'+names.map((name,i)=>'<sheet name="'+name+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels',xmlHead+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+names.map((_,i)=>'<Relationship Id="rId'+(i+1)+'" Type="'+REL+'/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'<Relationship Id="rIdStyles" Type="'+REL+'/styles" Target="styles.xml"/></Relationships>');
  zip.file('xl/styles.xml',stylesXml());
  zip.file('xl/worksheets/sheet1.xml',sheetXml(data.rows,{widths:[56,...Array(12).fill(18)],merges:data.merges,freeze:4,landscape:true}));
  for(const [i,b]of bases.entries())zip.file('xl/worksheets/sheet'+(i+2)+'.xml',sheetXml(b.rows,b.options));
  return {bytes:await zip.generateAsync({type:'uint8array',compression:'DEFLATE'}),filename:'SutiApp_Flujo_Efectivo_'+report.from+'_12_meses.xlsx'};
 }
 async function download(report,options={}){
  const current=options.isCurrent||(()=>true);if(!current())throw Error('La sesión o el período cambió. Consulta nuevamente.');
  const result=await build(report);if(!current())throw Error('La sesión o el período cambió. No se descargó el reporte anterior.');
  const url=URL.createObjectURL(new Blob([result.bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),link=document.createElement('a');
  try{link.href=url;link.download=result.filename;document.body.appendChild(link);link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  return {filename:result.filename};
 }
 const api=Object.freeze({build,download});root.SutiCashFlowExport=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
