// Report-only relationships. This module never writes parent_id, dates or source amounts.
import {sourceDate} from './report.mjs';

const normalized=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
const originalStatus=c=>normalized(c.source_status);
const sequence=c=>Number(normalized(c.original_document||c.code).match(/CONTRATO\s*(\d+)/)?.[1])||null;
const references=c=>[...new Set([...normalized(c.original_document||c.code).matchAll(/\bR\s*C\s*(\d+(?:\s*,\s*\d+)*)/g)].flatMap(m=>m[1].split(',').map(Number)))];
const money=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))&&Math.abs(Number(value)*100)<=Number.MAX_SAFE_INTEGER&&Math.abs(Number(value)*100-Math.round(Number(value)*100))<.00001?Math.round(Number(value)*100):null;

export function resolveInvestorContinuity(originals){
 const contracts=originals.map(c=>({...c})),byId=new Map(contracts.map(c=>[c.id,c])),links=[],issues=[];
 const unresolved=(c,reason,candidates=[])=>{
  c.report_continuity_ambiguous=true;
  issues.push({code:reason,message:'La continuidad contractual no tiene una relaci?n ?nica; no se duplica capital ni se inventa una baja.',sourceIds:[c.id,...candidates.map(p=>p.id)],contractId:c.id,date:sourceDate(c.starts_on)});
 };
 const explicitChildren=new Map();
 for(const c of contracts)if(c.parent_id){if(!explicitChildren.has(c.parent_id))explicitChildren.set(c.parent_id,[]);explicitChildren.get(c.parent_id).push(c);}
 for(const [id,children] of explicitChildren)if(children.length>1){
  const parent=byId.get(id);if(parent)parent.report_continuity_ambiguous=true;
  for(const c of children)unresolved(c,'INVESTOR_CONTINUITY_AMBIGUOUS',parent?[parent]:[]);
 }
 const ordered=[...contracts].sort((a,b)=>String(a.starts_on).localeCompare(String(b.starts_on))||(sequence(a)||0)-(sequence(b)||0));
 for(const child of ordered){
  const start=sourceDate(child.starts_on);if(!start||child.report_continuity_ambiguous)continue;
  let parents=[],basis;
  if(child.parent_id){
   const parent=byId.get(child.parent_id);
   if(!parent||parent.id===child.id||parent.investor_id&&child.investor_id&&parent.investor_id!==child.investor_id||!sourceDate(parent.starts_on)||sourceDate(parent.starts_on)>=start||parent.report_transferred_on){
    unresolved(child,'INVESTOR_PARENT_RELATION_INVALID',parent?[parent]:[]);continue;
   }
   parents=[parent];basis='REGISTERED_PARENT';
  }else{
   const ordinal=sequence(child);if(!child.investor_id||!ordinal)continue;
   const refs=references(child),eligible=contracts.filter(parent=>parent.id!==child.id&&parent.investor_id===child.investor_id&&
    ['RENOVADO','AMPLIADO'].includes(originalStatus(parent))&&sourceDate(parent.starts_on)&&sourceDate(parent.starts_on)<start&&
    sequence(parent)!==null&&sequence(parent)<ordinal&&!parent.report_transferred_on&&!parent.report_continuity_ambiguous);
   parents=refs.length?eligible.filter(parent=>refs.includes(sequence(parent))):eligible.filter(parent=>sequence(parent)===ordinal-1);
   if(!parents.length)continue;
   const sameSequence=contracts.filter(c=>c.id!==child.id&&c.investor_id===child.investor_id&&sequence(c)===ordinal);
   if(sameSequence.length||new Set(parents.map(sequence)).size!==parents.length||!refs.length&&parents.length>1){
    unresolved(child,'INVESTOR_CONTINUITY_AMBIGUOUS',[...parents,...sameSequence]);continue;
   }
   basis=refs.length?'ORIGINAL_RENEWAL_REFERENCES':'ORIGINAL_CONTRACT_SEQUENCE';
  }
  for(const parent of parents){parent.report_successor_id=child.id;parent.report_transferred_on=start;}
  child.report_predecessor_ids=parents.map(p=>p.id);child.report_predecessor_id=parents.length===1?parents[0].id:null;child.report_continuity_basis=basis;
  const previousAmounts=parents.map(p=>money(p.principal)),previous=previousAmounts.every(n=>n!==null)?previousAmounts.reduce((a,b)=>a+b,0):null;
  const next=money(child.principal),contribution=money(child.registered_contribution),withdrawal=money(child.registered_withdrawal);
  const difference=previous!==null&&next!==null?next-previous-(contribution??0)+(withdrawal??0):null;
  links.push({parentId:parents.length===1?parents[0].id:null,parentIds:parents.map(p=>p.id),parentCode:parents.map(p=>p.code).join(' + '),
   parentSources:parents.map(p=>({contractId:p.id,contractCode:p.code,principal:p.principal,sourceSheet:p.source_sheet,sourceRow:p.source_row})),
   contractId:child.id,contractCode:child.code,investorId:child.investor_id,investorName:child.investor_name||null,date:start,basis,
   previousPrincipal:previous===null?null:previous/100,principal:next===null?null:next/100,
   registeredContribution:contribution===null?null:contribution/100,registeredWithdrawal:withdrawal===null?null:withdrawal/100,
   unattributedCapitalChange:difference===null?null:difference/100,
   parentSourceSheet:parents.map(p=>p.source_sheet).filter(Boolean).join(' + '),parentSourceRow:parents.length===1?parents[0].source_row:null,
   sourceSheet:child.source_sheet,sourceRow:child.source_row});
  if(difference)issues.push({code:'INVESTOR_CONTINUITY_CHANGE_UNATTRIBUTED',message:'El cambio de principal no se explica completamente por los ingresos y retiros originales; se conserva como cambio contractual, no como efectivo nuevo.',sourceIds:[...parents.map(p=>p.id),child.id],contractId:child.id,date:start});
 }
 return {contracts,links,issues};
}
