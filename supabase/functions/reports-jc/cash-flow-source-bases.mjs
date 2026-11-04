// Read-only, human-readable evidence for the exact response exported to Excel.
import {sourceDate,fundGroup} from './report.mjs';

const text=v=>String(v??'').trim();
const scalar=v=>v===undefined||v===null?null:typeof v==='boolean'?(v?'Sí':'No'):typeof v==='number'&&Number.isFinite(v)?v:typeof v==='string'?v:null;
const number=v=>typeof v==='number'&&Number.isFinite(v)?v:typeof v==='string'&&/^-?\d+(\.\d+)?$/.test(v.trim())?Number(v):scalar(v);
const ids=v=>Array.isArray(v)?v.map(x=>typeof x==='object'&&x!==null?x.message||x.code||x.id||'Referencia pendiente':String(x)).join(' | '):scalar(v);
const loanFund=v=>['loanSavings','pettyCash','sutiexpress','advance'].includes(fundGroup(v))||/^suti\s*pr[eé]stamos?$/i.test(text(v));
const state=v=>({RECORDED:'Registrado',SCHEDULED:'Programado',PARTIAL:'Subtotal identificado',UNAVAILABLE:'Pendiente de desglose',NOT_APPLICABLE:'',PENDING:'Pendiente',CALCULATED:'Calculado',active:'Vigente',renewed:'Renovado',closed:'Cerrado',contribution:'Aportación',withdrawal:'Retiro',yield:'Rendimiento',adjustment:'Ajuste sin efectivo',historical:'Histórico',review:'Revisión de origen',capital:'Capital',interest:'Interés',yield_paid:'Rendimiento pagado',other:'Otro movimiento',in:'Entrada',out:'Salida'})[v]??scalar(v);
const col=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
function table(name,authority,classification,columns,rows){return {name,authority,classification,columns,rows:rows.map(row=>row.map(scalar))};}

function googleTable(name,source,columns,accept,dateCols,numericCols){
 const idCols=name==='Base PV2'?[2,3]:[0,1];
 const dates=new Map(),dateValue=v=>{if(!dates.has(v))dates.set(v,sourceDate(v)||String(v));return dates.get(v);};
 return table(name,'Google · SutiApp Final','Valores de origen. Fechas e importes en formato legible; ID y control conservados como texto.',
  ['Referencia de origen','Fila de la hoja',...columns.map(i=>col(i)+' · '+(source[0]?.[i]||'Columna '+col(i)))],
  source.slice(1).flatMap((row,i)=>accept(row)?[[`${name==='Base PV2'?'pv2':'requests'}:${i+2}`,i+2,...columns.map(c=>{
   const v=row[c];if(v===null||v===undefined||v==='')return v??null;
   return idCols.includes(c)?String(v):dateCols.includes(c)?dateValue(v):numericCols.includes(c)?number(v):scalar(v);
  })]]:[]));
}

