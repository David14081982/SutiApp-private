// Read-only projection of original source values. Money is integer cents internally.
import {sourceDate,fundGroup,requestStatus,ReportError} from './report.mjs';
export const CASH_FLOW_LOAN_FUNDS=Object.freeze({loanSavings:'Caja de Ahorro',sutiexpress:'Sutiexpress',pettyCash:'Caja Chica',advance:'Adelantos de Nómina'});
const text=v=>String(v??'').trim();
const money=value=>{const v=typeof value==='string'&&/^\d+(\.\d{1,2})?$/.test(value.trim())?Number(value.trim()):value;return typeof v==='number'&&Number.isFinite(v)&&v>=0&&Number.isSafeInteger(Math.round(v*100))&&Math.abs(v*100-Math.round(v*100))<.00001?Math.round(v*100):null;};
const unique=values=>[...new Set(values)];
const sum=values=>{const n=values.reduce((a,v)=>a+v,0);if(!Number.isSafeInteger(n))throw new ReportError('AMOUNT_OVERFLOW');return n;};
const monthEnd=key=>{const [y,m]=key.split('-').map(Number);return new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);};
const family=value=>{const f=fundGroup(value);return Object.hasOwn(CASH_FLOW_LOAN_FUNDS,f)?f:null;};
const one=values=>{const valid=values.filter(v=>v!==null&&v!==undefined&&v!=='');return valid.length&&unique(valid).length===1?valid[0]:null;};
const amount=value=>value===null?null:value/100;

/** entries: {fund,metric,record}; issues: {fund,metrics,dates,...}.
 * loanContracts contains one summary per C. Source values and calendars are never rewritten. */
