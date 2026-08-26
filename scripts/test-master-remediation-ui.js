'use strict';
const assert=require('assert');const fs=require('fs');const read=(p)=>fs.readFileSync(p,'utf8');
const viewer=read('app/image-viewer.jsx'),home=read('app/screens-home-r2.jsx'),convenios=read('app/screens-convenios.jsx');
const news=read('app/screens-marketplace.jsx'),catalog=read('app/screens-catalogo.jsx'),admin=read('app/screens-admin-visual-crud.jsx');
const newsAdmin=read('app/screens-admin-news.jsx'),richText=read('app/rich-text.jsx');
const builder=read('scripts/build-bundle.js'),bundle=read('app/bundle.js');
const deletion=read('supabase/migrations/20260823000300_harden_admin_content_delete.sql');
const deletionRecovery=read('supabase/recovery/20260823000300_restore_admin_content_delete.sql');
for(const token of ['data-image-viewer','onPointerDown','onPointerMove','touchAction: \'none\'','scale: clamp','onWheel','Restablecer zoom','openSafeContentUrl'])assert(viewer.includes(token),token+' missing from global image viewer');
assert(viewer.includes("target.protocol !== 'http:'")&&viewer.includes("target.protocol !== 'https:'"),'unsafe action URL protocol accepted');
assert(!home.includes('homeBanners[0]'),'Home still pins the first banner');
for(const token of ['setTimeout','data-home-banner-dots','data-home-banner-index','window.openSafeContentUrl','window.ImageViewer'])assert(home.includes(token),token+' missing from Home banners');
for(const source of [convenios,news,catalog])assert(source.includes('window.ImageViewer'),'surface does not reuse global viewer');
assert(admin.includes("['ADMIN_H009','ADMIN_SECTION_ROLLOUT'].includes(item.record_origin)")&&admin.includes("item.provenance==='ADMIN_PHASE2'")&&admin.includes('window.confirm')&&admin.includes('removeManaged'),'exact admin-origin delete contract missing');
for(const token of ['data-rich-text-editor','safeHref','url.protocol===\'http:\'','url.protocol===\'https:\'','Object.assign(window,{RichText,RichTextEditor})'])assert(richText.includes(token),token+' missing from safe rich text');
assert(!richText.includes('dangerouslySetInnerHTML'),'rich text injects raw HTML');
assert(newsAdmin.includes('window.RichTextEditor')&&newsAdmin.includes('data-rich-text-preview')&&news.includes('window.RichText'),'rich text Admin-to-frontend reflection missing');
assert(admin.includes('data-education-admin-tabs')&&admin.includes("item.resource_kind===educationKind")&&admin.includes("['tutorial','Tutoriales']"),'Education and Tutorials are not separated in Admin');
assert(admin.includes('move(shown,index,-1)')&&admin.includes('move(shown,index,1)')&&!admin.includes("kind==='education'&&React.createElement('button',{onClick:()=>move"),'ordering is not available across visual CRUD lists');
for(const table of ['companies','banners','popups']){
  assert(deletion.includes(`drop policy if exists ${table}_admin_all`),`${table} broad delete policy remains active`);
  assert(deletion.includes(`create policy ${table}_admin_delete`),`${table} restricted delete policy missing`);
  assert(deletionRecovery.includes(`create policy ${table}_admin_all`),`${table} recovery policy missing`);
}
assert((deletion.match(/record_origin = 'ADMIN_H009'/g)||[]).length===7,'Admin-origin checks are incomplete');
assert(deletion.includes('grant delete on public.companies, public.banners, public.popups, public.institutional_documents to authenticated;'),'DELETE table grant missing');
assert(deletionRecovery.includes('revoke delete on public.companies, public.banners, public.popups, public.institutional_documents from authenticated;'),'DELETE recovery revoke missing');
assert(builder.includes("'image-viewer.jsx'")&&builder.includes("'rich-text.jsx'")&&bundle.includes('/* @@file image-viewer.jsx */'),'bundle/source divergence');
console.log('MASTER remediation verification PASS: banners, reusable viewer, safe rich text, separated education/tutorials, ordering and historical-safe delete are wired.');
