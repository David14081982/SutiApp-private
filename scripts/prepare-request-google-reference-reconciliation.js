'use strict';
// Offline, auditable plan. Google mutations are applied separately after a fresh connector reread.
const fs=require('fs'),path=require('path'),assert=require('assert').strict,crypto=require('crypto');
const dir='C:/tmp/sutiapp-reference-reconcile-20260908',read=n=>JSON.parse(fs.readFileSync(path.join(dir,n))),source=read('source-before.json'),book=read('google-before.json'),target=book.sheets.find(s=>s.properties.sheetId===10616270),registry=book.sheets.find(s=>s.properties.sheetId===2026082207),rows=[],requests=[],rollback=[];
const value=c=>Object.values(c?.userEnteredValue||{})[0]??'',quote=s=>"'"+String(s).replace(/'/g,"''")+"'",sha=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex').toUpperCase();
function updateCell(row,col,text){const old=registry.data[0].rowData[row-1]?.values?.[col-1]||{};assert(!old.userEnteredValue?.formulaValue);if(old.dataValidation)assert(old.dataValidation.condition.type==='ONE_OF_LIST'&&old.dataValidation.condition.values.some(v=>v.userEnteredValue===text),'VALIDATION_REJECTS_VALUE');const base={start:{sheetId:2026082207,rowIndex:row-1,columnIndex:col-1},fields:'userEnteredValue'};requests.push({updateCells:{...base,rows:[{values:[{userEnteredValue:{stringValue:text}}]}]}});rollback.push({updateCells:{...base,rows:[{values:[old]}]}});}
const sql=['begin;',"select set_config('request.jwt.claim.role','service_role',true);"],undo=['begin;',"select set_config('request.jwt.claim.role','service_role',true);"];
for(const s of source){
  const registrations=registry.data[0].rowData.map((r,i)=>({r,i})).filter(({r})=>value(r.values?.[0])===s.id);assert.equal(registrations.length,1);const registration=registrations[0],meta=JSON.parse(value(registration.r.values[12]).slice(16));assert.equal(meta.initial_sha256,sha(s.initial_row));
  const matches=target.data[0].rowData.map((r,i)=>({r,i})).filter(({r})=>[s.id,s.folio].includes(value(r.values?.[0])));assert(matches.length<=1,'DUPLICATE_IDENTITY');let row=null;
  if(matches.length){row=matches[0].i+1;const details=target.data[1].rowData[row-(target.data[1].startRow+1)]?.values;assert(details,'BOUNDED_DETAIL_MISSING');assert.equal(String(value(details[1])),s.numero_control);assert.equal(details[9].formattedValue,s.initial_row[9].slice(0,10).split('-').reverse().join('/'));assert(s.initial_row.every((v,c)=>[0,9,24].includes(c)||String(v??'')===String(value(details[c]))),'CAPTURED_DATA_CHANGED');}
  const changed=row!==s.google_row,entry={id:s.id,folio:s.folio,row,oldRow:s.google_row,registryRow:registration.i+1,legacyReference:s.legacy_reference,changed};rows.push(entry);
  if(!changed)continue;
  const qid=quote(s.id),oldReference='Historial de solicitudes!A'+s.google_row,newReference=row?'Historial de solicitudes!A'+row:null;
  sql.push(`do $row$ declare v public.program_request_google_sync%rowtype;begin perform 1 from public.program_requests where id=${qid}::uuid for update;select * into v from public.program_request_google_sync where request_id=${qid}::uuid for update;if v.google_row is distinct from ${s.google_row} or v.revision<>${s.revision} or v.synced_revision<>${s.synced_revision} or v.phase<>${quote(s.phase)} or v.lease_until is not null or v.initial_row is distinct from ${quote(JSON.stringify(s.initial_row))}::jsonb then raise exception 'REFERENCE_BASELINE_DRIFT';end if;`);
  sql.push(`insert into public.program_request_google_reference_audit(request_id,old_google_row,new_google_row,action,actor_kind,revision) values(${qid}::uuid,${s.google_row},${row??'null'},${quote(row?'RELOCATED':'TARGET_MISSING')},'OWNER_RECONCILIATION',${s.revision});`);
  if(row){
    updateCell(registration.i+1,12,newReference);
    sql.push(`update public.program_request_google_sync set google_row=${row},updated_at=now() where request_id=${qid}::uuid;update public.program_requests set legacy_reference=${quote(newReference)} where id=${qid}::uuid and legacy_reference=${quote(oldReference)};`);
    undo.push(`do $undo$ begin if not exists(select 1 from public.program_request_google_sync where request_id=${qid}::uuid and google_row=${row} and revision=${s.revision} and lease_until is null) then raise exception 'RECOVERY_DRIFT';end if;update public.program_request_google_sync set google_row=${s.google_row},updated_at=${quote(s.updated_at)}::timestamptz where request_id=${qid}::uuid;update public.program_requests set legacy_reference=${quote(oldReference)} where id=${qid}::uuid and legacy_reference=${quote(newReference)};end $undo$;`);
  }else{
    updateCell(registration.i+1,11,'failed');updateCell(registration.i+1,15,'REQUEST_SYNC_TARGET_MISSING');updateCell(registration.i+1,16,'Fila confirmada ausente; referencia anterior conservada para auditoria.');
    sql.push(`update public.program_request_google_sync set phase='error',error_code='REQUEST_SYNC_TARGET_MISSING',next_attempt_at='infinity'::timestamptz,updated_at=now() where request_id=${qid}::uuid;`);
    undo.push(`do $undo$ begin if not exists(select 1 from public.program_request_google_sync where request_id=${qid}::uuid and revision=${s.revision} and error_code='REQUEST_SYNC_TARGET_MISSING' and lease_until is null) then raise exception 'RECOVERY_DRIFT';end if;update public.program_request_google_sync set phase=${quote(s.phase)},error_code=null,next_attempt_at=${quote(s.next_attempt_at)}::timestamptz,updated_at=${quote(s.updated_at)}::timestamptz where request_id=${qid}::uuid;end $undo$;`);
  }
  sql.push('end $row$;');
}
sql.push('commit;');undo.push('-- Retain append-only audit history.','commit;');
const plan={rows,moved:rows.filter(r=>r.row&&r.changed).length,missing:rows.filter(r=>!r.row).length,alreadyCorrect:rows.filter(r=>!r.changed).length,targetWrites:0,AHOnwardWrites:0};
for(const [name,value] of [['plan.json',JSON.stringify(plan,null,2)],['google-requests.json',JSON.stringify(requests)],['google-rollback.json',JSON.stringify(rollback)],['reconcile.sql',sql.join('\n')],['reconcile-recovery.sql',undo.join('\n')]])fs.writeFileSync(path.join(dir,name),value);
console.log(JSON.stringify({status:'PASS',moved:plan.moved,missing:plan.missing,alreadyCorrect:plan.alreadyCorrect,targetWrites:0,googleMetadataCells:requests.length}));
