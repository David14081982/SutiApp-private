/* Suti Farma: catalog products, private operational stock and donation requests. */
(function(){
 'use strict';
 async function command(action,data={}){const r=await window.SutiSupabase.getClient().rpc('farma_command',{p_action:action,p_data:data});if(r.error)throw r.error;return r.data;}
 const changed=()=>window.dispatchEvent(new Event('suti:farma-changed'));
 async function write(action,data){const row=await command(action,data);changed();return row;}
 function message(error){const code=String(error&&error.message||'');return code.includes('VERSION_CONFLICT')?'La información cambió. Recarga antes de guardar.':code.includes('INSUFFICIENT_STOCK')?'La cantidad supera las existencias disponibles.':code.includes('UNAVAILABLE')?'Este medicamento no está disponible para nuevas solicitudes.':code.includes('NOTIFICATION_PHONE')?'Escribe un teléfono de 10 dígitos.':code.includes('QUANTITY')||code.includes('STOCK_INVALID')?'Revisa la cantidad y la unidad.':code.includes('DENIED')?'No tienes permiso para esta operación.':'No pudimos completar la operación. Intenta nuevamente.';}
 const states={received:'Recibida',in_progress:'En atención',ready:'Lista para entrega',delivered:'Entregada',unavailable:'Sin disponibilidad',cancelled:'Cancelada'};
 function workflow(row){const order=['received','in_progress','ready','delivered'],index=order.indexOf(row.status),terminal=index<0;return {available:true,stages:order.map((id,i)=>({id,label:states[id],state:i<index?'done':i===index?'current':'upcoming',description:i===0?'Pronto nos pondremos en contacto contigo para brindarte atención personalizada.':undefined,date:row.events.find(e=>e.status===id)?.created_at})),message:terminal?states[row.status]:undefined};}
 window.FarmaRepository=Object.freeze({command,message,states,workflow,contact:()=>command('CONTACT'),mine:()=>command('MINE'),queue:()=>command('QUEUE'),inventory:()=>command('INVENTORY'),submit:data=>write('SUBMIT',data),save:data=>write('SAVE_PRODUCT',data),archive:data=>write('ARCHIVE',data),transition:data=>write('TRANSITION',data)});
})();