export function deriveCashFlowLoans({loans,requests=[],approvals=null,asOf,months}){
 if(!Array.isArray(loans)||!loans.every(Array.isArray)||!Array.isArray(requests)||!requests.every(Array.isArray)||approvals!==null&&(!Array.isArray(approvals)||!approvals.every(Array.isArray))||!Array.isArray(months)||!months.every(m=>typeof m?.key==='string'&&sourceDate(m.key+'-01'))||!sourceDate(asOf))throw new ReportError('CASH_FLOW_SOURCE_INVALID');
 const groups=new Map(),requestGroups=new Map(),zeroBalances=new Map(),zeroDisclosures=new Map(),entries=[],issues=[],unassigned=[],loanContracts=[],funds=new Set(),current=asOf.slice(0,7);
 const monthKeys=new Set(months.map(m=>m.key)),cuts=new Map(months.map(m=>[m.key,m.key===current?asOf:monthEnd(m.key)]));
 const dates=new Map(),families=new Map(),statuses=new Map();
 const dateOf=value=>{if(!dates.has(value))dates.set(value,sourceDate(value));return dates.get(value);};
 const familyOf=value=>{if(!families.has(value))families.set(value,family(value));return families.get(value);};
 const statusOf=value=>{if(!statuses.has(value))statuses.set(value,requestStatus(value));return statuses.get(value);};
 const get=(map,key)=>{if(!map.has(key))map.set(key,[]);return map.get(key);};
 loans.slice(1).forEach((v,i)=>{const fund=familyOf(v[6]);if(fund){funds.add(fund);get(groups,text(v[2])||'ROW:'+String(i+2)).push({v,row:i+2,fund});}});
 requests.slice(1).forEach((v,i)=>{const fund=familyOf(v[4]);if(fund&&text(v[0])){funds.add(fund);get(requestGroups,text(v[0])).push({v,row:i+2,fund});}});
 const emit=(fund,metric,record)=>{if(monthKeys.has(record.date?.slice(0,7)))entries.push({fund,metric,record});};
 const emitDisclosure=(fund,metric,record)=>{
  if(record.amount!==0){emit(fund,metric,record);return;}
  const key=fund+':'+metric+':'+record.date.slice(0,7);
  if(!zeroDisclosures.has(key))zeroDisclosures.set(key,{fund,metric,first:record,quotaIds:[]});
  zeroDisclosures.get(key).quotaIds.push(record.parentRecordId);
 };
 const zeroBalance=(fund,metric,column,month,common,C)=>{
  const key=fund+':'+metric+':'+month;
  if(!zeroBalances.has(key))zeroBalances.set(key,{fund,metric,column,month,common,loanIds:[]});
  zeroBalances.get(key).loanIds.push(C);
 };
 const problem=(fund,metrics,code,message,sourceIds,dates=[])=>issues.push({fund,metrics,code,message,sourceIds,dates:unique(dates.filter(Boolean))});
 // Placement authority (owner decision 2026-11-25): HISTORIAL DE PRESTAMOS holds one row per
 // granted loan. Count and placed capital come only from it: E program, H amount, J approval date.
 const approvalsByLoan=new Map();
 if(approvals)approvals.slice(1).forEach((v,i)=>{
  const fund=familyOf(v[4]);if(!fund)return;funds.add(fund);
  const row=i+2,id='approval:'+row,loanId=text(v[0])||null,date=dateOf(v[9]),principal=money(v[7]);
  if(loanId)get(approvalsByLoan,loanId).push({row,date,principal});
  const common={source:'HISTORIAL DE PRESTAMOS',sourceId:'Fila '+row,sourceRow:row,sourceIds:[id],loanId,folio:text(v[1])||null,name:text(v[2])||null,fund:CASH_FLOW_LOAN_FUNDS[fund],date,status:'RECORDED',dateBasis:'HISTORIAL DE PRESTAMOS · J (Fecha de aprobación)'};
  const count={...common,id:'count:'+id,amount:1,basis:'APPROVED_LOAN_ROW'},placed={...common,id:'capital:'+id,amount:amount(principal),basis:'APPROVAL_DATE_PLACEMENT',note:principal===null?'La cantidad del préstamo (columna H) no es un importe interpretable.':undefined};
  if(!date||date>asOf){
   unassigned.push({...count,metric:'count',status:'UNASSIGNED'},{...placed,metric:'placed',status:'UNASSIGNED'});
   problem(fund,[],'LOAN_APPROVAL_DATE_UNRESOLVED','HISTORIAL DE PRESTAMOS fila '+row+(loanId?' (préstamo '+loanId+')':'')+': fecha de aprobación ausente, no interpretable o posterior al corte; no se asigna a un mes.',[id]);
   return;
  }
  emit(fund,'count',count);emit(fund,'placed',placed);
  if(principal===null)problem(fund,['placed'],'LOAN_APPROVAL_AMOUNT_INVALID','HISTORIAL DE PRESTAMOS fila '+row+': la cantidad del préstamo no es un importe interpretable; el préstamo se cuenta y su capital queda sin determinar.',[id],[date]);
 });
 if(approvals)for(const [loanId,rows]of approvalsByLoan)if(rows.length>1)problem(familyOf(approvals[rows[0].row-1][4]),[],'LOAN_APPROVAL_ID_REPEATED','El préstamo '+loanId+' aparece en '+rows.length+' filas de HISTORIAL DE PRESTAMOS; cada fila se cuenta como en la hoja.',rows.map(r=>'approval:'+r.row),rows.map(r=>r.date));
 const identities=unique([...groups.keys(),...requestGroups.keys()]);
 let determined=0,partial=0;
 for(const C of identities){
  const group=groups.get(C)||[],matches=requestGroups.get(C)||[],approved=matches.filter(r=>statusOf(r.v[24])==='approved');
  const pv2Ids=group.map(r=>'pv2:'+r.row),requestIds=matches.map(r=>'requests:'+r.row),sourceIds=[...requestIds,...pv2Ids];
  const requestFunds=unique(approved.map(r=>r.fund)),rowFunds=unique(group.map(r=>r.fund));
  const fund=requestFunds.length===1?requestFunds[0]:requestFunds.length===0&&rowFunds.length===1?rowFunds[0]:null;
  const controls=unique([...approved.map(r=>text(r.v[1])),...group.map(r=>text(r.v[3]))].filter(Boolean));
  const folio=controls.length===1?controls[0]:null,name=one([...approved.map(r=>text(r.v[2])),...group.map(r=>text(r.v[4]))]);
  const rawRequestDates=approved.map(r=>dateOf(r.v[9])),requestDates=unique(rawRequestDates.filter(Boolean));
  const originalDates=unique(group.map(r=>dateOf(r.v[32])).filter(Boolean));
  const authorizationDates=unique(group.map(r=>dateOf(r.v[20])).filter(Boolean));
  // An orphan calendar can identify its original placement only with a recorded authorization.
  const orphanAuthorized=!matches.length&&authorizationDates.length===1&&!C.startsWith('ROW:');
  const authorized=approved.length>0||orphanAuthorized;
  let placementDate=approved.length?rawRequestDates.every(Boolean)&&requestDates.length===1?requestDates[0]:null:orphanAuthorized?originalDates.length===1?originalDates[0]:null:null;
  const dateBasis=approved.length?'Historial de solicitudes · J':originalDates.length===1?'HISTORIAL P V2 · AG':'Fecha de solicitud no registrada';
  const requestAmounts=approved.map(r=>money(r.v[7])),sourcePrincipals=group.map(r=>money(r.v[9])).filter(v=>v!==null);
  const requestPrincipal=approved.length&&requestAmounts.every(v=>v!==null)?one(requestAmounts):null;
  const pv2Principal=one(sourcePrincipals);
  let principal=group.length?pv2Principal:requestPrincipal;
  const reasons=[];
  if(approved.length&&requestPrincipal===null)reasons.push('CAPITAL_SOLICITUD_AMBIGUO');
  if(approved.length>1&&(requestPrincipal===null||controls.length>1)){principal=null;reasons.push('ID_SOLICITUD_DUPLICADO_CONFLICTIVO');}
  if(requestPrincipal!==null&&pv2Principal!==null&&requestPrincipal!==pv2Principal)reasons.push('CAPITAL_SOLICITADO_DIFIERE_OTORGADO_PV2');
  if(group.some(r=>typeof r.v[9]==='string'&&money(r.v[9])!==null)||approved.some(r=>typeof r.v[7]==='string'&&money(r.v[7])!==null))reasons.push('IMPORTE_NUMERICO_ORIGINAL_EN_TEXTO');
  if(!approved.length&&sourcePrincipals.length&&pv2Principal===null)reasons.push('CAPITAL_PV2_AMBIGUO');
  if(controls.length>1)reasons.push('FOLIO_AMBIGUO');
  if(requestFunds.length>1||rowFunds.length>1||fund&&rowFunds.some(f=>f!==fund))reasons.push('PROGRAMA_AMBIGUO');
  if(approved.length&&approved.length!==matches.length)reasons.push('ESTADOS_SOLICITUD_DIFERENTES');
  const requestTotals=approved.map(r=>money(r.v[8])),rowTotals=group.map(r=>money(r.v[10])).filter(v=>v!==null);
  const total=one([...requestTotals.filter(v=>v!==null),...rowTotals]);
  if(total===null&&requestTotals.length+rowTotals.length)reasons.push('TOTAL_CONTRATO_AMBIGUO');
  const origin={loanId:C,folio,name,fund:fund?CASH_FLOW_LOAN_FUNDS[fund]:null,source:approved.length?'Historial de solicitudes':'HISTORIAL P V2',sourceId:approved.length?'Solicitud '+C:'Préstamo '+C,sourceIds,date:placementDate,basis:'ORIGINAL_PLACEMENT_DATE',dateBasis,originalPrincipal:amount(principal),originalTotal:amount(total),requestDates};
  // Count and placed capital are emitted from HISTORIAL DE PRESTAMOS above. The request date
  // below only qualifies the balance calculation; it never places or counts a loan.
  if(authorized&&fund){
   if(!placementDate)reasons.push('FECHA_SOLICITUD_AMBIGUA');
   if(placementDate&&placementDate>asOf)reasons.push('FECHA_SOLICITUD_FUTURA');
   if(!placementDate||placementDate>asOf)problem(fund,[],'LOAN_DATE_UNRESOLVED','Préstamo '+C+': fecha de solicitud ausente, ambigua o posterior al corte; su saldo pendiente no puede calcularse.',sourceIds);
  }
  const approvalRows=approvalsByLoan.get(C)||[],approvalDates=unique(approvalRows.map(r=>r.date).filter(Boolean));
  if(approvals&&authorized&&fund&&!approvalRows.length)reasons.push('SIN_REGISTRO_EN_HISTORIAL_DE_PRESTAMOS');
  if(!authorized&&group.length)reasons.push(matches.length?'SIN_SOLICITUD_AUTORIZADA':'SIN_FECHA_AUTORIZACION_VINCULADA');
  if(authorized&&!fund)reasons.push('PROGRAMA_COLOCACION_AMBIGUO');
  const payments=[];
  const knownSourcePrincipal=sum(group.map(r=>money(r.v[29])).filter(v=>v!==null));
  const principalCapConflict=principal!==null&&knownSourcePrincipal>principal;
  if(principalCapConflict)reasons.push('AD_ACUMULADO_SUPERA_CAPITAL_ORIGINAL');
  const invalidQuota=group.some(r=>!dateOf(r.v[0])||money(r.v[1])===null);
  for(const item of group){
   const {v,row}=item,rowFund=item.fund,date=dateOf(v[0]),B=money(v[1]),id='pv2:'+row;
   if(!date||B===null){
    problem(rowFund,date?['recovered','scheduled']:[],'LOAN_QUOTA_INVALID','La cuota conserva una fecha o importe no interpretable.',[id],date?[date]:[]);
    unassigned.push({id,loanId:C,folio,source:'HISTORIAL P V2',sourceId:'Fila '+row,date,amount:amount(B),status:'UNASSIGNED'});continue;
   }
   const scheduled=date>asOf,suffix=scheduled?'_scheduled':'',metric=scheduled?'scheduled':'recovered';
   let principalPart=money(v[29]),interestPart=money(v[27]),adminPart=money(v[25]),capitalInterest=money(v[28]);
   const componentReasons=[];
   if(capitalInterest!==null&&principalPart!==null&&interestPart!==null&&Math.abs(capitalInterest-principalPart-interestPart)>8){
    principalPart=null;interestPart=null;componentReasons.push('AC_NO_COINCIDE_CON_AB_AD');
   }
   if(principalCapConflict){principalPart=null;componentReasons.push('AD_ACUMULADO_SUPERA_CAPITAL_ORIGINAL');}
   const originalParts={principal:principalPart,interest:interestPart,admin:adminPart};
   const numeric=sum(Object.values(originalParts).filter(v=>v!==null));
   if(numeric>B+8){principalPart=null;interestPart=null;adminPart=null;componentReasons.push('COMPONENTES_SUPERAN_CUOTA');}
   let parts={principal:principalPart,interest:interestPart,admin:adminPart},known=sum(Object.values(parts).filter(v=>v!==null)),difference=B-known;
   // A small signed difference is a disclosure, never a new charge or principal allocation.
   let rounding=0,unallocated=difference;
   if(Object.values(parts).every(v=>v!==null)&&Math.abs(difference)<=8){rounding=difference;unallocated=0;}
   else if(difference<0){parts={principal:null,interest:null,admin:null};known=0;unallocated=B;componentReasons.push('DESGLOSE_PARCIAL_SUPERA_CUOTA');}
   if(Object.values(parts).some(v=>v===null))componentReasons.push('COMPONENTE_ORIGINAL_NO_NUMERICO');
   if(monthKeys.has(date.slice(0,7))){
   const record={id,source:'HISTORIAL P V2',sourceId:'Fila '+row,sourceRow:row,sourceIds:[id],loanId:C,folio:text(v[3])||null,name:text(v[4])||null,fund:CASH_FLOW_LOAN_FUNDS[rowFund],installment:v[18]??null,date,period:date.slice(0,7),amount:B/100,registeredAmount:B/100,status:scheduled?'SCHEDULED':'RECORDED',basis:'PV2_ORIGINAL_COMPONENTS',principal:amount(parts.principal),interest:amount(parts.interest),administration:amount(parts.admin),unallocated:unallocated/100,rounding:rounding/100,sourceColumns:{amount:'B',principal:'AD',interest:'AB',administration:'Z',capitalInterest:'AC'},componentReasons};
   emit(rowFund,metric,record);
   for(const component of ['principal','interest','admin'])emit(rowFund,component+suffix,{id:id+':'+component,parentRecordId:id,date,amount:amount(parts[component]),note:parts[component]===null?'Componente original pendiente de clasificación.':undefined});
   emitDisclosure(rowFund,'unallocated'+suffix,{id:id+':unallocated',parentRecordId:id,date,amount:unallocated/100});
   emitDisclosure(rowFund,'rounding'+suffix,{id:id+':rounding',parentRecordId:id,date,amount:rounding/100});
   }
   if(componentReasons.length)problem(rowFund,[], 'LOAN_SOURCE_COMPONENT_REVIEW','La cuota B se conserva; el desglose utiliza únicamente componentes originales interpretables.',[id],[date]);
   payments.push({date,B,...parts,row,fund:rowFund,rounding,unallocated});
  }
  // One original capital per loan. A missing component does not erase another loan's balance.
  if(fund&&group.length&&authorized){
   const ordered=payments.slice().sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0),prefix={principal:[0],interest:[0],admin:[0]},unknown={principal:[0],interest:[0],admin:[0]};
   for(const payment of ordered)for(const component of ['principal','interest','admin']){
    const last=prefix[component].at(-1),value=payment[component],next=last+(value??0);
    if(!Number.isSafeInteger(next))throw new ReportError('AMOUNT_OVERFLOW');
    prefix[component].push(next);unknown[component].push(unknown[component].at(-1)+(value===null?1:0));
   }
   const identitySafe=controls.length<=1&&rowFunds.length<=1&&(!rowFunds.length||rowFunds[0]===fund),validDate=!!placementDate&&!invalidQuota&&ordered.every(p=>p.date>=placementDate);
   for(const month of months){
    const cut=cuts.get(month.key);
    if(placementDate&&placementDate>cut&&!ordered.some(p=>p.date<=cut))continue;
    let low=0,high=ordered.length;
    while(low<high){const mid=(low+high)>>>1;if(ordered[mid].date<=cut)low=mid+1;else high=mid;}
    const validPrincipal=!principalCapConflict&&principal!==null&&unknown.principal[low]===0;
    const paidPrincipal=validPrincipal?prefix.principal[low]:null;
    const pending=validDate&&identitySafe&&validPrincipal&&paidPrincipal<=principal?principal-paidPrincipal:null;
    const status=month.key>current?'SCHEDULED':'RECORDED';
    const firstEvidence=[...authorizationDates,...ordered.map(p=>p.date)].sort()[0],originalVisible=placementDate&&placementDate<=cut||firstEvidence&&firstEvidence<=cut;
    const common={source:'HISTORIAL P V2 y solicitud autorizada',sourceId:'Préstamo '+C,loanId:C,folio,name,fund:CASH_FLOW_LOAN_FUNDS[fund],date:cut,status,sourceIds,originalPrincipal:amount(principal),principalApplied:amount(paidPrincipal),dateBasis,placementDate};
    emit(fund,'pending_determined',{...common,id:'determined:'+C+':'+month.key,amount:pending===null?0:amount(pending),basis:'DETERMINED_BALANCE_SUBTOTAL'});
    emit(fund,'pending_unresolved_original',{...common,id:'unresolved:'+C+':'+month.key,amount:pending===null?(originalVisible?amount(principal):null):0,basis:'ORIGINAL_CAPITAL_UNRESOLVED_BALANCE',note:pending===null?'Capital original de un préstamo cuyo saldo no se puede determinar; no es saldo pendiente ni efectivo.':undefined});
    const scheduledParts=[['interest_pending','interest','AB'],['admin_pending','admin','Z']].map(([metric,component,column])=>({metric,column,value:validDate&&identitySafe&&unknown[component].at(-1)===unknown[component][low]?prefix[component].at(-1)-prefix[component][low]:null}));
    if(pending===0)zeroBalance(fund,'pending','AD',month.key,common,C);
    else emit(fund,'pending',{...common,id:'pending:'+C+':AD:'+month.key,amount:amount(pending),basis:'ORIGINAL_PRINCIPAL_MINUS_SOURCE_AD',note:pending===null?'El saldo de este pr\u00e9stamo no puede determinarse sin resolver su capital, fecha o componente AD.':undefined});
    for(const {metric,column,value}of scheduledParts){
     if(value===0)zeroBalance(fund,metric,column,month.key,common,C);
     else emit(fund,metric,{...(pending===0?common:{parentRecordId:'pending:'+C+':AD:'+month.key}),id:'pending:'+C+':'+column+':'+month.key,date:cut,amount:amount(value),basis:'REGISTERED_CALENDAR_AFTER_CUTOFF',note:value===null?'Componentes futuros originales pendientes de clasificaci\u00f3n.':undefined});
    }
   }
  }else if(authorized&&fund&&!group.length){
   // An approved loan is placed even before its calendar is generated.
   for(const month of months){
    const cut=cuts.get(month.key);if(!placementDate||placementDate>cut)continue;
    const common={...origin,date:cut,status:month.key>current?'SCHEDULED':'RECORDED',basis:'AUTHORIZED_PRINCIPAL_NO_CALENDAR'};
    emit(fund,'pending',{...common,id:'pending:'+C+':AD:'+month.key,amount:null,note:'El capital original no demuestra el saldo pendiente sin el calendario de cuotas.'});
    emit(fund,'pending_unresolved_original',{...common,id:'unresolved:'+C+':'+month.key,amount:amount(principal),basis:'ORIGINAL_CAPITAL_UNRESOLVED_BALANCE'});
    for(const [metric,column]of [['interest_pending','AB'],['admin_pending','Z']])emit(fund,metric,{...common,id:'pending:'+C+':'+column+':'+month.key,amount:null,note:'El calendario original de este pr\u00e9stamo a\u00fan no est\u00e1 registrado.'});
   }
   reasons.push('CALENDARIO_AUN_NO_REGISTRADO');
  }
  const summary={loanId:C,folio,name,fund:fund?CASH_FLOW_LOAN_FUNDS[fund]:null,authorized,status:authorized?'AUTORIZADO':'SIN_AUTORIZACION_VINCULADA',placementDate:approvalDates.length===1?approvalDates[0]:null,dateBasis:'HISTORIAL DE PRESTAMOS · J (Fecha de aprobación)',requestPlacementDate:placementDate,requestDateBasis:dateBasis,approvalRows:approvalRows.map(r=>r.row),principal:amount(principal),total:amount(total),requestRows:matches.map(r=>r.row),pv2Rows:group.map(r=>r.row),requestDates,requestStates:unique(matches.map(r=>text(r.v[24]))),issues:unique(reasons),source:'Google · SutiApp Final',componentRows:payments.length,componentRowsPending:payments.filter(p=>[p.principal,p.interest,p.admin].some(v=>v===null)||p.unallocated!==0).length};
  loanContracts.push(summary);if(summary.componentRowsPending||reasons.length)partial++;else determined++;
  if(reasons.length&&fund)problem(fund,[],'LOAN_SOURCE_RELATION_REVIEW','Revisar las referencias originales del préstamo: '+unique(reasons).join(', ')+'.',sourceIds,requestDates);
 }
 // Granted loans without request or calendar rows remain traceable in Base Contratos.
 const known=new Set(identities);
 for(const [loanId,rows]of approvalsByLoan)if(!known.has(loanId)){
  const v=approvals[rows[0].row-1],fund=familyOf(v[4]),dates=unique(rows.map(r=>r.date).filter(Boolean));
  loanContracts.push({loanId,folio:text(v[1])||null,name:text(v[2])||null,fund:CASH_FLOW_LOAN_FUNDS[fund],authorized:true,status:'AUTORIZADO',placementDate:dates.length===1?dates[0]:null,dateBasis:'HISTORIAL DE PRESTAMOS · J (Fecha de aprobación)',requestPlacementDate:null,requestDateBasis:null,approvalRows:rows.map(r=>r.row),principal:rows.length===1?amount(rows[0].principal):null,total:null,requestRows:[],pv2Rows:[],requestDates:[],requestStates:[],issues:['SIN_SOLICITUD_NI_CALENDARIO_VINCULADO'],source:'Google · SutiApp Final',componentRows:0,componentRowsPending:0});
  partial++;
 }
 // No silent substitute: without the authoritative sheet, count and placed capital stay unavailable.
 if(!approvals)for(const fund of funds)problem(fund,['count','placed'],'LOAN_APPROVALS_UNAVAILABLE','No se recibió HISTORIAL DE PRESTAMOS; el número de préstamos y el capital colocado quedan sin determinar.',[]);
 // Only determined zeros are coalesced. Base Contratos keeps every loan and its
 // source references; nonzero and unknown balances remain individually detailed.
 for(const {fund,metric,column,month,common,loanIds}of zeroBalances.values()){
  if(loanIds.length===1)emit(fund,metric,{...common,id:'pending:'+loanIds[0]+':'+column+':'+month,amount:0,basis:metric==='pending'?'ORIGINAL_PRINCIPAL_MINUS_SOURCE_AD':'REGISTERED_CALENDAR_AFTER_CUTOFF',note:undefined});
  else emit(fund,metric,{
   id:'zero:'+fund+':'+metric+':'+month,source:'Base Contratos',sourceId:loanIds.length+' pr\u00e9stamos con este saldo cero; consultar sus IDs en Base Contratos',
   loanIds,countLoans:loanIds.length,date:common.date,fund:CASH_FLOW_LOAN_FUNDS[fund],amount:0,status:common.status,
   sourceIds:loanIds.map(C=>'loan:'+C),basis:'DETERMINED_ZERO_BALANCES',
   note:'Agrupa exclusivamente saldos determinados en cero de este concepto; cada pr\u00e9stamo y sus cuotas originales se conservan en las bases.'
  });
 }
 for(const {fund,metric,first,quotaIds}of zeroDisclosures.values()){
  if(quotaIds.length===1)emit(fund,metric,first);
  else emit(fund,metric,{
   id:'zero:quotas:'+fund+':'+metric+':'+first.date.slice(0,7),source:'HISTORIAL P V2',
   sourceId:quotaIds.length+' cuotas con este componente en cero; detalle en cada cuota de Base PV2 y Base C\u00e1lculo',
   date:first.date,fund:CASH_FLOW_LOAN_FUNDS[fund],amount:0,status:metric.endsWith('_scheduled')?'SCHEDULED':'RECORDED',
   sourceIds:quotaIds,quotaIds,basis:'ZERO_SOURCE_DISCLOSURES',countQuotas:quotaIds.length
  });
 }
 return {entries,issues,unassigned,loanContracts,funds:[...funds].map(id=>({id,label:CASH_FLOW_LOAN_FUNDS[id]})),coverage:{loanCount:identities.length,determinedLoans:determined,protectedLoans:partial,derivedForecastRows:0,componentAuthority:'HISTORIAL P V2 · Z, AB, AC, AD',placementAuthority:'HISTORIAL DE PRESTAMOS: una fila por préstamo otorgado; programa E, cantidad H, fecha de aprobación J',financialWrites:0}};
}
