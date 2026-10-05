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
  function identity(){const auth=window.AffiliateAuth.getState(),admin=window.AdminRepository.getState();return JSON.stringify([auth.phase,auth.session?.user?.id,auth.affiliate?.id,auth.impersonation,admin.phase,admin.subjectKey,admin.assignment]);}
  async function load(){
    const subject=identity();
    const response=await window.SutiSupabase.getClient().functions.invoke('sutifinanzas',{body:{action:'LOAD'}});
    if(identity()!==subject)throw Error('CONTEXT_CHANGED');
    if(response.error){let body;try{body=await response.error.context.clone().json();}catch(_){}const error=Error(body?.error||'SOURCE_UNAVAILABLE');error.details=body||{};throw error;}
    if(response.data?.version!==1||!Array.isArray(response.data.records))throw Error('RESPONSE_INVALID');
    return response.data;
  }
  window.SutifinanzasModel=Object.freeze({normalize,filter,summarize,explore,levels,fields,pivot});
  window.SutifinanzasRepository=Object.freeze({load,identity});
})();