export function investorSourceTable(source={},report={}){
 const contracts=new Map((source.contracts||[]).map(c=>[c.id,c]));
 const columns=['Tipo de registro','Referencia de origen','Inversionista','Número de control','Contrato','Contrato anterior','Fecha de inicio','Fecha de vencimiento','Fecha del movimiento o corte','Concepto','Estado','Entrada o salida','Capital contratado','Aportación nueva registrada','Retiro registrado en origen','Importe del movimiento u obligación','Saldo registrado','Tasa mensual','Fecha del saldo registrado','Inicio del período','Fin del período','Hoja de origen','Fila de origen','Explicación del cálculo','ID del contrato','ID del inversionista','Referencias relacionadas'];
 columns.push(...["Documento original", "Contrato previo de la continuidad", "Capital del contrato previo", "Fecha del saldo anterior", "Saldo anterior de capital", "Saldo final de capital", "Aportaci\u00f3n registrada del per\u00edodo", "Devoluci\u00f3n registrada del per\u00edodo", "Ajuste registrado de capital", "Devoluci\u00f3n programada aplicada", "Cambio contractual sin efectivo", "Hoja del contrato previo", "Fila del contrato previo", "Rendimiento mensual registrado", "D\u00eda de pago registrado"]);
 const rows=[];
 const append=(kind,r,c,values={})=>rows.push([
  kind,r.sourceId||r.source_id||r.id,c?.investor_name||c?.investorName||c?.name,r.numero_control||c?.numero_control,c?.code||r.contractCode||r.contract_id,
  r.previous_contract_code||r.parentCode||c?.parent_code||c?.parent_id,c?.starts_on,c?.ends_on,
  r.effective_on||r.due_on||r.cutoff||r.date||r.month,(report.rows||[]).find(x=>x.id===r.kind)?.label||({investor_contract_continuity:'Continuidad entre contratos',investor_capital_bridge:'Relaci\u00f3n del saldo anterior con el saldo final'})[r.kind]||state(r.concept||r.kind),state(r.status||c?.source_status||c?.status),state(r.direction),
  number(c?.principal),number(c?.registered_contribution),number(c?.registered_withdrawal),number(r.amount),number(c?.registered_current_capital),
  number(c?.monthly_rate),c?.registered_balance_on,r.period_start||r.periodStart,r.period_end||r.periodEnd,
  c?.source_sheet||r.sourceSheet||r.source_sheet,c?.source_row||r.sourceRow||r.source_row,r.detail||r.explanation||values.explanation,c?.id||r.contract_id,c?.investor_id,
  ids(r.sourceIds||r.related_ids||r.parentIds||values.references),
  c?.original_document,r.parentCode||r.previous_contract_code,number(r.previousPrincipal),
  r.openingDate,number(r.openingPrincipal),number(r.closingPrincipal),number(r.registeredContribution),
  number(r.registeredCapitalReturn??r.registeredWithdrawal),number(r.registeredCapitalAdjustment),number(r.projectedCapitalReturn),
  number(r.contractualBalanceChange??r.unattributedCapitalChange),r.parentSourceSheet,r.parentSourceRow,
  number(c?.registered_monthly_yield),c?.registered_payment_day
 ]);
 for(const c of source.contracts||[]){append('Contrato original',c,c);for(const term of c.terms||[])append('Condición contractual registrada',term,c,{explanation:'Cambio registrado en condiciones; no es un movimiento de efectivo.'});}
 for(const m of source.movements||[])append('Movimiento registrado',m,contracts.get(m.contract_id));
 for(const o of source.obligations||[])append('Obligación registrada',o,contracts.get(o.contract_id));
 for(const review of source.reviews||[])append('Revisión de origen',review,contracts.get(review.contract_id));
 for(const r of [...(report.records||[]),...(report.unassigned||[])])if(r.contractId&&String(r.source||'').includes('Inversores')&&!r.parentRecordId){
  append('Cálculo utilizado en el flujo',r,contracts.get(r.contractId));
  for(const p of r.parentSources||[])append('Contrato previo de la continuidad',{
   id:'continuidad:'+p.contractId+':'+r.contractId,date:r.date,amount:p.principal,
   concept:'Capital trasladado al contrato '+(r.contractCode||r.contractId),
   detail:'Capital del contrato previo; forma parte de la continuidad, sin representar una nueva entrada de efectivo.',
   sourceIds:[p.contractId,r.contractId]
  },contracts.get(p.contractId)||{id:p.contractId,code:p.contractCode,source_sheet:p.sourceSheet,source_row:p.sourceRow,principal:p.principal});
 }
 for(const r of report.investorContinuity||[])append('Continuidad contractual calculada',r,contracts.get(r.contract_id||r.id),{explanation:r.reason||r.basis,references:r.sourceIds});
 return table('Base Inversores','Supabase · Inversores','Contratos y movimientos originales. Cálculos del flujo y continuidad identificados por tipo.',columns,rows);
}

