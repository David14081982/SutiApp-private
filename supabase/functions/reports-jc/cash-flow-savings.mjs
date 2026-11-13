// Read-only explanation of accepted savings balances. A basis change is never cash.
import {ReportError,sourceDate} from './report.mjs';

const FLOW_SIGNS={contribution:1,contribution_mixed:1,yield_credited:1,adjustment:1,withdrawal_partial:-1,withdrawal_total:-1,withdrawal_unspecified:-1};
const LABELS={contribution:'Aportación registrada',contribution_mixed:'Aportación y rendimiento históricos',yield_credited:'Rendimiento acreditado',adjustment:'Ajuste registrado',withdrawal_partial:'Retiro parcial pagado',withdrawal_total:'Retiro total pagado',withdrawal_unspecified:'Retiro pagado sin clasificación',contribution_scheduled:'Aportación programada',withdrawal_pending:'Retiro autorizado pendiente'};
const cents=v=>typeof v==='number'&&Number.isFinite(v)&&Number.isSafeInteger(Math.round(v*100))&&Math.abs(v*100-Math.round(v*100))<.00001?Math.round(v*100):null;
const sum=values=>values.reduce((a,b)=>{const n=a+b;if(!Number.isSafeInteger(n))throw new ReportError('AMOUNT_OVERFLOW');return n;},0);
const previousDay=day=>new Date(Date.parse(day+'T00:00:00Z')-86400000).toISOString().slice(0,10);
const endOfMonth=month=>{const[y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);};
const period=date=>date?date.slice(0,7)+(Number(date.slice(8,10))<=15?' · primera quincena':' · segunda quincena'):'Sin fecha registrada';
function cell(value,status='RECORDED',notes=[],ids=[]){return {amount:value===null?null:value/100,knownAmount:value===null?null:value/100,status:value===null?'UNAVAILABLE':status,sourceIds:ids,notes};}
function unique(rows,key){const m=new Map();for(const r of rows){const id=r[key];if(id===null||id===undefined)throw new ReportError('SAVINGS_SOURCE_ID_REQUIRED');if(m.has(id)&&JSON.stringify(m.get(id))!==JSON.stringify(r))throw new ReportError('SAVINGS_SOURCE_ID_CONFLICT');m.set(id,r);}return m;}

