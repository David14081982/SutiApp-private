'use strict';
const assert=require('assert').strict,fs=require('fs'),path=require('path'),vm=require('vm'),root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const finance=read('app/screens-financiera.jsx'),app=read('app/app.jsx'),repository=read('app/financial-legacy-repository.js');new vm.Script(finance);
assert.match(app,/FinancialLegacyRepository\.availableCreditTotal\(financial\.overview\)/);
assert.match(finance,/FinancialLegacyRepository\.availableCreditTotal\(financial\.overview\)/);
assert.match(finance,/data-finance-available-credit/);
assert.doesNotMatch(finance,/value\(overview\.available_credit\)/);
assert.match(repository,/return amounts\.reduce\(\(total, amount\) => total \+ amount, 0\)/);
console.log('Finance credit consistency contract PASS');
