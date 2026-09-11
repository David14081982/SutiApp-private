'use strict';
// One-time migration preparation from audited UI; never loaded by the application.
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),priv='C:/tmp/sutiapp-program-general-info-20260910';
const fin=fs.readFileSync(path.join(root,'app/fincat-store.jsx'),'utf8');
const publicSource=fs.readFileSync(path.join(priv,'before/app/screens-marketplace.jsx'),'utf8');
const base=vm.runInNewContext(fin.slice(fin.indexOf('const base='),fin.indexOf('  const emit=')).replace('const base=',''));
const helpers=publicSource.slice(publicSource.indexOf('  function descFor('),publicSource.indexOf('  // ---------- MODULO'));
const sandbox={};vm.createContext(sandbox);vm.runInContext("const LISTING_CATS=['auto','renta','casa','terrenos','solar','aires','puertas','computo','market','tours','farma','cirugias','rifas','donativos'];"+helpers+';this.describe=descFor;this.benefits=benefitsFor;',sandbox);
const historic=JSON.parse(fs.readFileSync(path.join(priv,'institutional-before.json'),'utf8'));
const ordinal={auto:2,renta:3,market:5,casa:8,terrenos:9,tours:10,farma:11,cirugias:12,solar:13,rifas:14,aires:16,puertas:17,computo:18};
const keys=['auto','renta','casa','terrenos','solar','aires','puertas','computo','farma','cirugias','tours','market','rifas','donativos'];
const quote=v=>v==null?'null':"'"+String(v).replaceAll("'","''")+"'";
const statements=[];
for(const g of base)for(const [index,it] of g.items.entries())if(keys.includes(it.id)){
  const inst=historic.find(r=>r.source_row_ordinal===ordinal[it.id]);
  const info={description:sandbox.describe(it),breadcrumb:'',icon:it.icon,phone:inst?.phone_raw||'',whatsapp:inst?.whatsapp_raw||'',favorite_enabled:true,benefits_title:'Por qué te conviene',benefits:sandbox.benefits(it.id),catalog_title:'Disponibles ahora',detail:it.meta,popular:!!it.hero};
  if(it.id==='terrenos')Object.assign(info,{map_title:'El Fresnillo',map_subtitle:'Reserva Campestre · Hermosillo, Sonora',map_program_label:'SUTI TERRENO',map_description:'Lotes a plazos · descuento vía nómina'});
  statements.push(`insert into public.finance_catalog_presentation(item_key,group_key,label_override,description_override,sort_order,program_info,program_cover_asset_id)
values(${quote(it.id)},${quote(g.id)},${quote(it.label)},${quote(it.tagline)},${index},${quote(JSON.stringify(info))}::jsonb,${quote(inst?.primary_image_asset_id)}::uuid)
on conflict(item_key) do update set program_info=excluded.program_info,program_cover_asset_id=excluded.program_cover_asset_id
where public.finance_catalog_presentation.program_info is null;`);
}
const file=path.join(root,'supabase/migrations/20260910000200_program_general_info.sql');
let sql=fs.readFileSync(file,'utf8');const marker='-- INITIAL_PRESENTATION: appended by the preparation script from audited current UI.';
sql=sql.slice(0,sql.indexOf(marker))+marker+'\n'+statements.join('\n')+"\nnotify pgrst,'reload schema';\ncommit;\n";
fs.writeFileSync(file,sql);console.log('Prepared '+statements.length+' program headers; existing label/tagline/visibility/order retained.');