export function reconcileSavingsCashFlow({base,savings}){
 if(!base?.months||!Array.isArray(base.records)||!Array.isArray(savings?.events))throw new ReportError('CASH_FLOW_SOURCE_INVALID');
 const result=structuredClone(base),b=savings.source_bases,current=result.asOf.slice(0,7);
 const reportLabels=new Map(result.rows.map(row=>[row.id,row.label]));
 // Memoization is limited to this calculation; dates shared by a payroll period
 // are validated once, with no persisted cache or alternative source.
 const dateCache=new Map(),normalizedDate=value=>{if(!dateCache.has(value))dateCache.set(value,sourceDate(value));return dateCache.get(value);};
 const required=['accounts','account_balances','current_balances','balance_entries','history','transactions','historical_withdrawals','pending','scheduled'];
 if(!b||required.some(k=>!Array.isArray(b[k]))){
  result.savingsBridge={status:'UNAVAILABLE',financialWrites:0,reason:'SAVINGS_SOURCE_BASES_REQUIRED'};
  result.issues.push({code:'SAVINGS_SOURCE_BASES_REQUIRED',message:'La consulta no incluye las bases necesarias para explicar los saldos por cuenta.',sourceIds:[],months:[],affectedKinds:[]});
  return result;
 }
 const accounts=unique(b.accounts,'id'),identities=unique(b.account_identities||[],'id'),metadata=unique(b.history_metadata||[],'id');
 const history=unique(b.history,'id'),transactions=unique(b.transactions,'id'),withdrawals=unique(b.historical_withdrawals,'id'),pending=unique(b.pending,'id');
 const scheduledByEventId=new Map();
 for(const s of b.scheduled){const id='scheduled:'+s.enrollment_id+':'+s.date;if(!scheduledByEventId.has(id))scheduledByEventId.set(id,s);}
 const enrollmentAccounts=new Map();
 for(const r of [...b.transactions,...b.scheduled])if(r.enrollment_id&&r.participant_id)enrollmentAccounts.set(r.enrollment_id,r.participant_id);
 const identify=id=>{const a=identities.get(id)||{};return {accountId:id||null,name:a.name||'Sin nombre registrado',control:a.control==null?null:String(a.control),account:a.account_label||(a.control!=null?'Cuenta '+a.control:id?'Cuenta registrada':'Sin cuenta vinculada'),sourceReference:a.reference||null};};
 function eventDetails(e){
  let original,meta;
  if(e.id.startsWith('history:')){original=history.get(e.id.slice(8));meta=metadata.get(e.id.slice(8));}
  else if(e.id.startsWith('transaction:'))original=transactions.get(e.source_id||e.id.slice(12));
  else if(e.id.startsWith('historical-withdrawal:'))original=withdrawals.get(e.source_id||e.id.slice(22));
  else if(e.id.startsWith('pending:'))original=pending.get(e.source_id||e.id.slice(8));
  else if(e.kind==='contribution_scheduled')original=scheduledByEventId.get(e.id);
  const accountId=original?.account_id||original?.participant_id||(original?.enrollment_id&&enrollmentAccounts.get(original.enrollment_id))||null;
  return {...identify(accountId),...(original?.source_folio?{control:String(original.source_folio)}:{}),...(original?.name?{name:original.name}:{}),sourceColumn:meta?.source_column||null,sourceLabel:meta?.source_label||null,originalReference:meta?.reference||original?.reference||e.source_id||e.id,sourceSheet:meta?.source_sheet||e.source,sourceRow:meta?.source_row??null,original};
 }
 const events=unique(savings.events,'id'),eventInfo=new Map([...events].map(([id,e])=>[id,eventDetails(e)])),eventDates=new Map([...events].map(([id,e])=>[id,normalizedDate(e.date)]));
 result.records=result.records.map(r=>eventInfo.has(r.id)?{...r,...Object.fromEntries(Object.entries(eventInfo.get(r.id)).filter(([k])=>k!=='original')),period:period(r.date)}:r);
 // Mixed June values remain intact. The original DT split is disclosed only when
 // the existing panel's eligibility and amount checks are supplied by the reader.
 const detailRows=[];
 function detail({type,date,amount,identity={},source,reference,column,applies,note='',opening=null,flow=null,basis=null,closing=null}){
  detailRows.push([type,identity.name||'Sin nombre registrado',identity.control??null,identity.account||'Sin cuenta vinculada',date||null,period(date),amount===null?null:amount/100,source||null,reference||null,column||null,applies||null,note,opening===null?null:opening/100,flow===null?null:flow/100,basis===null?null:basis/100,closing===null?null:closing/100,identity.accountId||null]);
 }
 for(const e of events.values()){
  const info=eventInfo.get(e.id),n=cents(e.amount),meta=metadata.get(e.id.replace(/^history:/,''));
  detail({type:LABELS[e.kind]||e.kind,date:eventDates.get(e.id),amount:n,identity:info,source:info.sourceSheet,reference:info.originalReference,column:info.sourceColumn,applies:reportLabels.get(e.kind)||LABELS[e.kind]||'Concepto pendiente de clasificación',note:info.sourceLabel||''});
  if(e.kind==='contribution_mixed'&&meta?.yield_amount!==null&&meta?.yield_amount!==undefined){
   const y=cents(meta.yield_amount);
   if(n!==null&&y!==null&&y>=0&&y<=n){
    detail({type:'Desglose informativo: rendimiento incluido',date:eventDates.get(e.id),amount:y,identity:info,source:info.sourceSheet,reference:info.originalReference,column:meta.yield_column,applies:'Incluido en aportación y rendimiento históricos; no sumar nuevamente',note:'Componente original; conserva el importe histórico total.'});
    detail({type:'Desglose informativo: aportación incluida',date:eventDates.get(e.id),amount:n-y,identity:info,source:info.sourceSheet,reference:info.originalReference,column:info.sourceColumn+' − '+meta.yield_column,applies:'Incluido en aportación y rendimiento históricos; no sumar nuevamente'});
   }
  }
 }
 // Keep every original basis inspectable, including movements before the window.
 for(const h of history.values())if(!events.has('history:'+h.id)){
  const meta=metadata.get(h.id),identity=identify(h.account_id||h.participant_id);
  detail({type:'Historia anterior / fuera del período',date:normalizedDate(h.date),amount:cents(h.amount),identity,source:meta?.source_sheet||h.source,reference:meta?.reference||h.id,column:meta?.source_column,applies:'Base histórica; no movimiento del período',note:meta?.source_label||''});
 }
 for(const t of transactions.values())if(!events.has('transaction:'+t.id))detail({type:t.transaction_type==='REGULARIZATION'?'Saldo inicial del registro de movimientos (ledger), sin efectivo':'Movimiento del registro de movimientos (ledger) incluido en la base',date:normalizedDate(t.effective_date),amount:cents(t.amount)===null?null:cents(t.amount)*(t.direction==='DEBIT'?-1:1),identity:identify(t.participant_id),source:'savings_transactions',reference:t.id,column:t.component,applies:'Base de saldo; no duplicar movimientos',note:t.transaction_type});
 for(const w of withdrawals.values())if(!events.has('historical-withdrawal:'+w.id))detail({type:'Retiro histórico anterior / fuera del período',date:normalizedDate(w.date),amount:cents(w.amount),identity:{...identify(w.account_id),...(w.name?{name:w.name}:{}),...(w.source_folio?{control:String(w.source_folio)}:{})},source:'Solicitud de retiro',reference:w.reference||w.id,column:'G',applies:'Base histórica; no movimiento del período'});
 for(const c of b.current_balances)detail({type:'Saldo canónico aceptado al corte',date:result.asOf,amount:cents(c.amount),identity:identify(c.id),source:'Supabase · saldo canónico',reference:identify(c.id).sourceReference||c.id,applies:'Saldo acumulado al cierre / corte; no ingreso'});
 const monthly=new Map();
 for(const r of b.account_balances){const key=String(r.month).slice(0,7);if(!monthly.has(key))monthly.set(key,new Map());if(monthly.get(key).has(r.id))throw new ReportError('SAVINGS_BALANCE_ID_CONFLICT');monthly.get(key).set(r.id,{cents:cents(r.known_amount),incomplete:!!r.incomplete});}
 const currentBalances=new Map([...unique(b.current_balances,'id')].map(([id,r])=>[id,{cents:cents(r.amount),incomplete:cents(r.amount)===null}]));
 const openingSource=Array.isArray(b.opening_account_balances)?new Map([...unique(b.opening_account_balances,'id')].map(([id,r])=>[id,{cents:cents(r.known_amount),incomplete:!!r.incomplete}])):null;
 const openingRow={id:'savings_opening_balance',label:'Saldo anterior de Ahorro',group:'Ahorro Voluntario',kind:'balance',unit:'money',cells:[]};
 const basisRow={id:'savings_basis_adjustment',label:'Cambios de base de saldo (sin movimiento de efectivo)',group:'Ahorro Voluntario',kind:'noncash',unit:'money',cells:[]};
 const projectionRow={id:'savings_projected_balance',label:'Saldo proyectado según calendario registrado',group:'Ahorro Voluntario',kind:'scheduled',unit:'money',cells:[]};
 const bridge=[],flowEvents=[...events.values()].filter(e=>Object.hasOwn(FLOW_SIGNS,e.kind)&&eventDates.get(e.id)&&eventDates.get(e.id)<=result.asOf);
 let prior=null,projection=null;
 for(const [i,m]of result.months.entries()){
  if(m.key>current){openingRow.cells.push({...cell(null),status:'NOT_APPLICABLE'});basisRow.cells.push({...cell(null),status:'NOT_APPLICABLE'});continue;}
  const cut=m.key===current?result.asOf:endOfMonth(m.key),closing=m.key===current?currentBalances:monthly.get(m.key),opening=i===0?openingSource:prior;
  prior=closing;
  if(!opening||!closing){openingRow.cells.push(cell(null));basisRow.cells.push(cell(null));bridge.push({month:m.key,status:'UNAVAILABLE',reason:'SAVINGS_OPENING_BASIS_UNAVAILABLE'});continue;}
  const netByAccount=new Map(),idsByAccount=new Map(),unknown=new Set();
  for(const e of flowEvents.filter(e=>eventDates.get(e.id).slice(0,7)===m.key)){
   const info=eventInfo.get(e.id),key=info.accountId||'__unlinked__',n=cents(e.amount);
   if(!idsByAccount.has(key))idsByAccount.set(key,[]);idsByAccount.get(key).push(e.id);
   if(n===null)unknown.add(key);else netByAccount.set(key,(netByAccount.get(key)||0)+n*FLOW_SIGNS[e.kind]);
  }
  const all=new Set([...opening.keys(),...closing.keys(),...netByAccount.keys(),...unknown]),accountRows=[],openingIds=[],basisIds=[];
  for(const id of all){
   const unlinked=id==='__unlinked__',op=opening.get(id),cl=closing.get(id),start=unlinked?0:op?.cents,finish=unlinked?0:cl?.cents,net=netByAccount.get(id)||0;
   const missing=(!unlinked&&(!op||!cl||start===null||finish===null))||unknown.has(id),amount=missing?null:finish-start-net;
   const account=accounts.get(id),transition=account?.opening_on?.slice(0,7)===m.key;
   const reason=unlinked?'WITHDRAWAL_WITHOUT_ACCOUNT':transition?'HISTORY_TO_LEDGER':m.key===current?'CANONICAL_CUTOFF':'RECORDED_BASIS_DIFFERENCE';
   const labels={WITHDRAWAL_WITHOUT_ACCOUNT:'Movimiento sin cuenta vinculada; no forma parte del subtotal de saldos',HISTORY_TO_LEDGER:'Cambio de historia registrada al saldo inicial del registro de movimientos (ledger)',CANONICAL_CUTOFF:'Diferencia entre historia acumulada y saldo canónico al corte',RECORDED_BASIS_DIFFERENCE:'Diferencia explicativa entre movimientos y bases de saldo registradas'};
   const identity=identify(unlinked?null:id),incomplete=missing||!!op?.incomplete||!!cl?.incomplete;
   accountRows.push({accountId:unlinked?null:id,month:m.key,opening:start??null,netMovements:net,basisAdjustment:amount,closing:finish??null,incomplete,reason,sourceIds:idsByAccount.get(id)||[]});
   detail({type:'Puente de saldo por cuenta',date:cut,amount,identity,source:'Supabase · bases de saldo',reference:identity.sourceReference||'Cuenta registrada · '+(identity.control||'sin control'),applies:'Cambios de base de saldo; sin movimiento de efectivo',note:labels[reason],opening:start??null,flow:net,basis:amount,closing:finish??null});
   const openingId='savings-opening:'+m.key+':'+id,basisId='savings-basis:'+m.key+':'+id;
   openingIds.push(openingId);basisIds.push(basisId);
   result.records.push({id:openingId,kind:openingRow.id,date:m.key+'-01',sourceDate:previousDay(m.key+'-01'),amount:start==null?null:start/100,...identity,source:'Base de saldo de Ahorro al cierre anterior',sourceId:identity.sourceReference||id,basis:'OPENING_BALANCE',note:'Saldo anterior; no constituye un ingreso del período.',status:op?.incomplete?'PARTIAL':start==null?'UNAVAILABLE':'CALCULATED'});
   result.records.push({id:basisId,kind:basisRow.id,date:cut,amount:amount==null?null:amount/100,...identity,source:'Puente de saldos de Ahorro',sourceId:identity.sourceReference||id,basis:'NON_CASH_BASIS_CHANGE',reason,note:labels[reason],status:incomplete?'PARTIAL':'CALCULATED'});
  }
  const knownOpening=sum(accountRows.map(r=>r.opening||0)),knownClosing=sum(accountRows.map(r=>r.closing||0)),net=sum(accountRows.map(r=>r.netMovements)),adjustment=sum(accountRows.map(r=>r.basisAdjustment||0));
  const missing=accountRows.some(r=>r.incomplete),validEquation=knownOpening+net+adjustment===knownClosing;
  if(!missing&&!validEquation)throw new ReportError('SAVINGS_BRIDGE_ARITHMETIC_INVALID');
  const status=missing?'PARTIAL':'CALCULATED',note='Explicación del saldo registrado. Los cambios de base no son ingresos, egresos ni dinero disponible.';
  openingRow.cells.push({...cell(knownOpening,status,[note],openingIds),amount:missing?null:knownOpening/100});
  basisRow.cells.push({...cell(adjustment,status,[note],basisIds),amount:missing?null:adjustment/100});
  const reported=result.rows.find(r=>r.id==='savings_balance')?.cells[i],reportedKnown=cents(reported?.knownAmount);
  if(reportedKnown!==null&&knownClosing!==reportedKnown)throw new ReportError('SAVINGS_BALANCE_BASIS_MISMATCH');
  bridge.push({month:m.key,cutoff:cut,status,opening:knownOpening/100,netMovements:net/100,basisAdjustment:adjustment/100,closing:knownClosing/100,equationValid:validEquation,accounts:accountRows});
 }
 // Only recorded future instructions extend the accepted current balance.
 const presentAmounts=[...currentBalances.values()],projectionUnknown=presentAmounts.some(r=>r.cents===null);
 const recordIds=new Set(result.records.map(r=>r.id));
 const futureInstructions=[...events.values()].filter(e=>['contribution_scheduled','withdrawal_pending','withdrawal_partial','withdrawal_total','withdrawal_unspecified'].includes(e.kind)&&eventDates.get(e.id)>result.asOf);
 projection=projectionUnknown?null:sum(presentAmounts.map(r=>r.cents));let projectionMissing=projectionUnknown;
 for(const m of result.months){
  if(m.key<current){projectionRow.cells.push({...cell(null),status:'NOT_APPLICABLE'});continue;}
  // Include scheduled months between today and a future report start as well.
  const lower=m===result.months[0]?result.asOf:(m.key===current?result.asOf:previousDay(m.key+'-01'));
  const upper=endOfMonth(m.key),planned=futureInstructions.filter(e=>eventDates.get(e.id)>lower&&eventDates.get(e.id)<=upper);
  for(const e of planned){
   const n=cents(e.amount);if(n===null)projectionMissing=true;else if(projection!==null)projection=sum([projection,n*(e.kind==='contribution_scheduled'?1:-1)]);
   if(!recordIds.has(e.id)){const info=eventInfo.get(e.id);result.records.push({...e,...Object.fromEntries(Object.entries(info).filter(([k])=>k!=='original')),sourceId:e.source_id||info.originalReference,kind:e.kind==='contribution_scheduled'?e.kind:'withdrawal_pending',status:'SCHEDULED',note:'Instrucción existente incluida en la proyección desde el saldo al corte.'});recordIds.add(e.id);}
  }
  projectionRow.cells.push({...cell(projection,'SCHEDULED',['Proyección de instrucciones existentes; no presume rendimiento futuro ni crea movimientos.'],planned.map(e=>e.id)),amount:projectionMissing?null:projection/100,status:projectionMissing?'PARTIAL':'SCHEDULED'});
 }
 // A partial historical sum is not a total balance comparable with the canonical cutoff.
 for(const row of [openingRow,projectionRow,...result.rows.filter(r=>r.id==='savings_balance')])for(const c of row.cells)if(c.amount===null&&c.status==='PARTIAL'){c.determinedSubtotal=c.knownAmount;c.knownAmount=null;c.status='UNAVAILABLE';c.reconciliationPending=true;c.notes.push('Saldo total pendiente por historia incompleta. La base conserva los importes registrados; no se trasladan diferencias a fechas supuestas.');}
 result.rows=result.rows.flatMap(r=>r.id==='savings_balance'?[openingRow,basisRow,r,projectionRow]:[r]);
 result.savingsBridge={status:bridge.some(r=>r.status==='UNAVAILABLE')?'PARTIAL':'AVAILABLE',financialWrites:0,months:bridge};
 result.savingsSourceTable={name:'Base Ahorro',authority:'Supabase · Ahorro Voluntario',classification:'Valores originales aceptados y puente derivado de saldos; cambios de base no son efectivo',columns:['Tipo','Nombre','Número de control','Cuenta','Fecha','Quincena','Importe','Fuente','Referencia original','Columna / componente','Aplicación en el reporte','Explicación','Saldo anterior','Movimientos netos','Cambio de base sin efectivo','Saldo final','ID técnico de cuenta'],rows:detailRows};
 return result;
}