function savingsTable(savings,report){
 if(report.savingsSourceTable)return report.savingsSourceTable;
 // Compatibility for a response without enriched account identity. Never substitute
 // an invented saver or omit a source amount; references stay visible.
 const people=new Map((savings.source_bases?.accounts||[]).map(a=>[a.id||a.account_id,a]));
 const columns=['Tipo de registro','Referencia de origen','Ahorrador','Número de control','Cuenta de ahorro','Fecha','Quincena o período','Concepto','Importe','Saldo conocido','Estado','Fuente original','Hoja de origen','Fila de origen','Columna de origen','Referencia relacionada'];
 const rows=[];
 const append=(type,r)=>{const p=people.get(r.account_id)||r;rows.push([type,r.id||r.source_id,p.full_name||p.name||r.participant_name,p.numero_control,r.account_id||r.participant_id,r.date||r.effective_on||r.month,r.period||r.period_key,state(r.kind||r.type),number(r.amount),number(r.known_amount),state(r.status),r.source,r.source_sheet,r.source_row,r.source_column,ids(r.sourceIds||r.source_ids)]);};
 const types={history:'Descuento histórico',account:'Cuenta de ahorro',accounts:'Cuenta de ahorro',transactions:'Movimiento de ahorro',withdrawals:'Retiro de ahorro',schedule:'Descuento programado',balances:'Saldo por cuenta',participants:'Ahorrador'};
 for(const [kind,items]of Object.entries(savings.source_bases||{}))if(Array.isArray(items))for(const r of items)append(types[kind]||'Registro de origen: '+kind,r);
 for(const r of savings.events||[])append('Movimiento utilizado en el flujo',r);
 for(const r of savings.balances||[])append('Saldo mensual consultado',r);
 return table('Base Ahorro','Supabase · Ahorro Voluntario','Registros consultados, movimientos del reporte y saldos mensuales diferenciados.',columns,rows);
}

function loanContractTable(report,resolved={},loans=[]){
 const contracts=report.loanContracts||resolved?.contracts||[];
 const originals=new Map();for(const r of loans.slice(1)){const id=text(r[2]);if(!originals.has(id))originals.set(id,[]);originals.get(id).push(r);}
 const originalAmount=(c,index)=>{const values=[...new Set((originals.get(text(c.loanId||c.C||c.id))||[]).map(r=>number(r[index])).filter(v=>typeof v==='number'))];return values.length===1?values[0]:null;};
 const columns=['ID del préstamo','Nombre','Número de control','Programa','Fecha de colocación','Estado de la solicitud','Capital original','Total original a pagar','Interés original registrado (M)','Administración original registrada (AA)','Estado del cálculo','Referencias de solicitudes','Referencias de cuotas','Motivo o explicación'];
 const rows=contracts.map(c=>[c.C||c.loanId||c.id,c.name||c.borrowerName,c.D||c.folio,c.fund||c.program,c.placementDate||c.placedOn||c.date,c.requestStatus||c.status,
  c.principalAmount??number(c.principal),c.totalAmount??number(c.total),
  originalAmount(c,12),originalAmount(c,26),
  state(c.calculationStatus||c.status),ids(c.requestSourceIds||c.requestRefs||(c.requestRows||[]).map(n=>'requests:'+n)),ids(c.sourceIds||c.pv2SourceIds||(c.pv2Rows||[]).map(n=>'pv2:'+n)),ids(c.notes||c.issues||c.reason)]);
 return table('Base Contratos','Google · Solicitudes y HISTORIAL P V2','Resumen por ID utilizado en el reporte. Los importes originales no se vuelven a cobrar ni recalcular.',columns,rows);
}

export function buildCashFlowSourceBases({source,savings,investors,approvals,resolved,consultedAt,report={}}){
 const includedIds=new Set(source.loans.slice(1).filter(r=>loanFund(r[6])).map(r=>text(r[2])));
 for(const r of source.requests.slice(1))if(loanFund(r[4]))includedIds.add(text(r[0]));
 const tables=[
  googleTable('Base PV2',source.loans,[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,20,25,26,27,28,29,32],r=>loanFund(r[6])||includedIds.has(text(r[2])),[0,11,15,20,32],[1,7,8,9,10,12,13,14,16,25,26,27,28,29]),
  googleTable('Base Solicitudes',source.requests,[0,1,2,3,4,5,6,7,8,9,10,24],r=>loanFund(r[4])||includedIds.has(text(r[0])),[9],[5,6,7,8]),
  savingsTable(savings,report),investorSourceTable(investors||{},report),loanContractTable(report,resolved,source.loans)
 ];
 return {version:1,consultedAt,savingsInputsAvailable:!!savings.source_bases,tables};
}
