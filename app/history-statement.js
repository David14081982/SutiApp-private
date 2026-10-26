/* Local statement of the already-authorized observation; no remote documents. */
(function(){
 'use strict';
 const money=value=>typeof value==='number'&&Number.isFinite(value)?new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(value):'No registrado';
 const escape=value=>String(value).replace(/[\r\n\t]/g,' ').replace(/[\\()]/g,'\\$&');
 // PDF's built-in Helvetica uses WinAnsi. Spanish accents retain their bytes.
 const special={'€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159};
 function bytes(text){return Uint8Array.from(Array.from(text,ch=>special[ch]||((ch.charCodeAt(0)<=255&&ch.charCodeAt(0)>=32)||ch==='\n'||ch==='\r'?ch.charCodeAt(0):63)));}
 // Standard Helvetica/WinAnsi advance widths (1/1000 em). Measuring the actual
 // PDF fonts keeps wrapping deterministic, without browser fonts or new reads.
 const widths={
  regular:[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,761,556,556,222,556,333,1000,556,556,333,1000,667,333,1000,556,611,556,556,222,222,333,333,350,556,1000,333,1000,500,333,944,556,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500],
  bold:[278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,761,556,611,278,556,500,1000,556,556,333,1000,667,333,1000,611,611,611,611,278,278,500,500,350,556,1000,333,1000,556,333,944,611,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556]
 };
 const color={wine:'#9E002B',ink:'#172033',muted:'#657184',soft:'#F5F6F8',line:'#E4E7EC',white:'#FFFFFF',green:'#047857'};
 const clean=value=>String(value).replace(/[\r\n\t]/g,' ');
 const measure=(value,size=10.5,bold=false)=>Array.from(bytes(clean(value))).reduce((sum,code)=>sum+(widths[bold?'bold':'regular'][code-32]||556),0)*size/1000;
 function wrap(value,width,size=10.5,bold=false){
  let rest=clean(value);const result=[];
  while(measure(rest,size,bold)>width){
   let end=0,space=-1,total=0;
   for(const ch of rest){const next=measure(ch,size,bold);if(end&&total+next>width)break;total+=next;end+=ch.length;if(ch===' ')space=end-1;}
   const cut=space>0?space:Math.max(1,end);result.push(rest.slice(0,cut));rest=rest.slice(cut).trimStart();
  }
  result.push(rest);return result;
 }
 const n=value=>Number(value.toFixed(3));
 const rgb=hex=>[1,3,5].map(i=>n(parseInt(hex.slice(i,i+2),16)/255)).join(' ');
 function rect(page,x,y,w,h,fill){page.push(rgb(fill)+' rg '+[x,792-y-h,w,h].map(n).join(' ')+' re f');}
 function text(page,value,x,y,size=10.5,bold=false,fill=color.ink,align='left'){
  const offset=align==='right'?measure(value,size,bold):0;
  page.push('BT /'+(bold?'F2':'F1')+' '+size+' Tf '+rgb(fill)+' rg 1 0 0 1 '+n(x-offset)+' '+n(792-y-size)+' Tm ('+escape(clean(value))+') Tj ET');
 }
 function lines(page,content,x,y,size=10.5,bold=false,fill=color.ink,align='left',leading=13){
  content.forEach((line,i)=>text(page,line,x,y+i*leading,size,bold,fill,align));return y+content.length*leading;
 }
 // Choose the fewest feasible pages, then distribute whole rows to avoid a
 // nearly empty last page. The last page reserves the complete closing block.
 function paginate(rows,firstStart,nextStart,closingHeight){
  const bottom=742,prefix=[0];rows.forEach(row=>prefix.push(prefix[prefix.length-1]+row.height));
  if(firstStart>bottom||nextStart+closingHeight>bottom)throw Error('HISTORY_STATEMENT_ROW_EXCEEDS_PAGE');
  if(!rows.length)return firstStart+closingHeight<=bottom?[{start:0,end:0}]:[{start:0,end:0},{start:0,end:0}];
  for(let count=1;count<=rows.length+1;count++){
   const memo=new Map();
   function solve(page,start){
    const key=page+':'+start;if(memo.has(key))return memo.get(key);
    const last=page===count-1,capacity=bottom-(page===0?firstStart:nextStart)-(last?closingHeight:0);
    let best=null;
    if(last){const used=prefix[rows.length]-prefix[start];if(start<rows.length&&used<=capacity)best={cost:(capacity-used)**2,ranges:[{start,end:rows.length}]};}
    else{
     const min=page===0&&rows[start].height>capacity?start:start+1;
     for(let end=min;end<=rows.length-(count-page-1);end++){
      const used=prefix[end]-prefix[start];if(used>capacity)break;
      const rest=solve(page+1,end);if(rest){const cost=(capacity-used)**2+rest.cost;if(!best||cost<best.cost)best={cost,ranges:[{start,end},...rest.ranges]};}
     }
    }
    memo.set(key,best);return best;
   }
   const result=solve(0,0);if(result)return result.ranges;
  }
  throw Error('HISTORY_STATEMENT_ROW_EXCEEDS_PAGE');
 }
 function create(entry,observation){
  if(entry?.kind!=='loan')throw Error('HISTORY_STATEMENT_REQUIRES_LOAN');
  const m=window.LoanHistory.metrics(entry),date=value=>window.LoanHistory.formatDate(value).replace(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,(_,day,month,year)=>day.padStart(2,'0')+'/'+month.padStart(2,'0')+'/'+year);
  const status=entry.category==='Liquidadas'?'Liquidada':entry.status||entry.category;
  const progress=m.progress==null?'Por revisar':m.progress.toLocaleString('es-MX',{maximumFractionDigits:2})+'%';
  const schedule=entry.schedule||[],columns=[{x:48,w:48},{x:118,w:126},{x:400,w:132,right:true},{x:564,w:140,right:true}];
  const rows=schedule.map((row,index)=>{
   const cells=[String(index+1),date(row.date),money(row.amount),row.state].map((value,i)=>wrap(value,columns[i].w,10.5,i>1));
   return {cells,height:Math.max(...cells.map(cell=>cell.length))*13+9,state:row.state};
  });
  function heading(page,continued=false){
   const refs=wrap('Referencia del préstamo: '+entry.id,512,10);
   const height=(continued?58:63)+refs.length*13;
   rect(page,36,32,540,height,color.wine);
   text(page,'SUTIFINANZAS',50,42,12,true,color.white);
   if(!continued)text(page,'Estado de cuenta – Amortización de pagos',50,61,18,true,color.white);
   else text(page,'Amortización de pagos · Continuación',50,59,10.5,false,color.white);
   lines(page,refs,50,continued?76:86,10,false,color.white);
   return 32+height+12;
  }
  function summary(page,start){
   const fund=wrap('Fondo: '+entry.fund,350,10.5),state=wrap('Estatus: '+status,162,10,true);
   lines(page,fund,36,start,10.5,false,color.muted);lines(page,state,576,start,10,true,entry.category==='Liquidadas'?color.green:color.ink,'right');
   let y=start+Math.max(fund.length,state.length)*13+12;
   const panel=y,ops=[],left=50,right=320,width=242;
   function pair(a,b){
    let height=0;[a,b].forEach((item,i)=>{
     const x=i?right:left,parts=wrap(item.value,width,item.size,true);
     text(ops,item.label,x,y+5,9.5,false,color.muted);
     lines(ops,parts,x,y+18,item.size,true,item.fill||color.ink,'left',item.size+3);
     height=Math.max(height,18+parts.length*(item.size+3)+5);
    });y+=height;
   }
   pair({label:'Monto original del préstamo',value:money(entry.principal),size:18},{label:'Total a pagar',value:money(entry.total),size:18});
   pair({label:'Monto amortizado',value:money(entry.paid_to_date),size:18,fill:color.green},{label:'Saldo pendiente',value:money(m.balance),size:22,fill:color.wine});
   y+=3;text(ops,'Progreso de liquidación',left,y+4,11,true);text(ops,progress,562,y,18,true,color.wine,'right');
   y+=25;rect(ops,left,y,512,7,color.line);
   if(m.progress!=null)rect(ops,left,y,512*Math.min(100,Math.max(0,m.progress))/100,7,color.wine);
   y+=12;
   if(m.overpaid>0)y=lines(ops,wrap('Pago excedente registrado: '+money(m.overpaid),512,10),left,y,10,false,color.muted)+4;
   if(observation.sync_state?.status==='FAILED')y=lines(ops,wrap('La última actualización falló. Se muestra la última publicación completa.',512,10),left,y,10,false,color.wine)+4;
   rect(page,36,panel,540,y-panel,color.soft);page.push(...ops);return y+14;
  }
  function tableHeader(page,y){
   text(page,'Detalle de amortización',36,y,12,true);y+=19;rect(page,36,y,540,25,color.wine);
   ['Cuota','Fecha','Importe','Estado'].forEach((label,i)=>text(page,label,columns[i].x,y+6,10.5,true,color.white,columns[i].right?'right':'left'));
   return y+25;
  }
  const closing=[];let endY=10;
  if(entry.preparing&&schedule.length)endY=lines(closing,['Amortización en preparación.'],36,endY,10.5,false,color.muted)+4;
  text(closing,'Información actualizada: '+date(observation.source_updated_at),36,endY,9.5,false,color.muted);
  text(closing,'Fecha de consulta: '+date(observation.server_now),576,endY,9.5,false,color.muted,'right');endY+=18;
  const closure=schedule.filter(row=>row.closure).map(row=>date(row.date));
  endY=lines(closing,wrap((closure.length?'Cierre de contrato: '+closure.join(', ')+'. ':'')+'El cierre de contrato no sustituye el estatus registrado del préstamo.',540,9.5),36,endY,9.5,false,color.muted);
  endY=lines(closing,wrap('Las fechas futuras corresponden a cuotas programadas.',540,9.5),36,endY,9.5,false,color.muted);
  endY+=8;
  const noticeTop=endY,notice=[],noticeText=[
   'Este estado de cuenta es de carácter informativo y no constituye un comprobante de pago. Los importes, saldos y estados de las cuotas están sujetos a cambios por actualizaciones o revisiones de los descuentos aplicados.',
   'Para confirmar los descuentos efectivamente realizados, consulta tus recibos de nómina.'
  ];
  // A small outlined information icon uses vector paths, not a font symbol.
  const cx=56,cy=792-(endY+20),r=6,k=r*.5522848;
  notice.push(rgb(color.muted)+' RG .8 w '+[cx+r,cy].map(n).join(' ')+' m '+[cx+r,cy+k,cx+k,cy+r,cx,cy+r,cx-k,cy+r,cx-r,cy+k,cx-r,cy,cx-r,cy-k,cx-k,cy-r,cx,cy-r,cx+k,cy-r,cx+r,cy-k,cx+r,cy].map((v,i)=>n(v)+(i%6===5?' c':'')).join(' ')+' S');
  text(notice,'i',54.8,endY+14,9,true,color.muted);text(notice,'Aviso importante',70,endY+12,11.5,true);
  endY+=32;
  noticeText.forEach(paragraph=>{endY=lines(notice,wrap(paragraph,512,10.25),50,endY,10.25,false,color.ink,'left',13)+6;});
  endY=lines(notice,wrap('Soporte y aclaraciones: +52 662 672 7130',512,10.25,true),50,endY,10.25,true,color.ink,'left',13)+10;
  rect(closing,36,noticeTop,540,endY-noticeTop,color.soft);closing.push(...notice);
  const first=[],next=[];let firstStart=tableHeader(first,summary(first,heading(first))),nextStart=tableHeader(next,heading(next,true));
  const empty=schedule.length?null:entry.preparing?'Amortización en preparación.':'No hay cuotas registradas.';
  if(empty){text(first,empty,48,firstStart+10,11,false,color.muted);firstStart+=38;}
  const ranges=paginate(rows,firstStart,nextStart,endY),pages=[];
  ranges.forEach((range,pageIndex)=>{
   const page=[...(pageIndex?next:first)];let y=pageIndex?nextStart:firstStart;
   for(let i=range.start;i<range.end;i++){
    const row=rows[i];rect(page,36,y,540,row.height,i%2?color.soft:color.white);
    row.cells.forEach((cell,j)=>lines(page,cell,columns[j].x,y+5,10.5,j>1,j===3&&row.state==='Pagada'?color.green:color.ink,columns[j].right?'right':'left'));
    y+=row.height;
   }
   if(pageIndex===ranges.length-1){
    // Translate the premeasured final block as one object on the final page.
    page.push('q 1 0 0 1 0 '+n(-y)+' cm',...closing,'Q');
   }
   rect(page,36,756,540,.6,color.line);text(page,'SutiFinanzas · Estado de cuenta',36,765,9,false,color.muted);
   text(page,'Página '+(pageIndex+1)+' de '+ranges.length,576,765,9,false,color.muted,'right');pages.push(page.join('\n')+'\n');
  });
  const objects=[null,'<< /Type /Catalog /Pages 2 0 R >>',null,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
  const kids=[];
  pages.forEach(stream=>{
   const pageId=objects.length,streamId=pageId+1;kids.push(pageId+' 0 R');
   objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents '+streamId+' 0 R >>');
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
