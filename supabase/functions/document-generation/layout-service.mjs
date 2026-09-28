import {syntheticSnapshot,documentContract} from './renderer.mjs';
import {layoutFields,fieldValue,formatField,validateLayout,initialLayout,TABLE_COLUMNS,LAYOUT_VERSION} from './layout.mjs';
export async function handleLayout(body,{contextCall,command,persist,render,loadAsset}){
 const reply=(status,data)=>({status,data});
   const scope={program:body.program,document_type:body.document_type},writing=['LAYOUT_SAVE','LAYOUT_ACTIVATE','LAYOUT_SYSTEM'].includes(body.action);
   const context=await contextCall(writing?'WRITE':'READ',scope);
   if(body.action==='LAYOUT_SYSTEM')return reply(200,await persist('SYSTEM',{...scope,id:body.id,actor:context.actor,context_affiliate:context.context_affiliate}));
   const version=body.version_id?await contextCall('VERSION',{...scope,id:body.version_id}):null;
   if(body.action==='LAYOUT_ACTIVATE'&&!version)throw Error('DOCUMENT_LAYOUT_VERSION_REQUIRED');
   const config=await command('PREVIEW_CONFIG',{...scope,template_id:(body.action==='LAYOUT_ACTIVATE'?version?.template_id:body.template_id||version?.template_id)||context.config.template.id,signers:context.config.signers});
   const snapshot=syntheticSnapshot(body.document_type,body.program,config),model=documentContract(snapshot);
   if(body.action==='LAYOUT_MANIFEST')return reply(200,{templates:(await command('DASHBOARD',{})).templates.map(t=>({id:t.id,name:t.name,version:t.version,active:t.active})),fields:layoutFields(body.document_type).map(d=>({...d,example:d.kind==='FIELD'?formatField(fieldValue(snapshot,d.key,model),d.format,'na'):d.label})),table_columns:TABLE_COLUMNS,
    template:{id:config.template.id,name:config.template.name,version:config.template.version,asset_id:config.template.asset_id,page_size:config.template.page_size,margins:config.template.margins},
    initial:initialLayout(body.document_type,config.template),versions:context.versions,active_id:context.active_id,can_write:context.can_write});
   const definition=body.action==='LAYOUT_ACTIVATE'?version.definition:body.definition;
   const errors=validateLayout(definition,body.document_type,config.template,{draft:body.action==='LAYOUT_PREVIEW'});if(errors.length)return reply(409,{error:'DOCUMENT_LAYOUT_INVALID',details:errors});
   snapshot.layout={definition,engine_version:definition.version,contract_version:definition.version===LAYOUT_VERSION?'2':'1'};
   // The same renderer checks fit and glyphs before saving/activating, using synthetic data only.
   let output;try{output=await render(snapshot,loadAsset,{preview:true,draft:body.action==='LAYOUT_PREVIEW'});}catch(e){if(e.layoutIssue)return reply(409,{error:e.message,details:[e.layoutIssue]});throw e;}
   if(body.action==='LAYOUT_PREVIEW')return {status:200,pdf:output.bytes};
   return reply(200,await persist(body.action==='LAYOUT_SAVE'?'SAVE':'ACTIVATE',{...scope,id:body.id,actor:context.actor,context_affiliate:context.context_affiliate,template_id:config.template.id,definition,layout_id:version?.id}));
}
