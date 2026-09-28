/* Document configuration and issued records: Supabase only; no persistent browser cache. */
(function(){
 'use strict';
 const db=()=>window.SutiSupabase.getClient();
 const context=()=>{const s=window.AffiliateAuth&&window.AffiliateAuth.getState();return JSON.stringify([s&&s.session&&s.session.user&&s.session.user.id,s&&s.affiliate&&s.affiliate.id,window.AdminRepository&&window.AdminRepository.getState().assignment]);};
 async function command(action,data={}){const before=context(),r=await db().rpc('document_generation_command',{p_action:action,p_data:data});if(before!==context())throw Error('DOCUMENT_CONTEXT_CHANGED');if(r.error)throw r.error;return r.data;}
 async function edge(action,data){const before=context(),r=await db().functions.invoke('document-generation',{body:{action,...data}});if(before!==context())throw Error('DOCUMENT_CONTEXT_CHANGED');if(r.error){let code;try{code=(await r.error.context.json()).error;}catch(_){}throw Error(code||'DOCUMENT_SERVICE_UNAVAILABLE');}return r.data;}
 async function upload(kind,file){if(!file||file.size>8388608)throw Error('DOCUMENT_UPLOAD_TOO_LARGE');const bytes=new Uint8Array(await file.arrayBuffer());let text='';for(let n=0;n<bytes.length;n+=8192)text+=String.fromCharCode(...bytes.subarray(n,n+8192));return edge('UPLOAD',{kind,base64:btoa(text)});}
 window.DocumentGenerationRepository=Object.freeze({context,command,upload,dashboard:()=>command('DASHBOARD'),list:(data)=>command('LIST',data),retry:(id)=>command('RETRY',{id,admin:true}),access:(id,admin=false)=>edge('ACCESS',{data:{id,admin}}),asset:(id)=>edge('ASSET_ACCESS',{data:{id}}),preview:(program,document_type,config)=>edge('PREVIEW',{program,document_type,config})});
})();
