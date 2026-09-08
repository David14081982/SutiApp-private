'use strict';
// Same read-only modal acceptance against the request-sync candidate/release.
const fs=require('fs'),path=require('path'),vm=require('vm');
const file=path.join(__dirname,'test-finance-request-detail-modal-live.js');
const source=fs.readFileSync(file,'utf8').replaceAll('bundle.js?v=228','bundle.js?v=229').replace('docs/qa/evidence/finance-request-detail-modal-20260908','docs/qa/evidence/requests-workflow-google-sync-20260908/modal-live');
vm.runInNewContext(source,{require,__dirname,console,process,Buffer,setTimeout,clearTimeout},{filename:file});
