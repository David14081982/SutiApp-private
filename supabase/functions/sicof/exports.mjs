// Authenticated server callers inject the canonical report and existing ExcelJS.
// No reader, ledger writer, storage key, or browser financial calculation here.
const encoder = new TextEncoder();
const moneyFormat = '"$"#,##0.00;[Red]-"$"#,##0.00';
const pending = 'POR CONCILIAR';
const eligibilityLabel = row => row.review_required ? 'Por verificar' : row.ok ? 'Sí' : 'No';
const finite = v => typeof v === 'number' && Number.isFinite(v);
const cents = v => { if (!finite(v)) throw Error('SICOF_EXPORT_AMOUNT_INVALID'); return Math.round((v+Math.sign(v)*Number.EPSILON)*100); };
const round = v => cents(v)/100;
const sum = values => values.some(v=>!finite(v)) ? null : values.reduce((n,v)=>n+cents(v),0)/100;
const text = v => v == null ? pending : typeof v === 'object' ? JSON.stringify(v) : String(v);
const norm = v => String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const escapeHtml = v => text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bytesOf = value => value instanceof Uint8Array ? value : value instanceof ArrayBuffer ? new Uint8Array(value) : null;
const scalar = v => v == null ? pending : typeof v === 'object' ? JSON.stringify(v) : v;
const csvCell = v => {
  let value=text(v);
  if (typeof v!=='number' && /^[\s\u0000-\u001f]*[=+@-]/.test(value)) value="'"+value;
  return '"'+value.replace(/"/g,'""')+'"';
};
const csv = table => encoder.encode('\uFEFF'+[table.columns.map(c=>csvCell(c.label)),...table.rows.map(r=>table.columns.map(c=>csvCell(r[c.key])))].map(row=>row.join(',')).join('\r\n'));
function validDate(value) {return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
function validateFilters(filters) {
  filters={...filters};
  for(const key of ['from','to','year','severity'])if(filters[key]==='')delete filters[key];
  if(filters.search==null&&filters.q!=null)filters.search=filters.q;
  if(filters.search!=null&&typeof filters.search!=='string')throw Error('SICOF_EXPORT_FILTER_INVALID');
  if(filters.severity!=null){filters.severity=({leve:'mild',moderado:'moderate',grave:'severe'})[filters.severity]||filters.severity;if(!['mild','moderate','severe'].includes(filters.severity))throw Error('SICOF_EXPORT_FILTER_INVALID');}
  for (const key of ['from','to']) if (filters[key]!=null&&!validDate(filters[key])) throw Error('SICOF_EXPORT_FILTER_INVALID');
  if (filters.from&&filters.to&&filters.from>filters.to) throw Error('SICOF_EXPORT_FILTER_INVALID');
  if (filters.funds!=null&&(!Array.isArray(filters.funds)||filters.funds.some(v=>typeof v!=='string'))) throw Error('SICOF_EXPORT_FILTER_INVALID');
  if (filters.year!=null&&(!Number.isInteger(Number(filters.year))||Number(filters.year)<1900||Number(filters.year)>9999)) throw Error('SICOF_EXPORT_FILTER_INVALID');
  return filters;
}
function matches(row,filters,withDate=false) {
  const fund=row.fund??row.fondo,folio=row.folio??row.f??row.A;
  if (filters.fund && filters.fund!=='all' && fund!==filters.fund) return false;
  if (filters.funds && !filters.funds.includes(fund)) return false;
  if (filters.folio!=null&&folio!==filters.folio) return false;
  if (filters.search && !norm([folio,row.loan_id??row.id,row.name??row.n??row.B,fund].join(' ')).includes(norm(filters.search))) return false;
  if (withDate) {
    // Unknown dates must remain visible as audit rows, never disappear from the
    // export merely because a date filter would otherwise hide their defect.
    if (row.date&&filters.from&&row.date<filters.from) return false;
    if (row.date&&filters.to&&row.date>filters.to) return false;
    if (row.date&&filters.year&&row.date.slice(0,4)!==String(filters.year)) return false;
  }
  return true;
}
const columns = defs => defs.map(([key,label,money=false])=>({key,label,money}));
const paymentColumns = columns([['date','Fecha de amortización'],['folio','Folio'],['name','Nombre'],['loan_id','Préstamo'],['fund','Fondo'],['paid','Cuota registrada',true],['expected','Cuota programada',true],['capital','Capital conciliado',true],['interest','Interés conciliado sin gasto administrativo',true],['fee','Gasto administrativo conciliado',true],['projected_interest','Interés proyectado',true],['audit','Estado de conciliación'],['issues','Incidencias'],['source_row','Fila fuente']]);
const allocationColumns = columns([['f','Folio'],['n','Nombre'],['capital','Capital',true],['previous_yield','Rendimientos anteriores',true],['endbal','Saldo elegible final',true],['avgbal','Saldo elegible promedio',true],['eligibility','Califica'],['rend','Rendimiento simulado',true],['total','Total simulado',true],['retenido','Retención simulada',true],['entregable','Entregable simulado',true],['available','Disponible canónico actual',true],['motivo','Regla / revisión']]);

export function buildSicofExportTable(kind,{calculation,context,loans,filters={}}) {
  filters=validateFilters(filters);
  if (kind==='pagos') {
    if (!Array.isArray(loans?.payments)) throw Error('SICOF_EXPORT_LOANS_REQUIRED');
    return {name:'Pagos',columns:paymentColumns,rows:loans.payments.filter(r=>matches(r,filters,true)).map(r=>({...r,issues:(r.issues||[]).join('; ')}))};
  }
  if (kind==='atrasos') {
    if (!Array.isArray(loans?.loans)) throw Error('SICOF_EXPORT_LOANS_REQUIRED');
    return {name:'Atrasos',columns:columns([['folio','Folio'],['name','Nombre'],['id','Préstamo'],['fund','Fondo'],['capital','Capital prestado',true],['total','Total contractual',true],['paid','Pagado a hoy según la fuente',true],['expected','Esperado a hoy según la fuente',true],['arrears','Atraso vigente',true],['severity_label','Severidad'],['status','Estado actual de la fuente'],['behavior','Revisión']]),
      rows:loans.loans.filter(r=>r.status==='SALDO ATRASADO'&&matches(r,filters)).map(r=>{const severity=!finite(r.arrears)?null:r.arrears>=5000?'severe':r.arrears>=500?'moderate':'mild';return{...r,severity,severity_label:({mild:'leve',moderate:'moderado',severe:'grave'})[severity]||pending};}).filter(r=>!filters.severity||r.severity===filters.severity)};
  }
  if (kind==='reparto'||kind==='reparto_formulado') {
    if (!Array.isArray(calculation?.rows)) throw Error('SICOF_EXPORT_CALCULATION_REQUIRED');
    return {name:'Reparto',columns:allocationColumns,rows:calculation.rows.filter(r=>matches(r,filters)).map(r=>({...r,eligibility:eligibilityLabel(r)}))};
  }
  if (kind==='final_ahorro') {
    const report=context?.report;
    if (!Array.isArray(report?.rows)||!Array.isArray(report?.columns)||report.columns.length!==13) throw Error('SICOF_EXPORT_REPORT_REQUIRED');
    const cols=report.columns.map((c,i)=>{const key=typeof c==='string'?String.fromCharCode(65+i):c.key,label=typeof c==='string'?c:c.label??c.header;
      if(key!==String.fromCharCode(65+i)||typeof label!=='string')throw Error('SICOF_EXPORT_REPORT_COLUMNS_INVALID');return{key,label,money:i>=2};});
    const rows=report.rows.filter(row=>matches(row,filters));
    const totals=rows.length===report.rows.length?report.totals:Object.fromEntries(cols.filter(c=>c.money).map(c=>[c.key,sum(rows.map(r=>r[c.key]))]));
    return {name:'Informe vigente',columns:cols,rows,totals};
  }
  if (kind==='matriz') {
    if (!Array.isArray(loans?.loans)) throw Error('SICOF_EXPORT_LOANS_REQUIRED');
    const selected=loans.loans.filter(r=>matches(r,filters)&&(!filters.year||(r.schedule||[]).some(p=>!p.date||p.date.slice(0,4)===String(filters.year))));
    const dates=[...new Set(selected.flatMap(r=>(r.schedule||[]).filter(p=>matches(p,filters,true)).map(p=>p.date).filter(Boolean)))].sort();
    const base=columns([['folio','Folio'],['name','Nombre'],['id','Préstamo'],['process','Proceso'],['fund','Fondo'],['status','Estado actual'],
      ['capital','Capital prestado',true],['rate_percent','Tasa quincenal (%)'],['term','Plazo'],['interest_total','Interés contractual sin gasto',true],
      ['admin_fee_total','Gasto administrativo contractual',true],['total','Total contractual',true],['discount_start','Inicio de descuento'],['discount_end','Fin de descuento'],['transfer_date','Fecha de transferencia'],['discount_date','Fecha de descuento'],['request_date','Fecha de solicitud']]);
    const parts=[['paid','Cuota registrada'],['expected','Programado'],['capital','Capital conciliado'],['interest','Interés conciliado'],['fee','Gasto administrativo'],['audit','Auditoría']];
    if(base.length+dates.length*parts.length>16384)throw Error('SICOF_EXPORT_MATRIX_TOO_WIDE');
    const cols=[...base,...dates.flatMap(d=>parts.map(([key,label])=>({key:d+'_'+key,label:d+' · '+label,money:key!=='audit'})))];
    const rows=selected.map(r=>{
      const out=Object.fromEntries(base.map(c=>[c.key,r[c.key]]));
      for(const d of dates){const at=(r.schedule||[]).filter(p=>p.date===d&&matches(p,filters,true));
        for(const [key] of parts)out[d+'_'+key]=at.length===1?at[0][key]:at.length>1?pending:'';
      }
      return out;
    });
    return{name:'Matriz de préstamos',columns:cols,rows};
  }
  throw Error('SICOF_EXPORT_KIND_INVALID');
}

function styleSheet(sheet,table) {
  sheet.columns=table.columns.map(c=>({header:c.label,key:c.key,width:c.key==='name'||c.key==='n'?36:Math.min(38,Math.max(16,c.label.length+2))}));
  sheet.views=[{state:'frozen',ySplit:1}];
  sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
  sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF930027'}};
  sheet.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,table.rows.length+1),column:table.columns.length}};
  table.rows.forEach(r=>sheet.addRow(Object.fromEntries(table.columns.map(c=>[c.key,scalar(r[c.key])]))));
  table.columns.forEach((c,i)=>{if(c.money)sheet.getColumn(i+1).numFmt=moneyFormat;});
  return sheet;
}
function addTable(workbook,table){return styleSheet(workbook.addWorksheet(table.name),table);}
function metadata(workbook,{calculation,loans,filters,context}) {
  addTable(workbook,{name:'Fuentes y alcance',columns:columns([['key','Dato'],['value','Valor']]),rows:[
    {key:'Naturaleza',value:'SIMULACIÓN / REPORTE; no acredita ni entrega rendimientos'},
    {key:'Fecha de pagos',value:'Fecha de amortización de HISTORIAL P V2; no acredita fecha real de recepción'},
    {key:'Fuente préstamos',value:loans?.source??null},{key:'Observación de fuente',value:loans?.observed_at??null},
    {key:'Huella fuente',value:loans?.source_fingerprint??null},{key:'Motor',value:calculation?.engine_version??null},
    {key:'Huella cálculo',value:calculation?.fingerprint??context?.calculation_fingerprint??null},
    {key:'Filtros',value:JSON.stringify(filters)},{key:'Reglas del escenario',value:JSON.stringify(calculation?.settings??{})},
    {key:'Conciliación',value:loans?.certification?.status??pending},
    {key:'Valores pendientes',value:'POR CONCILIAR no equivale a cero; los históricos no se suman nuevamente al saldo canónico.'}
  ]});
}
const sameMoney = (a,b) => finite(a)&&finite(b)&&cents(a)===cents(b);
const closeNumber=(a,b)=>finite(a)&&finite(b)&&Math.abs(a-b)<=Math.max(1e-8,Math.abs(b)*1e-12);
function addFormulaEvidence(workbook,calculation,loans) {
  if(!Array.isArray(loans?.payments))throw Error('SICOF_EXPORT_LOANS_REQUIRED');
  const s=calculation.settings,days=(Date.parse(s.periodFin)-Date.parse(s.periodIni))/86400000+1;
  if(!Number.isInteger(days)||days<=0||!['caja','sel','todos'].includes(s.src))throw Error('SICOF_EXPORT_CALCULATION_REQUIRED');
  const funds=s.src==='caja'?['Caja de Ahorro']:s.src==='sel'?[...new Set(['Caja de Ahorro',...(s.selFunds||[])])]:null;
  const selected=p=>(!funds||funds.includes(p.fund))&&(!p.date||(p.date>=s.periodIni&&p.date<=s.periodFin));
  const payRows=loans.payments.filter(selected).map(p=>({...p,issues:(p.issues||[]).join('; '),
    collected:p.audit==='RECONCILED_SOURCE_PAYMENT'?p.interest:0,projected:p.audit==='PROJECTED'?p.projected_interest:0}));
  const collected=sum(payRows.map(p=>p.collected)),projected=sum(payRows.map(p=>p.projected));
  if(!sameMoney(collected,calculation.collected)||!sameMoney(projected,calculation.projected))throw Error('SICOF_EXPORT_SOURCE_MISMATCH');
  const payments=addTable(workbook,{name:'Pagos',columns:[...paymentColumns,...columns([['collected','Interés aplicado a la bolsa',true],['projected','Interés proyectado separado',true]])],rows:payRows});
  payRows.forEach((p,i)=>{
    const n=i+2;
    payments.getCell(n,15).value={formula:`IF(L${n}="RECONCILED_SOURCE_PAYMENT",ROUND(I${n},2),0)`,result:round(p.collected)};
    payments.getCell(n,16).value={formula:`IF(L${n}="PROJECTED",ROUND(K${n},2),0)`,result:round(p.projected)};
  });
  const detail=styleSheet(workbook.addWorksheet('Desglose'),{columns:columns([['folio','Folio'],['name','Nombre'],['date','Inicio del intervalo'],['amount','Movimiento neto de base',true],['balance','Saldo elegible del intervalo',true],['days','Días del intervalo'],['weight','Saldo por días'],['eligible','Califica para tasa'],['basis','Aporte a la base seleccionada'],['note','Explicación del motor']]),rows:[]});
  const ranges=new Map();let verified=true,eligibleBase=0;
  for(const row of calculation.rows){
    const steps=row.calculation_steps,basis=s.method==='avg'?row.avgbal:row.endbal,first=detail.rowCount+1;
    let valid=Array.isArray(steps)&&steps.length>0&&finite(basis);
    if(valid){
      let totalDays=0,weight=0,running=0;
      for(let i=0;i<steps.length;i++){
        const step=steps[i],expectedDate=new Date(Date.parse(s.periodIni)+totalDays*86400000).toISOString().slice(0,10);
        if(!validDate(step.date)||step.date!==expectedDate||!Number.isInteger(step.days)||step.days<=0||![step.amount,step.balance,step.balance_days].every(finite))throw Error('SICOF_EXPORT_INTERVAL_MISMATCH');
        running+=cents(step.amount);totalDays+=step.days;weight+=cents(step.balance_days);
        if(running!==cents(step.balance)||cents(step.balance)*step.days!==cents(step.balance_days))throw Error('SICOF_EXPORT_INTERVAL_MISMATCH');
      }
      if(totalDays!==days||!closeNumber(weight/100/days,row.avgbal)||!sameMoney(running/100,row.endbal))throw Error('SICOF_EXPORT_INTERVAL_MISMATCH');
      const totalBasis=s.method==='avg'?weight/100/days:running/100;
      if(!closeNumber(basis,totalBasis))throw Error('SICOF_EXPORT_INTERVAL_MISMATCH');
      if(row.ok)eligibleBase+=totalBasis;
      steps.forEach((step,i)=>{
        const n=detail.rowCount+1,last=i===steps.length-1,part=s.method==='avg'?step.balance_days/days:last?step.balance:0;
        detail.addRow([row.f,row.n,step.date,step.amount,{formula:i?`ROUND(E${n-1}+D${n},2)`:`D${n}`,result:step.balance},step.days,
          {formula:`E${n}*F${n}`,result:step.balance_days},eligibilityLabel(row),
          {formula:s.method==='avg'?`G${n}/${days}`:last?`E${n}`:'0',result:part},row.calculation_explanation||'']);
      });
    }else{
      if(row.ok)verified=false;
      detail.addRow([row.f,row.n,pending,pending,pending,pending,pending,eligibilityLabel(row),pending,row.calculation_explanation||'Intervalos no disponibles; la base no se reconstruye.']);
    }
    ranges.set(row.f,{first,last:detail.rowCount,valid,basis});
  }
  if(verified&&!closeNumber(eligibleBase,calculation.base))throw Error('SICOF_EXPORT_BASIS_MISMATCH');
  detail.autoFilter={from:'A1',to:{row:Math.max(1,detail.rowCount),column:10}};
  return {ranges,verified,days,lastPayment:Math.max(2,payments.rowCount),lastDetail:Math.max(2,detail.rowCount),collected,projected};
}
function addFormulaReparto(workbook,calculation,filters,loans) {
  const rows=calculation.rows.filter(r=>matches(r,filters)),costs=calculation.costs||[];
  if(!finite(calculation.collected)||!finite(calculation.settings?.pay)||!Array.isArray(costs))throw Error('SICOF_EXPORT_CALCULATION_REQUIRED');
  const selectedBasis=r=>calculation.settings.method==='avg'?r.avgbal:r.endbal;
  const table={name:'Reparto formulado',columns:columns([['folio','Folio'],['name','Nombre'],['eligible','Califica'],['basis','Base seleccionada',true],['capital','Capital',true],['oldyield','Rendimiento anterior',true],['rate','Tasa del periodo'],['rounding','Ajuste distribución a centavos',true],['yield','Rendimiento simulado',true],['total','Total simulado',true],['retained','Retención simulada',true],['deliverable','Entregable simulado',true],['available','Disponible canónico',true],['reason','Regla / revisión']]),rows:[]};
  const sheet=styleSheet(workbook.addWorksheet(table.name),table);
  const evidence=addFormulaEvidence(workbook,calculation,loans);
  rows.forEach((r,i)=>{
    const number=i+2,basis=selectedBasis(r),rate=calculation.rate==null?null:calculation.rate/100;
    const range=evidence.ranges.get(r.f);
    const reviewed=r.rend==null||r.total==null||r.retenido==null||r.entregable==null||basis==null||!range?.valid||!evidence.verified;
    const adjustment=reviewed?null:round(r.rend-(r.ok&&finite(rate)?round(basis*rate):0));
    if(!reviewed&&(!sameMoney(r.total,r.capital+r.previous_yield+r.rend)||!sameMoney(r.entregable,r.total-r.retenido)||Math.abs(adjustment)>.010001))throw Error('SICOF_EXPORT_RESULT_MISMATCH');
    sheet.addRow([r.f,r.n,eligibilityLabel(r),range?.valid?{formula:`SUM(Desglose!I${range.first}:I${range.last})`,result:basis}:pending,scalar(r.capital),scalar(r.previous_yield),rate==null||!evidence.verified?pending:{formula:"'Parámetros'!B14",result:rate},scalar(adjustment),
      reviewed?pending:{formula:`IF(C${number}="Sí",ROUND(D${number}*G${number},2)+H${number},0)`,result:r.rend},
      reviewed?pending:{formula:`ROUND(E${number}+F${number}+I${number},2)`,result:r.total},scalar(r.retenido),
      reviewed?pending:{formula:`MAX(0,ROUND(J${number}-K${number},2))`,result:r.entregable},scalar(r.available),r.motivo||'']);
  });
  sheet.getColumn(7).numFmt='0.000000%';sheet.autoFilter={from:'A1',to:{row:Math.max(1,rows.length+1),column:14}};
  const last=rows.length+1,footer=sheet.addRow(['','TOTALES']);
  for(const [col,key] of [[5,'capital'],[6,'previous_yield'],[9,'rend'],[10,'total'],[11,'retenido'],[12,'entregable'],[13,'available']]){
    const total=sum(rows.map(r=>r[key])),incomplete=[9,10,12].includes(col)&&rows.some(r=>r.rend==null||!evidence.ranges.get(r.f)?.valid||!evidence.verified);footer.getCell(col).value=total==null||incomplete?pending:{formula:rows.length?`SUM(${String.fromCharCode(64+col)}2:${String.fromCharCode(64+col)}${last})`:'0',result:total};
  }
  addTable(workbook,{name:'Costos',columns:columns([['concept','Concepto'],['amount','Importe aplicado a centavos',true],['source','Origen'],['status','Estado'],['date','Fecha']]),rows:costs.map(c=>({...c,amount:round(c.amount)}))});
  const originalPool=round(calculation.collected*calculation.settings.pay/100),originalReserve=round(calculation.collected-originalPool),poolCosts=sum(costs.filter(c=>c.source==='pool').map(c=>c.amount)),reserveCosts=sum(costs.filter(c=>c.source==='reserve').map(c=>c.amount));
  const spill=Math.max(0,round(reserveCosts-originalReserve)),pool=Math.max(0,round(originalPool-poolCosts-spill)),reserve=Math.max(0,round(originalReserve-reserveCosts));
  if(!sameMoney(pool,calculation.pool)||!sameMoney(reserve,calculation.reserve))throw Error('SICOF_EXPORT_RESULT_MISMATCH');
  const params=addTable(workbook,{name:'Parámetros',columns:columns([['key','Concepto'],['value','Importe / proporción']]),rows:[
    {key:'Interés conciliado en la hoja',value:calculation.collected},{key:'Proporción para reparto',value:calculation.settings.pay/100},
    {key:'Interés proyectado (separado)',value:calculation.projected},{key:'Bolsa antes de costos',value:originalPool},
    {key:'Reserva antes de costos',value:originalReserve},{key:'Costos desde bolsa',value:poolCosts},{key:'Costos desde reserva',value:reserveCosts},
    {key:'Exceso de costos sobre reserva',value:spill},{key:'Bolsa después de costos',value:pool},{key:'Reserva restante',value:reserve},
    {key:'Base elegible',value:calculation.base},{key:'Rendimiento distribuido',value:calculation.distributed},
    {key:'Tasa del periodo',value:calculation.rate==null?null:calculation.rate/100},{key:'Saldo bancario declarado',value:calculation.bank?.amount??null}
  ]});
  const lastCost=Math.max(2,costs.length+1);
  for(const [cell,formula,result] of [['B5','ROUND(B2*B3,2)',originalPool],['B6','ROUND(B2-B5,2)',originalReserve],
    ['B7',`SUMIF(Costos!C2:C${lastCost},"pool",Costos!B2:B${lastCost})`,poolCosts],['B8',`SUMIF(Costos!C2:C${lastCost},"reserve",Costos!B2:B${lastCost})`,reserveCosts],
    ['B9','MAX(0,ROUND(B8-B6,2))',spill],['B10','MAX(0,ROUND(B5-B7-B9,2))',pool],['B11','MAX(0,ROUND(B6-B8,2))',reserve]])params.getCell(cell).value={formula,result};
  params.getCell('B2').value={formula:`SUM(Pagos!O2:O${evidence.lastPayment})`,result:calculation.collected};
  params.getCell('B4').value={formula:`SUM(Pagos!P2:P${evidence.lastPayment})`,result:calculation.projected};
  params.getCell('B12').value=evidence.verified?{formula:`SUMIF(Desglose!H2:H${evidence.lastDetail},"Sí",Desglose!I2:I${evidence.lastDetail})`,result:calculation.base}:pending;
  if(evidence.verified&&finite(calculation.distributed)){
    const expected=calculation.base>0?pool:0;
    if(!sameMoney(expected,calculation.distributed))throw Error('SICOF_EXPORT_RESULT_MISMATCH');
    params.getCell('B13').value={formula:'IF(B12>0,B10,0)',result:calculation.distributed};
  }else params.getCell('B13').value=pending;
  params.getCell('B14').value=calculation.rate!=null&&evidence.verified?{formula:'IF(B12=0,0,B13/B12)',result:calculation.rate/100}:pending;
  params.getColumn(2).numFmt=moneyFormat;params.getCell('B3').numFmt='0.00%';params.getCell('B14').numFmt='0.000000%';
}

