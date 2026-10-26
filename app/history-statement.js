/* Local statement of the already-authorized observation; no remote documents. */
(function(){
 'use strict';
 const money=value=>typeof value==='number'&&Number.isFinite(value)?new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(value):'No registrado';
 const escape=value=>String(value).replace(/[\r\n\t]/g,' ').replace(/[\\()]/g,'\\$&');
 // PDF's built-in Helvetica uses WinAnsi. Spanish accents retain their bytes.
 const special={'€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159};
 function bytes(text){return Uint8Array.from(Array.from(text,ch=>special[ch]||((ch.charCodeAt(0)<=255&&ch.charCodeAt(0)>=32)||ch==='\n'||ch==='\r'?ch.charCodeAt(0):63)));}
 function create(entry,observation){
  if(entry?.kind!=='loan')throw Error('HISTORY_STATEMENT_REQUIRES_LOAN');
  const m=window.LoanHistory.metrics(entry),date=window.LoanHistory.formatDate;
  const lines=['SUTIFINANZAS - Estado de cuenta','Amortización de pagos','Préstamo: '+entry.id,'Fondo: '+entry.fund,
   'Estatus: '+(entry.category==='Liquidadas'?'Liquidada':entry.status||entry.category),
   'Monto del préstamo: '+money(entry.principal),'Total a pagar: '+money(entry.total),
   'Monto amortizado: '+money(entry.paid_to_date),'Saldo pendiente: '+money(m.balance),
   'Progreso de liquidación: '+(m.progress==null?'Por revisar':m.progress.toLocaleString('es-MX',{maximumFractionDigits:2})+'%'),
   'Fuente actualizada: '+date(observation.source_updated_at),'Fecha de consulta: '+date(observation.server_now)];
  if(m.overpaid>0)lines.push('Pago excedente registrado: '+money(m.overpaid));
  if(observation.sync_state?.status==='FAILED')lines.push('La última actualización falló. Se muestra la última publicación completa.');
  lines.push('','Cuotas registradas');
  for(const row of entry.schedule||[]){
   lines.push('Cuota '+(row.number??'sin número')+' | '+date(row.date)+' | '+money(row.amount)+' | '+row.state);
   if(row.upcoming)lines.push('Próxima a vencer');
   if(row.closure)lines.push('Cierre de contrato: '+date(row.date));
  }
  if(entry.preparing)lines.push('Amortización en preparación.');
  lines.push('','Las fechas futuras corresponden a cuotas programadas.','El cierre de contrato no sustituye el estatus registrado del préstamo.',
   'Documento informativo de la observación indicada; no es comprobante de pago.','Soporte: +52 662 672 7130');
  // A conservative 44-glyph limit fits the widest built-in Helvetica/WinAnsi
  // glyphs at 11 pt inside the 528 pt printable width, including unbroken IDs.
  const wrapped=lines.flatMap(line=>{const out=[];let rest=String(line);while(rest.length>44){let cut=rest.lastIndexOf(' ',44);if(cut<16)cut=44;out.push(rest.slice(0,cut));rest=rest.slice(cut).trimStart();}out.push(rest);return out;});
  const pages=[];for(let i=0;i<wrapped.length;i+=43)pages.push(wrapped.slice(i,i+43));
  const objects=[null,'<< /Type /Catalog /Pages 2 0 R >>',null,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
  const kids=[];
  pages.forEach((page,index)=>{
   const pageId=objects.length,streamId=pageId+1;kids.push(pageId+' 0 R');
   const stream='BT /F1 11 Tf 15 TL 42 750 Td '+page.map((line,i)=>(i?'T* ':'')+'('+escape(line)+') Tj').join('\n')+'\nET\nBT /F1 9 Tf 42 28 Td (Página '+(index+1)+' de '+pages.length+') Tj ET';
   objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents '+streamId+' 0 R >>');
   objects.push('<< /Length '+bytes(stream).length+' >>\nstream\n'+stream+'\nendstream');
  });
  objects[2]='<< /Type /Pages /Count '+pages.length+' /Kids ['+kids.join(' ')+'] >>';
  let pdf='%PDF-1.4\n',offsets=[0];
  for(let i=1;i<objects.length;i++){offsets.push(bytes(pdf).length);pdf+=i+' 0 obj\n'+objects[i]+'\nendobj\n';}
  const xref=bytes(pdf).length;
  pdf+='xref\n0 '+objects.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('')+
   'trailer\n<< /Size '+objects.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
  return new Blob([bytes(pdf)],{type:'application/pdf'});
 }
 function download(entry,observation){
  const url=URL.createObjectURL(create(entry,observation)),link=document.createElement('a');
  link.href=url;link.download='Estado-de-cuenta-'+String(entry.id).replace(/[^a-z0-9_-]/gi,'_')+'.pdf';
  document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 window.LoanHistoryStatement=Object.freeze({create,download});
})();
