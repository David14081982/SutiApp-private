'use strict';
const assert=require('assert').strict,fs=require('fs'),vm=require('vm');
const read=(file)=>fs.readFileSync(file,'utf8');
const documents=read('app/screens-documentos.jsx');
const membership=read('app/screens-membership-application.jsx');
const viewer=read('app/image-viewer.jsx');
const repository=read('app/document-workflow-repository.js');
const edge=read('supabase/functions/document-access/index.ts');
const bundle=read('app/bundle.js');

for(const source of [documents,membership,viewer,repository])new vm.Script(source);

assert.match(documents,/\[thumbnails,setThumbnails\]=useState\(\{\}\)/);
assert.match(documents,/String\(doc\.mimeType\|\|''\)\.toLowerCase\(\)\.startsWith\('image\/'\)/);
assert.match(documents,/DocumentWorkflowRepository\.selfPreview\(doc,accessPurpose\|\|'SELF_SERVICE_EXPEDIENTE'\)/);
assert.match(documents,/className:'mr-doc-thumb',src:thumbnail\.url/);
assert.match(documents,/onError:\(\)=>refreshThumbnail\(doc\)/);
assert.match(documents,/viewer&&h\(window\.DocumentViewer/);
assert.match(documents,/data-document-action':action/);
assert.match(documents,/className:'mr-doc-replace'/);
assert.match(documents,/await onChanged\(\)/);
assert.match(documents,/\},\[requirements,documents,accessPurpose\]\)/);
assert.doesNotMatch(documents,/doc\.signedUrl|window\.open|about:blank/);

assert.match(membership,/\.mr-doc-thumb\{[^}]*object-fit:cover/);
assert.match(membership,/\.mr-doc-tile\.is-filled \.mr-doc-pick\{background:linear-gradient/);
assert.doesNotMatch(membership,/\.mr-doc-tile\.is-filled \.mr-doc-pick\{background:#14213d/);
assert.match(membership,/\.mr-doc-veil\{[^}]*rgba\(10,6,8,\.02\)/);
assert.match(membership,/\.mr-doc-replace\{/);
assert.match(membership,/\.mr-doc-status\{position:absolute/);

assert.match(viewer,/function DocumentViewer/);
assert.match(viewer,/React\.createElement\(ImageViewer/);
assert.match(viewer,/data-document-viewer': isPdf \? 'pdf' : 'unsupported'/);
assert.match(viewer,/React\.createElement\('iframe'/);
assert.match(viewer,/Object\.assign\(window, \{ ImageViewer, DocumentViewer/);
assert.match(repository,/signedUrl:null/);
assert.match(repository,/functions\.invoke\('document-access'/);
assert.doesNotMatch(repository,/createSignedUrls?/);
assert.match(edge,/createSignedUrl\(authorized\.storage_path, TTL_SECONDS\)/);
assert.match(edge,/const TTL_SECONDS = 300/);
assert.match(edge,/Cache-Control": "private, no-store, max-age=0"/);
assert.match(bundle,/@@file image-viewer\.jsx/);
assert.match(bundle,/@@file screens-documentos\.jsx/);
assert.doesNotMatch([documents,membership].join('\n'),/localStorage|sessionStorage|IndexedDB|FileReader|data:image/);

console.log('Membership document thumbnail and in-app viewer contract PASS');
