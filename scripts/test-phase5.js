/* Static Phase 5 non-financial operations and Claude History checks. */
'use strict';
const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8'),must=(x,m)=>{if(!x)throw new Error(m);};
const store=read('app/operations-store.jsx'),ui=read('app/screens-historial.jsx'),bundle=read('app/bundle.js');
must(store.includes('MarketplaceRepository.listRequests()')&&store.includes('MarketplaceRepository.listQuotes()')&&store.includes('ProgramRequestRepository.list()'),'Supabase operation readers missing');
must(!store.includes('localStorage')&&!store.includes('window.DATA')&&!ui.includes('window.DATA')&&!ui.includes('financeStore')&&!ui.includes('flowStore'),'mock/financial fallback remains in History');
for(const x of ['SOLICITUD EN CURSO','Ver seguimiento','Todas','En proceso','Aprobadas','No aprobadas','Línea de tiempo','Contactar a un asesor','data-operations-state'])must(ui.includes(x),'Claude History contract missing '+x);
must(store.includes('ProgramRequestRepository.list()')&&bundle.includes('/* @@file operations-store.jsx */'),'unified request reader/bundle mismatch');
console.log('Phase 5 static verification PASS: History uses unified Supabase requests and preserves Claude tracking UI.');
