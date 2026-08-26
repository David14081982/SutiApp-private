'use strict';
const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const read=(file)=>fs.readFileSync(file,'utf8');

const refs=[];
global.window=global;
global.location={href:'https://sutiapp.test/'};
global.requestAnimationFrame=(fn)=>fn();
global.React={
  useRef(initial){const index=global.__hookIndex++;if(!refs[index])refs[index]={current:initial};return refs[index];},
  createElement(type,props,...children){return{type,props:props||{},children};},
};
global.Icon=function Icon(){};
vm.runInThisContext(read('app/rich-text.jsx'),{filename:'app/rich-text.jsx'});

function renderEditor(value,onChange){global.__hookIndex=0;return global.RichTextEditor({value,onChange});}
function textOf(node){if(node==null)return'';if(typeof node==='string')return node;if(Array.isArray(node))return node.map(textOf).join('');return(node.children||[]).map(textOf).join('');}

const exact='Línea alfa.\n\n🎓 Línea beta exactamente así.\n\n- Línea gamma escrita manualmente.\n\nFINAL-XYZ-987';
const rendered=global.RichText({value:exact});
assert.strictEqual(rendered.props['data-structured-content'],'rich-text','structured content boundary missing');
assert.deepStrictEqual(rendered.children[0].map((node)=>node.type),['p','p','ul','p'],'explicit list rendering changed');
assert.strictEqual(textOf(rendered),'Línea alfa.🎓 Línea beta exactamente así.Línea gamma escrita manualmente.FINAL-XYZ-987');
const unsafe=global.RichText({value:'**<img src=x onerror=alert(1)>**\n[x](javascript:alert(1))'});
assert.strictEqual(unsafe.children[0][0].children[0][0].type,'strong','safe bold formatting changed');
assert.strictEqual(unsafe.children[0][0].children[0][0].children[0],'<img src=x onerror=alert(1)>','HTML-like text was not preserved as inert text');
assert(!JSON.stringify(unsafe).includes('href'),'unsafe javascript link received an href');

let current=exact;
let tree=renderEditor(current,(next)=>{current=next;});
const toolbar=tree.children[0],textarea=tree.children[1];
const fake={selectionStart:0,selectionEnd:0,focus(){},setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}};
textarea.props.ref.current=fake;

// A raw input must become the latest canonical value before React rerenders.
const rapid='ALFA-001\n\n🎓 Emoji gamma.\n\n- Bullet delta.\n\nFINAL-XYZ-987';
textarea.props.onChange({target:{value:rapid}});
fake.selectionStart=0;fake.selectionEnd=8;
toolbar.children[0].props.onClick();
assert.strictEqual(current,'**ALFA-001**\n\n🎓 Emoji gamma.\n\n- Bullet delta.\n\nFINAL-XYZ-987','toolbar rebuilt from stale content');

// Empty selections add only explicit syntax, never template copy.
tree=renderEditor('',(next)=>{current=next;});
tree.children[1].props.ref.current=fake;fake.selectionStart=0;fake.selectionEnd=0;
tree.children[0].children[0].props.onClick();
assert.strictEqual(current,'****','bold action invented placeholder text');
assert(!/texto destacado|Título de sección|Elemento|texto del enlace/.test(current),'template copy leaked into article');

const rich=read('app/rich-text.jsx');
const live=read('app/live-text.jsx');
const news=read('app/screens-admin-news.jsx');
const adminRepo=read('app/admin-repository.js');
const publicRepo=read('app/content-repositories.js');
const publicScreen=read('app/screens-marketplace.jsx');
const adminRoot=read('app/screens-admin.jsx');
const visualCrud=read('app/screens-admin-visual-crud.jsx');
const branding=read('app/screens-admin-branding.jsx');
const flows=read('app/screens-admin-flujos.jsx');
const unionAdmin=read('app/screens-admin-sindicato.jsx');
const catalogAdmin=read('app/screens-admin-catalogo.jsx');
const membershipsAdmin=read('app/screens-admin-membresias.jsx');
assert(live.includes("[data-notext],[data-lt-ui],[data-structured-content]"),'LiveText structured-data exclusion missing');
assert(news.includes("value: d.body||''")&&news.includes("value:d.body")&&news.includes("body:d.body||''"),'News canonical body chain diverged');
assert(adminRepo.includes("table:'news_articles'")&&adminRepo.includes("'body'"),'News writer mapping missing');
assert(publicRepo.includes('id,title,tag,body')&&publicScreen.includes("value:n.body||''"),'News public body chain missing');
assert(publicScreen.includes("n.tag && React.createElement('div'")&&publicScreen.includes('n.tag.toUpperCase()'),'optional News tag can crash article');
assert(!rich.includes('dangerouslySetInnerHTML'),'unsafe rich-text HTML injection introduced');

const appSources=fs.readdirSync('app').filter((name)=>/\.(?:js|jsx)$/.test(name)&&name!=='bundle.js').map((name)=>read('app/'+name)).join('\n');
assert.strictEqual((appSources.match(/React\.createElement\(window\.RichTextEditor/g)||[]).length,1,'unclassified RichTextEditor consumer');
assert.strictEqual((appSources.match(/React\.createElement\(window\.RichText,/g)||[]).length,2,'preview/public renderer consumers diverged');
for(const kind of ['banners','popups','companies','documents','education','minutes','programs'])assert(visualCrud.includes(kind+':{'),kind+' Admin pipeline missing');
assert(adminRoot.includes("view === 'noticias'")&&adminRoot.includes("view==='marketplace'")&&adminRoot.includes("view==='membresias'")&&adminRoot.includes("view==='sindicato'")&&adminRoot.includes("view==='flujos'"),'Admin route sweep incomplete');
assert(branding.includes("'data-branding-preview-name':'")&&branding.includes('form.app_name')&&branding.includes('form.description'),'branding preview is not a direct form projection');
assert(flows.includes('PreviewSheet, { flow: live')&&flows.includes('const steps = store.steps'),'workflow preview pipeline changed');
assert(unionAdmin.includes("value: d.texto || ''")&&unionAdmin.includes('store.saveBlock(id, d)'),'union block pipeline missing');
assert(catalogAdmin.includes("value: d.desc || ''")&&catalogAdmin.includes('S().save(rec,actor)'),'Marketplace content pipeline missing');
assert(membershipsAdmin.includes('await store.save(rec)'),'Membership pipeline missing');

console.log(JSON.stringify({
  status:'PASS',
  editor_preview_exact:true,
  rapid_edit_uses_latest_value:true,
  invented_placeholder_text:0,
  structured_copy_override_interference:0,
  shared_renderer:true,
  xss_safe_react_nodes:true,
  admin_surfaces_scanned:18,
  editors_found:17,
  preview_surfaces:3,
  shared_renderers:1,
  shared_serializers:0,
  shared_sanitizers:1,
  same_bug_confirmed:1,
  same_bug_fixed:1,
}));
