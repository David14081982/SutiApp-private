(function(){
  'use strict';
  const normalize=v=>String(v||'').trim().replace(/\s+/g,' ').toLocaleUpperCase('es-MX');
  const missing=v=>v===null||v===undefined||String(v).trim()==='';
  const reqKey=r=>r.requisitionId||r.requisition||('product:'+r.id);
  const levels=['secretariat','project','item','requisition'];
  const labels={secretariat:'Sin secretaría',project:'Sin proyecto',item:'Sin partida',requisition:'Sin requisición'};
  function key(r,field){return field==='requisition'?reqKey(r):(missing(r[field])?null:r[field]);}
  function filter(records,f){return records.filter(r=>(f.year==='all'||String(r.year??'missing')===f.year)&&(f.status==='all'||normalize(r.status)===(f.status==='missing'?'':f.status))&&(f.month==='all'||(r.date?r.date.slice(5,7):'missing')===f.month)&&(!f.search||normalize([r.secretariat,r.expenseType,r.project,r.item,r.requisition,r.concept,r.budgetCode].join(' ')).includes(normalize(f.search))));}
  function summarize(records){
    // Sum decimal representations exactly; round only currency presentation, never each row.
    let total=0n,scale=0;
    for(const r of records){const [base,exponent='0']=String(r.amount).split('e'),[integer,fraction='']=base.split('.');let digits=BigInt(integer+fraction),places=fraction.length-Number(exponent);if(places<0){digits*=10n**BigInt(-places);places=0;}if(places>scale){total*=10n**BigInt(places-scale);scale=places;}total+=digits*10n**BigInt(scale-places);}
    const amountCents=Number(total)/10**scale*100;
    if(!Number.isFinite(amountCents)||Math.abs(amountCents)>Number.MAX_SAFE_INTEGER)throw Error('TOTAL_OUT_OF_RANGE');
    return{amountCents,requisitions:new Set(records.filter(r=>r.requisitionId||r.requisition).map(reqKey)).size,secretariats:new Set(records.filter(r=>!missing(r.secretariat)).map(r=>r.secretariat)).size,projects:new Set(records.filter(r=>!missing(r.project)).map(r=>JSON.stringify([r.secretariat,r.project]))).size};
  }
  function explore(records,path,sort='amount-desc'){
    const scoped=records.filter(r=>path.every((p,i)=>key(r,levels[i])===p.key));
    if(path.length===levels.length)return {records:scoped,groups:[],level:null};
    const level=levels[path.length],groups=new Map();
    for(const r of scoped){const k=key(r,level);if(!groups.has(k))groups.set(k,{key:k,label:missing(r[level])?labels[level]:r[level],records:[]});groups.get(k).records.push(r);}
    const total=summarize(records).amountCents;
    const result=[...groups.values()].map(g=>({...g,...summarize(g.records),count:g.records.length,percentage:total?100*summarize(g.records).amountCents/total:0}));
    result.sort((a,b)=>sort==='name'?a.label.localeCompare(b.label,'es'):sort==='amount-asc'?a.amountCents-b.amountCents:b.amountCents-a.amountCents);
    return{records:scoped,groups:result,level};
  }
  const fields=Object.freeze([
    {key:'secretariat',label:'Secretaría',missing:'Sin secretaría'},
    {key:'expenseType',label:'Tipo de gastos',missing:'Sin tipo de gastos'},
    {key:'project',label:'Proyecto',missing:'Sin proyecto'},
    {key:'item',label:'Partida',missing:'Sin partida'},
    {key:'requisition',label:'Requisición',missing:'Sin requisición'},
    {key:'product',label:'Producto',missing:'Sin producto'},
    {key:'status',label:'Estatus',missing:'Sin estatus'},
    {key:'payment',label:'Forma de pago',missing:'Sin forma de pago'},
    {key:'year',label:'Año',missing:'Sin año'}
  ].map(Object.freeze));
  const pivotFields=new Map(fields.map(field=>[field.key,field]));
  const monthNames=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  function pivot(records,dimensions,options={}){
    if(!Array.isArray(dimensions)||new Set(dimensions).size!==dimensions.length||dimensions.some(field=>!pivotFields.has(field)))throw Error('PIVOT_DIMENSIONS_INVALID');
    const sort=options.sort??'amount-desc',columnField=options.columnField??'month';
    if(!['amount-desc','amount-asc','name'].includes(sort))throw Error('PIVOT_SORT_INVALID');
    if(!['month','year','none'].includes(columnField))throw Error('PIVOT_COLUMN_INVALID');
    const columnKey=r=>columnField==='month'?(missing(r.date)?'missing':r.date.slice(0,7)):(missing(r.year)?'missing':String(r.year));
    const columns=columnField==='none'?[]:[...new Set(records.map(columnKey))].sort((a,b)=>a==='missing'?1:b==='missing'?-1:a.localeCompare(b,'es',{numeric:true})).map(k=>({key:k,label:k==='missing'?(columnField==='month'?'Sin fecha':'Sin año'):columnField==='year'?k:monthNames[Number(k.slice(5,7))-1]+' '+k.slice(0,4)}));
    function amountsFor(source){
      const amounts={},buckets=new Map(columns.map(column=>[column.key,[]]));
      if(columnField!=='none')for(const record of source)buckets.get(columnKey(record)).push(record);
      for(const [k,bucket] of buckets)amounts[k]=summarize(bucket).amountCents;
      return amounts;
    }
    function build(source,depth,path){
      if(depth===dimensions.length)return[];
      const field=dimensions[depth],groups=new Map();
      for(const record of source){
        const k=field==='product'?record.id:key(record,field);
        if(!groups.has(k)){
          const value=field==='product'?(record.concept||record.id):record[field];
          groups.set(k,{key:k,label:missing(value)?pivotFields.get(field).missing:String(value),records:[]});
        }
        groups.get(k).records.push(record);
      }
      const nodes=[...groups.values()].map(group=>{
        const nextPath=[...path,[field,group.key]];
        return{...group,id:JSON.stringify(nextPath),field,depth,children:build(group.records,depth+1,nextPath),summary:summarize(group.records),amounts:amountsFor(group.records),count:group.records.length};
      });
      nodes.sort((a,b)=>{
        const amount=sort==='amount-asc'?a.summary.amountCents-b.summary.amountCents:sort==='amount-desc'?b.summary.amountCents-a.summary.amountCents:0;
        return amount||a.label.localeCompare(b.label,'es',{numeric:true})||String(a.key).localeCompare(String(b.key),'es',{numeric:true});
      });
      return nodes;
    }
    return{roots:build(records,0,[]),columns,summary:summarize(records),amounts:amountsFor(records),records:records.slice(),count:records.length};
  }
  function visibleRows(pivot,dimensions,expanded){
    const width=dimensions.length||1;
    function rowsFor(nodes){
      return nodes.flatMap(node=>{
        if(!node.children.length||!expanded.has(node.id))return [{id:node.id,node,cells:[{node,depth:node.depth,colSpan:width-node.depth,rowSpan:1}],subtotal:false}];
        const rows=rowsFor(node.children);
        rows.push({id:node.id+'-subtotal',node,cells:[{depth:node.depth+1,colSpan:width-node.depth-1,rowSpan:1,label:'Subtotal · '+node.label}],subtotal:true});
        rows[0].cells.unshift({node,depth:node.depth,colSpan:1,rowSpan:rows.length});
        return rows;
      });
    }
    return rowsFor(pivot.roots);
  }
  let excelPromise;
  function excel(){
    if(typeof window.ExcelJS?.Workbook==='function')return Promise.resolve(window.ExcelJS);
    if(excelPromise)return excelPromise;
    excelPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');let timer,settled=false;
      const finish=error=>{
        if(settled)return;settled=true;clearTimeout(timer);script.onload=null;script.onerror=null;
        if(error){script.remove();reject(Error(error));}else resolve(window.ExcelJS);
      };
      script.src=new URL('app/vendor/exceljs-4.4.0/exceljs.min.js',document.baseURI).href;
      script.integrity='sha384-Pqp51FUN2/qzfxZxBCtF0stpc9ONI6MYZpVqmo8m20SoaQCzf+arZvACkLkirlPz';script.crossOrigin='anonymous';
      script.onload=()=>finish(typeof window.ExcelJS?.Workbook==='function'?null:'SUTIFINANZAS_EXCEL_UNAVAILABLE');
      script.onerror=()=>finish('SUTIFINANZAS_EXCEL_UNAVAILABLE');
      timer=setTimeout(()=>finish('SUTIFINANZAS_EXCEL_TIMEOUT'),20000);
      document.head.appendChild(script);
    }).catch(error=>{excelPromise=null;throw error;});
    return excelPromise;
  }
  function buildWorkbook({ExcelJS,pivot,dimensions,expanded,filters={},sort='amount-desc',columnField='month',source={},exportedAt=new Date()}){
    if(typeof ExcelJS?.Workbook!=='function')throw Error('SUTIFINANZAS_EXCEL_UNAVAILABLE');
    const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Gasto por Secretaría');
    const width=dimensions.length||1,columnCount=width+pivot.columns.length+1,rows=visibleRows(pivot,dimensions,expanded);
    const text=value=>String(value??''),fieldName=field=>pivotFields.get(field)?.label||text(field);
    const color={ink:'FF234957',blue:'FFE8F5FA',header:'FFE6F2F7',line:'FFD7E5EC',subtotal:'FFFFF8DE',total:'FFE7DCE2',white:'FFFFFFFF'};
    const border={top:{style:'hair',color:{argb:color.line}},left:{style:'hair',color:{argb:color.line}},bottom:{style:'hair',color:{argb:color.line}},right:{style:'hair',color:{argb:color.line}}};
    const fill=argb=>({type:'pattern',pattern:'solid',fgColor:{argb}});
    const font=bold=>({name:'Nunito',size:11,color:{argb:color.ink},bold:!!bold});
    const stamp=value=>{if(!value)return 'Sin dato';const date=new Date(value);return Number.isNaN(date.getTime())?text(value):date.toISOString();};
    const choice=(value,all,absent)=>value===undefined||value==='all'?all:value==='missing'?absent:text(value);
    const month=filters.month&&filters.month!=='all'&&filters.month!=='missing'?monthNames[Number(filters.month)-1]||text(filters.month):choice(filters.month,'Todos los meses','Sin fecha de gasto');
    const metadata=[
      'SUTIFINANZAS · Gasto por Secretaría',
      'Fuente: '+text(source.name||'Google Sheets')+' · '+text(source.sheet||'Gasto por secretaría'),
      'Datos consultados (UTC): '+stamp(source.consultedAt),
      'Exportado (UTC): '+stamp(exportedAt),
      'Filtros: Año: '+choice(filters.year,'Todos los años','Sin año')+' · Estatus: '+choice(filters.status,'Todos los estatus','Sin estatus')+' · Mes: '+month+' · Buscar: '+(text(filters.search)||'Sin búsqueda'),
      'Filas: '+(dimensions.map(fieldName).join(' → ')||'Total general'),
      'Columnas: '+({month:'Mes del gasto',year:'Año',none:'Solo total'}[columnField]||text(columnField))+' · Orden: '+({'amount-desc':'Mayor importe primero','amount-asc':'Menor importe primero',name:'Nombre A–Z'}[sort]||text(sort)),
      'Vista al exportar: solo grupos y subgrupos visibles. Los subtotales resumen sus filas; no son gastos adicionales.'
    ];
    book.creator='SutiApp';book.created=new Date(exportedAt);book.modified=new Date(exportedAt);
    sheet.columns=[...(dimensions.length?dimensions:['total']).map(field=>({width:field==='product'?38:field==='project'?30:25})),...pivot.columns.map(()=>({width:20})),{width:20}];
    function fitLabel(top,left,rowSpan,colSpan,label){
      let characters=-2;for(let col=left;col<left+colSpan;col++)characters+=sheet.getColumn(col).width*.9;
      const lines=text(label).split(/\r?\n/).reduce((sum,line)=>sum+Math.max(1,Math.ceil(line.length/Math.max(1,characters))),0);
      let needed=lines*16+10;for(let row=top;row<top+rowSpan;row++)needed-=sheet.getRow(row).height||30;
      for(let row=top;needed>0&&row<top+rowSpan;row++){const current=sheet.getRow(row).height||30,extra=Math.min(409-current,needed);sheet.getRow(row).height=current+extra;needed-=extra;}
    }
    metadata.forEach((value,index)=>{
      sheet.mergeCells(index+1,1,index+1,columnCount);const cell=sheet.getCell(index+1,1);cell.value=value;cell.font=font(index===0);cell.alignment={vertical:'middle',wrapText:true};
      sheet.getRow(index+1).height=index===0?30:index===4||index===7?34:25;
    });
    for(let row=10;row<=11;row++)for(let col=1;col<=columnCount;col++){
      const cell=sheet.getCell(row,col);cell.font=font(true);cell.fill=fill(color.header);cell.border=border;cell.alignment={vertical:'middle',wrapText:true};
    }
    (dimensions.length?dimensions:['total']).forEach((field,index)=>{
      sheet.mergeCells(10,index+1,11,index+1);sheet.getCell(10,index+1).value=field==='total'?'Gasto filtrado':fieldName(field);
    });
    if(pivot.columns.length)sheet.mergeCells(10,width+1,10,columnCount);
    sheet.getCell(10,width+1).value='Importe · MXN';
    pivot.columns.forEach((column,index)=>{sheet.getCell(11,width+index+1).value=text(column.label);});
    sheet.getCell(11,columnCount).value='Total';sheet.getCell(11,columnCount).fill=fill(color.total);
    sheet.getRow(10).height=25;sheet.getRow(11).height=32;
    function paint(row,background,bold){
      for(let col=1;col<=columnCount;col++){
        const cell=sheet.getCell(row,col);cell.font=font(bold);cell.fill=fill(background);cell.border=border;cell.alignment={vertical:'top',wrapText:true};
      }
    }
    function amounts(row,node){
      [...pivot.columns.map(column=>node.amounts[column.key]||0),node.summary.amountCents].forEach((value,index)=>{
        const cell=sheet.getCell(row,width+index+1);cell.value=value/100;cell.numFmt='"$"#,##0.00;[Red]-"$"#,##0.00';cell.alignment={horizontal:'right',vertical:'top'};
      });
    }
    rows.forEach((row,index)=>{paint(12+index,row.subtotal?color.subtotal:color.white,row.subtotal);amounts(12+index,row.node);});
    // Merge only the displayed parent/collapsed/subtotal cells, after painting rows.
    rows.forEach((row,index)=>row.cells.forEach(cell=>{
      const top=12+index,left=cell.depth+1;
      if(cell.rowSpan>1||cell.colSpan>1)sheet.mergeCells(top,left,top+cell.rowSpan-1,left+cell.colSpan-1);
      const target=sheet.getCell(top,left);target.value=text(cell.node?cell.node.label:cell.label);target.fill=fill(cell.node?color.blue:color.subtotal);target.font=font(!cell.node);target.alignment={vertical:'top',wrapText:true};
    }));
    let totalRow=12+rows.length;
    if(!pivot.count){
      sheet.mergeCells(totalRow,1,totalRow,columnCount);const cell=sheet.getCell(totalRow,1);cell.value='No hay registros para estos filtros.';cell.font=font(false);cell.alignment={vertical:'middle',wrapText:true};sheet.getRow(totalRow).height=28;totalRow++;
    }
    paint(totalRow,color.total,true);
    if(width>1)sheet.mergeCells(totalRow,1,totalRow,width);
    sheet.getCell(totalRow,1).value='Total general · '+pivot.count+' registros';amounts(totalRow,pivot);
    metadata.forEach((label,index)=>fitLabel(index+1,1,1,columnCount,label));
    rows.forEach((row,index)=>row.cells.forEach(cell=>fitLabel(12+index,cell.depth+1,cell.rowSpan,cell.colSpan,cell.node?cell.node.label:cell.label)));
    fitLabel(totalRow,1,1,width,sheet.getCell(totalRow,1).value);
    sheet.views=[{state:'frozen',xSplit:width,ySplit:11,topLeftCell:sheet.getCell(12,width+1).address,activeCell:'A1'}];
    sheet.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'10:11'};
    sheet.properties.defaultRowHeight=30;
    return book;
  }
  function identity(){const auth=window.AffiliateAuth.getState(),admin=window.AdminRepository.getState();return JSON.stringify([auth.phase,auth.session?.user?.id,auth.affiliate?.id,auth.impersonation,admin.phase,admin.subjectKey,admin.assignment]);}
  async function load(){
    const subject=identity();
    const response=await window.SutiSupabase.getClient().functions.invoke('sutifinanzas',{body:{action:'LOAD'}});
    if(identity()!==subject)throw Error('CONTEXT_CHANGED');
    if(response.error){let body;try{body=await response.error.context.clone().json();}catch(_){}const error=Error(body?.error||'SOURCE_UNAVAILABLE');error.details=body||{};throw error;}
    if(response.data?.version!==1||!Array.isArray(response.data.records))throw Error('RESPONSE_INVALID');
    return response.data;
  }
  window.SutifinanzasModel=Object.freeze({normalize,filter,summarize,explore,levels,fields,pivot,visibleRows});
  window.SutifinanzasRepository=Object.freeze({load,identity});
  window.SutifinanzasExport=Object.freeze({buildWorkbook,excel});
})();
