import {validateLayout,fieldValue,formatField,TABLE_COLUMNS,layoutFields,boundField} from './layout.mjs';

// A positioning strategy inside the existing PDF renderer, not another generation pipeline.
export async function drawLayout({snapshot,model,pdf,PDFLib,background,width,height,loadAsset,preview,draft=false}){
 const layout=snapshot.layout.definition,legacy=layout.version==='suti-layout-1',fields=layoutFields(snapshot.document_type,layout.version),mm=72/25.4,m=snapshot.template.margins;
 if(validateLayout(layout,snapshot.document_type,snapshot.template,{draft:preview&&draft}).length)throw Error('DOCUMENT_LAYOUT_INVALID');
 const {StandardFonts,rgb}=PDFLib,ink=rgb(.078,.129,.239),brand=rgb(.57,0,.133),fonts={};
 for(const name of ['Helvetica','TimesRoman','Courier']){fonts[name]={regular:await pdf.embedFont(StandardFonts[name]),bold:await pdf.embedFont(StandardFonts[name==='TimesRoman'?'TimesRomanBold':name+'Bold'])};}
 const pages=[];
 function page(){if(pages.length>=500)throw Error('DOCUMENT_LAYOUT_PAGE_LIMIT');const p=pdf.addPage([width,height]);pages.push(p);if(background)p.drawPage(background,{x:0,y:0,width,height});if(preview)p.drawText('VISTA PREVIA / DATOS DE EJEMPLO',{x:m.left*mm,y:height-14,size:8,font:fonts.Helvetica.regular,color:brand});return p;}
 function issue(code,e,requiredHeight){const label=fields.find(f=>f.key===e.field)?.label||('Texto: '+String(e.text||'').slice(0,48));const error=Error(code);error.layoutIssue={code,element_id:e.id,element_label:label,page:e.page,required_height:requiredHeight?Math.ceil(requiredHeight*2)/2:undefined,message:label+' · página '+e.page+': '+(code==='DOCUMENT_LAYOUT_TEXT_OVERFLOW'?'el texto necesita '+(Math.ceil(requiredHeight*2)/2)+' mm de alto (disponibles '+e.height+' mm). Amplía su área o reduce la fuente.':'revisa el tamaño o los caracteres de este elemento.')};return error;}
 const fontFor=e=>fonts[e.font][e.weight==='regular'?'regular':'bold'];
 function wrap(value,w,size,font){
  const output=[];
  for(const paragraph of String(value).replace(/\r/g,'').split('\n')){let line='';for(const word of paragraph.split(/\s+/)){const next=line?line+' '+word:word;if(font.widthOfTextAtSize(next,size)<=w){line=next;continue;}if(line)output.push(line);line='';for(const c of word){if(font.widthOfTextAtSize(line+c,size)>w){if(!line)throw Error('DOCUMENT_LAYOUT_TEXT_TOO_WIDE');output.push(line);line='';}line+=c;}}output.push(line);}
  return output;
 }
 function drawText(p,text,e,x=e.x,y=e.y,w=e.width,h=e.height,font=fontFor(e)){
  const lines=wrap(text,w*mm,e.size,font),lineHeight=e.size*1.25;
  if(lines.length*lineHeight>h*mm+.1)throw issue('DOCUMENT_LAYOUT_TEXT_OVERFLOW',e,lines.length*lineHeight/mm);
  lines.forEach((line,n)=>{const length=font.widthOfTextAtSize(line,e.size),offset=e.align==='right'?w*mm-length:e.align==='center'?(w*mm-length)/2:0;p.drawText(line,{x:x*mm+offset,y:height-y*mm-e.size-n*lineHeight,size:e.size,font,color:ink});});return lines.length*lineHeight/mm;
 }
 for(let number=1;number<=layout.pages;number++){
  const base=page();
  for(const e of layout.elements.filter(e=>e.page===number)){
   try{
   if(e.kind==='TEXT'){drawText(base,e.text,e);continue;}
   if(e.kind==='FIELD'){const value=boundField(snapshot,e,model);if(value!==null)drawText(base,value,e);continue;}
   let target=base,y=e.y,end=e.y+e.height;
   const continuation=()=>{target=page();y=m.top;end=height/mm-m.bottom-(legacy?7:0);};
   if(e.kind==='SIGNERS'){
    const count=e.orientation==='vertical'?1:e.columns,cw=(e.width-(count-1)*e.gap)/count;
    for(let n=0;n<snapshot.signers.length;n+=count){
     const row=snapshot.signers.slice(n,n+count),blocks=row.map(s=>[s.full_name,s.title,s.role].map(t=>wrap(t,cw*mm,e.size,fontFor(e))));
     const heights=blocks.map(b=>20+b.reduce((sum,lines)=>sum+lines.length*e.size*1.25/mm+1,0)),h=Math.max(...heights)+3;
     if(n===0&&y+h>end)throw issue('DOCUMENT_LAYOUT_SIGNER_TOO_TALL',e);
     if(y+h>end)continuation();if(y+h>end)throw issue('DOCUMENT_LAYOUT_SIGNER_TOO_TALL',e);
     for(let k=0;k<row.length;k++){
      const s=row[k],x=e.x+k*(cw+e.gap);
      if(preview)drawText(target,'Firma de ejemplo',{...e,size:Math.min(e.size,9)},x,y+4,cw,12);
      else{const bytes=await loadAsset(s.asset),image=s.asset.mime==='image/png'?await pdf.embedPng(bytes):await pdf.embedJpg(bytes),scale=Math.min(cw*mm/image.width,16*mm/image.height);target.drawImage(image,{x:x*mm,y:height-(y+16)*mm,width:image.width*scale,height:image.height*scale});}
      target.drawLine({start:{x:x*mm,y:height-(y+18)*mm},end:{x:(x+cw)*mm,y:height-(y+18)*mm},thickness:.5,color:ink});
      let yy=y+20;for(const text of [s.full_name,s.title,s.role])yy+=drawText(target,text,e,x,yy,cw,h)+1;
     }y+=h+e.gap;
    }
   }else if(e.kind==='PAYMENT_SCHEDULE'&&model.schedule){
    const rows=model.schedule.rows;if(!Array.isArray(rows)||!rows.length)throw Error('DOCUMENT_SCHEDULE_EMPTY');
    const columns=e.tableColumns.map(k=>TABLE_COLUMNS.find(c=>c.key===k)),cw=e.width/columns.length,font=fontFor(e),line=e.size*1.25/mm;
    const header=()=>{if(!e.header)return;const texts=columns.map(c=>wrap(c.label,(cw-2)*mm,e.size,fonts[e.font].bold)),h=Math.max(...texts.map(t=>t.length))*line+3;if(y+h+line+3>end)throw issue('DOCUMENT_LAYOUT_TABLE_ROW_TOO_TALL',e);columns.forEach((c,k)=>drawText(target,c.label,{...e,weight:'bold',align:'left'},e.x+k*cw,y,cw-2,h));y+=h;};
    header();let used=0;
    for(const row of rows){
     if(!row||['number','date','payment'].some(k=>row[k]===null||row[k]===undefined||row[k]===''))throw Error('DOCUMENT_REQUIRED_SCHEDULE_ROW');
     const values=columns.map(c=>formatField(row[c.key],c.format,'empty')),h=Math.max(...values.map(v=>wrap(v,(cw-2)*mm,e.size,font).length))*line+3;
     if(target===base&&used===0&&y+h>end)throw issue('DOCUMENT_LAYOUT_TABLE_ROW_TOO_TALL',e);
     if(y+h>end||used>=e.rowsPerPage){continuation();header();used=0;}
     if(y+h>end)throw issue('DOCUMENT_LAYOUT_TABLE_ROW_TOO_TALL',e);
     values.forEach((v,k)=>drawText(target,v,{...e,align:'left'},e.x+k*cw,y,cw-2,h));y+=h;used++;
    }
   }
   }catch(error){if(error.layoutIssue)throw error;throw issue(/^DOCUMENT_LAYOUT_[A-Z_]+$/.test(error.message)?error.message:'DOCUMENT_LAYOUT_ELEMENT_INVALID',e);}
  }
 }
 if(legacy)pages.forEach((p,n)=>p.drawText('SutiApp · Página '+(n+1)+' de '+pages.length,{x:m.left*mm,y:m.bottom*mm+4,size:8,font:fonts.Helvetica.regular,color:ink}));
 return pages.length;
}
