'use strict';
const fs=require('fs'),assert=require('assert/strict'),{sourceInventory,inspect,read}=require('./screen-permission-contract');
const inventory=sourceInventory(),metadata=JSON.parse(read('docs/qa/evidence/screen-permissions-20260924/production-metadata.json')),surfaces=JSON.parse(read('scripts/screen-permission-surfaces.json'));
const result=inspect(inventory,metadata,surfaces);assert.deepEqual(result.errors,[]);
const parent=inventory.modules.find(x=>x.id==='finanzas'),child=inventory.modules.find(x=>x.id==='finance_blocks');assert.equal(child.accessModule,parent.id);
assert(inventory.groups.find(x=>x.id==='finance').modules.join(',').startsWith('finanzas,finance_blocks,sicof,'));
for(const alias of ['unknown','finance_blocks']){child.accessModule=alias;assert(inspect(inventory,metadata,surfaces).errors.includes('INVALID_ACCESS_MODULE:finance_blocks'));}
child.accessModule='finanzas';inventory.permissions.finance_blocks='savings.read';assert(inspect(inventory,metadata,surfaces).errors.includes('ACCESS_MODULE_PERMISSION_MISMATCH:finance_blocks'));
console.log(JSON.stringify({status:'PASS',checks:['existing enforced finance backend module','unknown/self alias denied','permission mismatch denied','sidebar position']}));
