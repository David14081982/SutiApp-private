'use strict';
const fs=require('fs');
const assert=require('assert');
const read=(file)=>fs.readFileSync(file,'utf8');
const screen=read('app/screens-admin.jsx');
const plans=read('app/screens-admin-planes.jsx');
const branding=read('app/screens-admin-branding.jsx');
const visual=read('app/screens-admin-visual-crud.jsx');
const news=read('app/screens-admin-news.jsx');

const ready=(screen.match(/ready: true/g)||[]).length;
const pending=(screen.match(/ready: false/g)||[]).length;
assert.strictEqual(ready,15,'exactly fifteen authority-backed Admin cards must be enabled');
assert.strictEqual(pending,0,'generic pending state must not remain');
assert.strictEqual((screen.match(/classification: 'PRODUCTIVE_/g)||[]).length,13,'thirteen classified modules have productive authority after the financial read-only cutover');
assert.strictEqual((screen.match(/classification: '(?:BLOCKED_|OWNER_)/g)||[]).length,0,'no generic blocked Admin card remains');
assert(screen.includes("const productive = m.ready || String(m.classification||'').startsWith('PRODUCTIVE_')"));
assert(screen.includes("'data-admin-status': m.classification|| (usable?'PRODUCTIVE_SUPABASE':'DENIED')"));
assert(!screen.includes('EN PREPARACIÓN'));
assert(screen.includes("const allowedViews = ['menu'].concat(MODULES.map((m)=>m.id))"));
assert(!/CRUD Supabase pendiente|permisos técnicos activos desde Supabase|Sesión Supabase/.test(screen));

assert(plans.includes("app.admin.has('company_portal.write')"));
assert(!plans.includes('window.adminStore'));
for(const operation of ['await store.savePlan','await store.removePlan','await store.duplicatePlan','await store.togglePlan','await store.setCompanyPlan'])assert(plans.includes(operation),operation+' missing');
assert(plans.includes("'data-company-plans-state': 'loading'")&&plans.includes("state.phase === 'error'"));

for(const source of [branding,visual,news])assert(!/PENDING BACKEND|Supabase Auth \+ RLS|Supabase \+ Storage \+ RLS|Sin permiso assets\.write/.test(source));
assert(news.includes('segmentación por perfil aún no está disponible'));
console.log('Admin productization static verification PASS: fifteen authority-backed cards active, financial legacy remains read-only.');