function compositionTables(context) {
  const participants=context?.participants;
  if(!Array.isArray(participants))return[];
  const periods=[],movements=[];
  for(const p of participants){
    for(const row of p.composition?.periods||[])periods.push({folio:p.folio,name:p.name??p.nombre,...row});
    for(const row of p.composition?.movements||p.transactions||[])movements.push({folio:p.folio,name:p.name??p.nombre,...row});
  }
  // Only explicit, nontechnical financial fields are exported. Origins remain
  // attached to the movement, distinct from the effective payment date.
  return[
    {name:'Periodos',columns:columns([['folio','Folio'],['name','Nombre'],['origin_key','Periodo de origen'],['component','Componente'],['recognized','Reconocido',true],['withdrawn','Retirado',true],['remaining','Saldo restante',true],['adjustments','Ajustes',true],['remaining_before_unallocated','Saldo antes de retiros sin asignar',true],['origin_state','Conciliación']]),rows:periods},
    {name:'Movimientos',columns:columns([['folio','Folio'],['name','Nombre'],['effective_date','Fecha efectiva'],['type','Movimiento'],['component','Componente'],['direction','Dirección'],['amount','Importe',true],['origin_key','Periodo de origen'],['origins','Distribución por origen'],['report_category','Categoría conciliada'],['report_review','Revisión de clasificación'],['reversal_of_transaction_id','Movimiento original de la reversión']]),rows:movements.map(row=>({...row,type:row.type??row.transaction_type}))}
  ];
}
function cellValue(cell){const value=cell.value;return value&&typeof value==='object'&&'result'in value?value.result:value;}
function equalCell(a,b){return a==null&&b==null||(finite(a)&&finite(b)?Math.abs(a-b)<1e-8:a===b);}
function addContinuousFinal(workbook,historic,context,filters) {
  const report=context.continuous_report,clone=value=>JSON.parse(JSON.stringify(value));
  if(report?.schema_version!=='SICOF_CONTINUOUS_SAVINGS_V1'||!validDate(report.cutoff)||!Array.isArray(report.periods)||!Array.isArray(report.rows))throw Error('SICOF_EXPORT_CONTINUOUS_REQUIRED');
  const expected=[];
  for(let year=2026;year<=Number(report.cutoff.slice(0,4));year++)for(const semester of [1,2]){
    if(year===2026&&semester===1)continue;
    const start=year+(semester===1?'-01-01':'-07-01');if(start<=report.cutoff)expected.push(year+'-S'+semester);
  }
  if(13+expected.length*2>16384||expected.length!==report.periods.length)throw Error('SICOF_EXPORT_CONTINUOUS_PERIODS_INVALID');
  report.periods.forEach((period,index)=>{
    const ordinal=period.semester===1?'1ER':'2DO';
    if(period.key!==expected[index]||period.key!==period.year+'-S'+period.semester||period.capital_header!==period.year+' '+ordinal+' SEMESTRE AHORRO'||period.yield_header!==period.year+' REND. '+ordinal+' SEMESTRE')throw Error('SICOF_EXPORT_CONTINUOUS_PERIODS_INVALID');
  });
  const originalRows=new Map();
  for(let r=3;r<=historic.rowCount;r++){
    const value=cellValue(historic.getCell(r,1));if(value==null||String(value)==='')continue;
    const folio=String(value);if(originalRows.has(folio))throw Error('SICOF_EXPORT_TEMPLATE_DUPLICATE_IDENTITY');originalRows.set(folio,r);
  }
  const indexed=new Map();
  for(const row of report.rows){
    if(typeof row.folio!=='string'||!row.folio||indexed.has(row.folio))throw Error('SICOF_EXPORT_CONTINUOUS_IDENTITY_INVALID');indexed.set(row.folio,row);
    const r=originalRows.get(row.folio);
    if(r){
      if(row.source_row!==r||!row.historical_cells||String(row.historical_cells.A)!==row.folio)throw Error('SICOF_EXPORT_CONTINUOUS_HISTORY_INVALID');
      for(let c=1;c<=13;c++){
        const key=String.fromCharCode(64+c),source=historic.getCell(r,c).value;
        if(!Object.hasOwn(row.historical_cells,key))throw Error('SICOF_EXPORT_CONTINUOUS_HISTORY_INVALID');
        // Cached zero formula results may be omitted by ExcelJS. The authenticated
        // historical snapshot supplies their resolved values; never infer zero.
        const formula=source&&typeof source==='object'&&('formula'in source||'sharedFormula'in source);
        if((!formula||source.result!=null)&&!equalCell(row.historical_cells[key],formula?source.result:source))throw Error('SICOF_EXPORT_HISTORICAL_VALUES_CHANGED');
      }
    }else if(row.historical_cells!=null)throw Error('SICOF_EXPORT_CONTINUOUS_HISTORY_INVALID');
    for(const period of report.periods){const values=row.period_values?.[period.key];if(!values)throw Error('SICOF_EXPORT_CONTINUOUS_VALUES_REQUIRED');
      for(const [key,state]of [['capital','capital_state'],['yield_amount','yield_state']]){
        if(!['VERIFIED','PARTIAL','REVIEW_REQUIRED','NO_ACCOUNT'].includes(values[state])||values[key]!=null&&!finite(values[key])||['REVIEW_REQUIRED','NO_ACCOUNT'].includes(values[state])&&values[key]!=null)throw Error('SICOF_EXPORT_CONTINUOUS_VALUES_INVALID');
      }
    }
  }
  for(const folio of originalRows.keys())if(!indexed.has(folio))throw Error('SICOF_EXPORT_CONTINUOUS_HISTORY_MISSING');
  const ordered=[...originalRows.keys()].map(folio=>indexed.get(folio)).concat(report.rows.filter(row=>!originalRows.has(row.folio)));
  // A continuous workbook retains every started semester. The existing period
  // selector still controls Informe vigente, while this sheet filters people only.
  const selected=ordered.filter(row=>(filters.folio==null||row.folio===filters.folio)&&(!filters.search||norm([row.folio,row.name,row.historical_cells?.B].join(' ')).includes(norm(filters.search))));
  const sheet=workbook.addWorksheet('Informe acumulado',{pageSetup:clone(historic.pageSetup),properties:clone(historic.properties)});
  for(let r=1;r<=2;r++)sheet.getRow(r).height=historic.getRow(r).height;
  for(let c=1;c<=13;c++){sheet.getColumn(c).width=historic.getColumn(c).width;for(let r=1;r<=2;r++){const source=historic.getCell(r,c),dest=sheet.getCell(r,c);dest.value=source.value;dest.style=clone(source.style);}}
  for(const merge of historic.model.merges||[]){const range=merge.match(/^[A-M]([12]):[A-M]([12])$/);if(range)sheet.mergeCells(merge);}
  const hasPartial=selected.some(row=>report.periods.some(period=>['capital_state','yield_state'].some(key=>row.period_values[period.key][key]==='PARTIAL')));
  if(report.periods.length){const cell=sheet.getCell('N1');cell.value='Acumulado registrado desde 2026-S2 al '+report.cutoff+'. Antes de retiros.'+(hasPartial?' ÁMBAR: evidencia parcial; no es un semestre completo.':'');cell.style=clone(historic.getCell('F1').style);cell.alignment={wrapText:true,vertical:'middle'};sheet.mergeCells('N1:O1');sheet.getRow(1).height=Math.max(72,historic.getRow(1).height||0);}
  const stateNote=(values,component)=>{
    const state=values[component==='capital'?'capital_state':'yield_state'],reasons=values[component==='capital'?'capital_reasons':'yield_reasons']||values.reasons||[];
    return (state==='PARTIAL'?'ACUMULADO REGISTRADO PARCIAL: historia incompleta o recibos pendientes de confirmar; este importe confirmado no representa todo el semestre.':state==='VERIFIED'?'Acumulado registrado con evidencia suficiente, antes de retiros.':'POR CONCILIAR: no se presume un importe ni se inventa cero.')+' Corte: '+report.cutoff+(reasons.length?'\nRevisión: '+reasons.join('; '):'');
  };
  report.periods.forEach((period,index)=>{for(const [offset,key]of [[0,'capital_header'],[1,'yield_header']]){const c=14+index*2+offset,cell=sheet.getCell(2,c);sheet.getColumn(c).width=Math.max(24,historic.getColumn(offset?7:6).width||0);cell.style=clone(historic.getCell(2,offset?7:6).style);cell.value=period[key];cell.alignment={...cell.alignment,wrapText:true};}});
  selected.forEach((row,index)=>{
    const r=index+3,sourceRow=row.source_row||3;sheet.getRow(r).height=historic.getRow(sourceRow).height;
    for(let c=1;c<=13;c++){const cell=sheet.getCell(r,c);cell.style=clone(historic.getCell(sourceRow,c).style);cell.value=row.historical_cells?row.historical_cells[String.fromCharCode(64+c)]??null:c===1?row.folio:c===2?row.name??null:null;}
    report.periods.forEach((period,index)=>{const values=row.period_values[period.key];for(const [offset,key]of [[0,'capital'],[1,'yield_amount']]){const cell=sheet.getCell(r,14+index*2+offset),state=values[offset?'yield_state':'capital_state'];cell.style=clone(historic.getCell(sourceRow,offset?7:6).style);cell.numFmt=moneyFormat;cell.value=scalar(values[key]);cell.note=stateNote(values,key);if(state==='PARTIAL')cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFE6A6'}};}});
  });
  const totalsRow=selected.length+3;for(let c=1;c<=13;c++)sheet.getCell(totalsRow,c).style=clone(historic.getCell(historic.rowCount,c).style);sheet.getCell(totalsRow,2).value='TOTALES';sheet.getRow(totalsRow).font={bold:true};
  for(let c=3;c<=13;c++){const key=String.fromCharCode(64+c),values=selected.filter(row=>row.historical_cells).map(row=>row.historical_cells[key]).filter(value=>value!=null);sheet.getCell(totalsRow,c).value=values.length?scalar(sum(values)):null;sheet.getCell(totalsRow,c).numFmt=moneyFormat;}
  report.periods.forEach((period,index)=>{for(const [offset,key]of [[0,'capital'],[1,'yield_amount']]){const cell=sheet.getCell(totalsRow,14+index*2+offset),partial=selected.some(row=>row.period_values[period.key][offset?'yield_state':'capital_state']==='PARTIAL');cell.value=scalar(sum(selected.map(row=>row.period_values[period.key][key])));cell.numFmt=moneyFormat;if(partial){cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFE6A6'}};cell.note='Incluye acumulados parciales registrados; no es un total de semestre completo.';}}});
  sheet.views=[{state:'frozen',xSplit:2,ySplit:2,tabSelected:true}];sheet.autoFilter={from:'A2',to:{row:Math.max(2,selected.length+2),column:13+report.periods.length*2}};
  const prior=workbook.worksheets.filter(item=>item!==sheet);sheet.orderNo=0;prior.forEach((item,index)=>{item.orderNo=index+1;item.views=(item.views||[]).map(view=>({...view,tabSelected:false}));});workbook.views=[{...(workbook.views?.[0]||{}),activeTab:0,firstSheet:0}];
  const withdrawalLabels={VERIFIED:'Verificado',PARTIAL:'Parcial: faltan antecedentes',REVIEW_REQUIRED:'Por conciliar',NO_ACCOUNT:'Sin cuenta conciliada'};
  addTable(workbook,{name:'Retiros y saldo acumulado',columns:columns([['folio','Folio'],['name','Nombre'],['from','Inicio de retiros acumulados'],['through','Corte actual'],['withdrawn_capital','Capital retirado neto',true],['withdrawn_yield','Rendimiento retirado neto',true],['withdrawn_total','Total retirado neto',true],['capital','Capital actual',true],['yield_amount','Rendimiento actual',true],['total','Saldo actual',true],['held_capital','Capital retenido',true],['held_yield','Rendimiento retenido',true],['held','Retenido total',true],['available','Disponible actual',true],['review','Revisión'],['withdrawal_state','Cobertura de retiros'],['confirmed_withdrawn_capital','Capital retirado registrado (subtotal)',true],['confirmed_withdrawn_yield','Rendimiento retirado registrado (subtotal)',true],['confirmed_withdrawn_total','Total retirado registrado (subtotal)',true],['withdrawal_review','Revisión de retiros']]),rows:selected.map(row=>({folio:row.folio,name:row.name,from:row.withdrawals?.from??'2026-07-01',through:report.cutoff,withdrawn_capital:row.withdrawals?.capital,withdrawn_yield:row.withdrawals?.yield_amount,withdrawn_total:row.withdrawals?.total,...row.balances,review:(row.reasons||[]).join('; '),withdrawal_state:withdrawalLabels[row.withdrawals?.state]??'Por conciliar',confirmed_withdrawn_capital:row.withdrawals?.confirmed_capital,confirmed_withdrawn_yield:row.withdrawals?.confirmed_yield_amount,confirmed_withdrawn_total:row.withdrawals?.confirmed_total,withdrawal_review:(row.withdrawals?.reasons||[]).join('; ')}))});
  return ['Informe acumulado es la hoja principal. A:M conservan los valores históricos originales y no se suman otra vez al saldo actual. Las personas nuevas no reciben valores históricos inventados.',
    'Desde N se añaden pares semestrales iniciados, desde 2026-S2 al '+report.cutoff+'. AHORRO acumula aportaciones registradas antes de retiros; REND. incluye sólo rendimientos acreditados, nunca simulados. Se conservan correcciones y reversiones comprobadas.',
    'ÁMBAR y comentarios identifican acumulados registrados parciales por historia incompleta o recibos pendientes de confirmar. Sólo se suman registros comprobados. POR CONCILIAR no es cero. Un saldo de apertura no demuestra aportaciones brutas de un semestre.',
    'En Retiros y saldo acumulado, los subtotales registrados no sustituyen el total de retiros desde 2026-S2 cuando faltan antecedentes anteriores al inicio del registro. La cobertura y sus motivos se indican por separado.',
    'La búsqueda selecciona personas en Informe acumulado. El selector de año/semestre no oculta su continuidad: Informe vigente y sus respaldos conservan el intervalo elegido. Retiros y saldo acumulado muestra el corte actual separado.',...(report.notes||[])];
}
async function currentFinal(workbook,templateBytes,context,filters) {
  if(context.continuous_report?.schema_version!=='SICOF_CONTINUOUS_SAVINGS_V1')throw Error('SICOF_EXPORT_CONTINUOUS_REQUIRED');
  const original=bytesOf(templateBytes);
  if(!original)throw Error('SICOF_EXPORT_TEMPLATE_REQUIRED');
  await workbook.xlsx.load(original);
  const historic=workbook.worksheets[0];
  if(!historic||historic.getCell('A2').value!=='Folio'||historic.getCell('D2').value!=='RENDIMIENTO 2025')throw Error('SICOF_EXPORT_TEMPLATE_INVALID');
  const report=buildSicofExportTable('final_ahorro',{context,filters});
  const historicalSnapshots=new Map((context.continuous_report?.rows||[]).filter(row=>row.historical_cells).map(row=>[row.folio,row.historical_cells]));
  const existing=new Map();
  for(let i=3;i<=historic.rowCount;i++){
    const folio=cellValue(historic.getCell(i,1));
    if(folio!=null&&String(folio)!==''){
      if(existing.has(String(folio)))throw Error('SICOF_EXPORT_TEMPLATE_DUPLICATE_IDENTITY');
      existing.set(String(folio),[3,4,5].map(c=>{const cell=historic.getCell(i,c),value=cell.value,snapshot=historicalSnapshots.get(String(folio)),key=String.fromCharCode(64+c);return value&&typeof value==='object'&&('formula'in value||'sharedFormula'in value)&&value.result==null&&snapshot&&Object.hasOwn(snapshot,key)?snapshot[key]:cellValue(cell);}));
    }
  }
  const sheet=workbook.addWorksheet('Informe vigente',{pageSetup:{...historic.pageSetup},properties:{...historic.properties}});
  for(let c=1;c<=13;c++)sheet.getColumn(c).width=historic.getColumn(c).width;
  for(let r=1;r<=2;r++)for(let c=1;c<=13;c++){
    const src=historic.getCell(r,c),dest=sheet.getCell(r,c);dest.value=src.value;dest.style=JSON.parse(JSON.stringify(src.style));
  }
  report.columns.forEach((column,i)=>{sheet.getCell(2,i+1).value=column.label;});
  const seen=new Set();
  report.rows.forEach((row,i)=>{
    if(typeof row.A!=='string'||!row.A||seen.has(row.A))throw Error('SICOF_EXPORT_REPORT_IDENTITY_INVALID');seen.add(row.A);
    const historical=existing.get(row.A);
    if(historical&&['C','D','E'].some((key,j)=>!equalCell(row[key],historical[j])))throw Error('SICOF_EXPORT_HISTORICAL_VALUES_CHANGED');
    for(let c=1;c<=13;c++){
      const dest=sheet.getCell(i+3,c),key=String.fromCharCode(64+c);dest.style=JSON.parse(JSON.stringify(historic.getCell(3,c).style));
      // Missing historical values stay blank; missing current financial data are
      // explicit unresolved cells, never manufactured zeros.
      dest.value=c>=3&&c<=5?(row[key]??null):scalar(row[key]);
    }
  });
  if(report.totals){const r=report.rows.length+3;sheet.getCell(r,2).value='TOTALES';for(let c=3;c<=13;c++){const key=String.fromCharCode(64+c);sheet.getCell(r,c).value=scalar(report.totals[key]);sheet.getCell(r,c).numFmt=moneyFormat;}}
  sheet.views=[{state:'frozen',ySplit:2}];sheet.autoFilter={from:'A2',to:{row:Math.max(2,report.rows.length+2),column:13}};
  const finalByFolio=new Map(report.rows.map(row=>[row.A,row]));
  const selectedContext={...context,participants:(context.participants||[]).filter(p=>seen.has(p.folio)).map(p=>({...p,composition:{...p.composition,movements:finalByFolio.get(p.folio)?.movements??p.composition?.movements}}))};
  for(const table of compositionTables(selectedContext))addTable(workbook,table);
  const currentByFolio=new Map(selectedContext.participants.map(p=>[p.folio,p.composition?.balances]));
  addTable(workbook,{name:'Saldos y disponible',columns:columns([['folio','Folio'],['name','Nombre'],['cutoff','Fecha de corte del informe'],['cutoff_balance','Saldo al corte',true],['cutoff_available','Disponible al corte si está demostrado',true],['observed','Fecha de saldo actual'],['capital','Capital actual',true],['yield_amount','Rendimiento actual',true],['held_capital','Capital retenido actual',true],['held_yield','Rendimiento retenido actual',true],['available','Disponible actual',true],['report_review','Revisión del reporte']]),
    rows:report.rows.map(row=>{const balance=currentByFolio.get(row.A)||{};return{folio:row.A,name:row.B,cutoff:context.as_of??context.to,cutoff_balance:row.M,cutoff_available:row.available,observed:context.today,
      capital:balance.capital,yield_amount:balance.yield_amount,held_capital:balance.held_capital,held_yield:balance.held_yield,available:balance.available,report_review:(row.report_reviews||[]).join('; ')};})});
  const continuousNotes=addContinuousFinal(workbook,historic,context,filters);
  addTable(workbook,{name:'Notas del informe',columns:columns([['note','Alcance y reglas del reporte']]),rows:[...(context.report.notes||[]),...continuousNotes].map(note=>({note}))});
}

function acta(calculation,loans,context) {
  if(!Array.isArray(calculation?.rows))throw Error('SICOF_EXPORT_CALCULATION_REQUIRED');
  const s=calculation.settings||{},liquidity=calculation.liquidity||{},cash=v=>finite(v)?'$'+v.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}):pending,
    percent=v=>finite(v)?v.toLocaleString('es-MX',{maximumFractionDigits:6})+'%':pending;
  const source=s.src==='caja'?'Caja de Ahorro':s.src==='todos'?'Todos los fondos':s.src==='sel'?['Caja de Ahorro',...(s.selFunds||[])].join(', '):pending;
  const pairs=[['Estado','SIMULACIÓN — no constituye aprobación ni pago'],['Periodo',s.periodIni&&s.periodFin?s.periodIni+' a '+s.periodFin:pending],
    ['Fuente de la bolsa',source],['Método',s.method==='avg'?'Saldo promedio ponderado por días':s.method==='end'?'Saldo final al corte':pending],
    ['Porcentaje de interés destinado al reparto',percent(s.pay)],['Permanencia mínima (meses)',s.minm],['Aplicar permanencia mínima',s.exmin==null?pending:s.exmin?'Sí':'No'],
    ['Ahorradores que califican',calculation.nqual??calculation.rows.filter(r=>r.ok).length],['Ahorradores incluidos',calculation.rows.length],
    ['Base de capital',s.capitalBasis],['Rendimiento sobre rendimiento',s.yieldMode]];
  const amounts=[['Interés conciliado en la hoja',cash(calculation.collected)],['Interés proyectado, separado del reparto',cash(calculation.projected)],
    ['Gasto administrativo conciliado, separado del interés',cash(calculation.administrative_fees)],['Costos y apartados',cash(calculation.costsTotal)],
    ['Efecto de los costos en la bolsa',calculation.costsEffectLabel],['Bolsa después de costos',cash(calculation.pool)],['Reserva restante',cash(calculation.reserve)],
    ['Base elegible de reparto',cash(calculation.base)],['Rendimiento simulado distribuido',cash(calculation.distributed)],['Entrega neta simulada',cash(calculation.payTotal)],
    ['Bolsa proyectada después de costos',cash(calculation.projectedNetPool)],['Tasa proyectada sobre base confirmada',percent(calculation.projectedRateOnConfirmedBase)]];
  const liquidityPairs=[['Obligación bruta simulada',cash(liquidity.gross)],['Retenciones simuladas por préstamos',cash(liquidity.retained)],
    ['Obligación neta simulada',cash(liquidity.payTotal)],['Efectivo declarado después de costos pendientes',cash(liquidity.cash)],
    ['Cartera actual por recuperar · Caja de Ahorro',cash(liquidity.portfolio)],['Fecha de situación de la cartera',liquidity.portfolio_as_of],['Cobertura con efectivo declarado',percent(liquidity.coverage)]];
  const supplied=Array.isArray(liquidity.scenarios)?liquidity.scenarios:[];
  const scenarioRows=[...new Set([10,25,50,100,...supplied.map(row=>row.percent).filter(finite)])].map(p=>{
    const matching=supplied.filter(row=>row.percent===p),r=matching.length===1?matching[0]:{};
    const status={REVIEW:'Información por conciliar',CASH_COVERED:'Cubierto con efectivo declarado',COLLECTION_DEPENDENT:'Depende de recuperar la cartera',SHORTFALL:'Respaldo insuficiente'}[r.status]||r.status_label||pending;
    return ['Retiro del '+percent(p),cash(r.required??r.payTotal),cash(r.cash),cash(r.portfolio),percent(r.coverage),percent(r.coverage_with_portfolio),cash(r.shortfall),status];
  });
  const bankPairs=[['Saldo bancario declarado',cash(calculation.bank?.amount)],['Declarado por',calculation.bank?.declaredBy],['Fecha de declaración',calculation.bank?.date]];
  const provenance=[['Fuente de préstamos',loans?.source],['Observación de la fuente',loans?.observed_at],['Huella fuente',loans?.source_fingerprint],
    ['Motor',calculation.engine_version],['Huella cálculo',calculation.fingerprint??context?.calculation_fingerprint],['Certificación de efectivo','No certificada por la fecha de amortización']];
  const table=(headers,rows)=>'<table><thead><tr>'+headers.map(h=>'<th>'+escapeHtml(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+escapeHtml(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
  const notes=['La declaración bancaria no constituye una conciliación bancaria. La cartera actual es una cuenta por recuperar; su cobro y su fecha no están garantizados.',
    'POR CONCILIAR no equivale a cero ni a cobertura demostrada. Las proyecciones no se suman al interés conciliado disponible para el reparto.',...(liquidity.notes||[]),...(calculation.alerts||[]).map(a=>a.text)];
  return encoder.encode('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Acta de escenario SICOF</title><style>body{font:14px Arial,sans-serif;margin:32px;color:#222}h1,h2{color:#930027}table{border-collapse:collapse;width:100%;margin:18px 0}td,th{border:1px solid #ccc;padding:7px;text-align:left;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}pre{white-space:pre-wrap}.rates{display:flex;gap:30px;font-size:20px;background:#930027;color:white;padding:16px}.signatures{display:flex;gap:50px;margin-top:70px}.signatures div{flex:1;text-align:center;border-top:1px solid;padding-top:8px}.print{margin-top:25px;padding:12px;background:#930027;color:white;border:0}@media print{body{margin:12mm}.print{display:none}}</style></head><body><p>SUTISSSTESON · Caja de Ahorro Voluntaria Semestral</p><h1>Acta de escenario de rendimiento · SICOF</h1><p>Documento de revisión. No acredita rendimientos ni registra entregas. Las fechas de pagos corresponden a la amortización de la hoja, no a una fecha de recepción verificada.</p>'+
    '<div class="rates"><span>Tasa del periodo: '+escapeHtml(percent(calculation.rate))+'</span><span>Equivalente anual simple: '+escapeHtml(percent(calculation.annualRate))+'</span></div>'+
    '<h2>Parámetros del escenario</h2>'+table(['Concepto','Valor'],pairs)+'<h2>Determinación del monto</h2>'+table(['Concepto','Valor'],amounts)+
    '<h2>Costos y apartados</h2>'+table(['Concepto','Importe','Origen','Estado','Fecha'],(calculation.costs||[]).map(c=>[c.concept,cash(c.amount),c.source,c.status,c.date]))+
    '<h2>Prueba de liquidez</h2>'+table(['Concepto','Valor'],liquidityPairs)+table(['Escenario','Obligación neta','Efectivo declarado','Cartera por recuperar','Cobertura efectivo','Cobertura si se recupera cartera','Faltante tras recuperación','Resultado'],scenarioRows)+
    '<h2>Declaración del saldo bancario</h2>'+table(['Concepto','Valor'],bankPairs)+'<h2>Reparto simulado</h2>'+table(['Folio','Nombre','Rendimiento','Retenido','Entregable','Motivo'],calculation.rows.map(r=>[r.f,r.n,cash(r.rend),cash(r.retenido),cash(r.entregable),r.motivo]))+
    '<h2>Reglas completas</h2><pre>'+escapeHtml(JSON.stringify(s,null,2))+'</pre><h2>Fuentes y trazabilidad</h2>'+table(['Concepto','Valor'],provenance)+
    '<h2>Observaciones</h2><ul>'+notes.map(note=>'<li>'+escapeHtml(note)+'</li>').join('')+'</ul><p>Espacios para revisión del escenario. Su impresión no registra una aprobación contable en SutiApp.</p><div class="signatures"><div>Secretaría General</div><div>Secretaría de Finanzas</div></div><button type="button" class="print" onclick="window.print()">Imprimir / Guardar como PDF</button></body></html>');
}

export async function exportSicofReport({kind,calculation,context,loans,filters={},templateBytes,ExcelJS}) {
  // This path must remain independent of Google and of the current calculator.
  if(kind==='final_ahorro'&&filters.historical===true){
    const bytes=bytesOf(templateBytes);
    if(!bytes||bytes.length<4||bytes[0]!==80||bytes[1]!==75)throw Error('SICOF_EXPORT_TEMPLATE_REQUIRED');
    return{bytes,contentType:'application/octet-stream',filename:'Reporte Final Ahorro JC (3 reglas).xlsx'};
  }
  const byFund=kind==='matriz_fondos';
  if(byFund)kind='matriz';
  if(kind==='csv'){kind='reparto';filters={...filters,format:'csv'};}
  filters=validateFilters(filters);
  if(kind==='acta')return{bytes:acta(calculation,loans,context),contentType:'text/html; charset=utf-8',filename:'SICOF_escenario.html'};
  const table=buildSicofExportTable(kind,{calculation,context,loans,filters});
  if(filters.format==='csv')return{bytes:csv(table),contentType:'text/csv; charset=utf-8',filename:'SICOF_'+kind+'.csv'};
  if(filters.format!=null&&filters.format!=='xlsx')throw Error('SICOF_EXPORT_FORMAT_INVALID');
  if(!ExcelJS?.Workbook)throw Error('SICOF_EXPORT_EXCEL_REQUIRED');
  const workbook=new ExcelJS.Workbook();workbook.creator='SutiApp';workbook.calcProperties={fullCalcOnLoad:true};
  if(kind==='final_ahorro')await currentFinal(workbook,templateBytes,context,filters);
  else if(kind==='reparto_formulado')addFormulaReparto(workbook,calculation,filters,loans);
  else if(byFund){
    const selectedFunds=[...new Set((loans.loans||[]).filter(r=>matches(r,filters)&&(!filters.year||(r.schedule||[]).some(p=>!p.date||p.date.slice(0,4)===String(filters.year)))).map(r=>r.fund))];
    if(!selectedFunds.length)addTable(workbook,table);
    const used=new Set(['Fuentes y alcance','Incidencias fuente']);
    for(const fund of selectedFunds){
      const base=String(fund||'Fondo por conciliar').replace(/[\\/*?:\[\]]/g,' ').replace(/^'+|'+$/g,'').slice(0,26)||'Fondo';
      let name=base,n=1;while(used.has(name))name=base+' ('+(++n)+')';used.add(name);
      const one=buildSicofExportTable('matriz',{loans,filters:{...filters,fund}});one.name=name;addTable(workbook,one);
    }
  }
  else addTable(workbook,table);
  if(loans?.issues?.length)addTable(workbook,{name:'Incidencias fuente',columns:columns([['source_row','Fila'],['loan_id','Préstamo'],['folio','Folio'],['code','Incidencia']]),rows:loans.issues});
  metadata(workbook,{calculation,loans,filters,context});
  return{bytes:new Uint8Array(await workbook.xlsx.writeBuffer()),contentType:'application/octet-stream',filename:'SICOF_'+(byFund?'matriz_fondos':kind)+'.xlsx'};
}
