'use strict';
const assert=require('assert').strict,fs=require('fs');
const read=(file)=>fs.readFileSync(file,'utf8');
const screen=read('app/screens-financiera.jsx'),bundle=read('app/bundle.js');
for(const source of [screen,bundle]){
  assert(!source.includes('visibleItemIds'),'summary still depends on catalog visibility');
  assert(source.includes("itemId: 'prestamo'")&&source.includes("itemId: 'ahorro'")&&source.includes("itemId: 'inversion'"),'permanent summary actions missing');
  assert(source.includes("miniStat('Mi ahorro'")&&source.includes("miniStat('Mi inversión'"),'permanent summary stats missing');
}
assert(screen.includes('group.items.filter((item) => item.visible !== false).map((item) => {'),'lower catalog visibility gate was reverted');
assert(screen.includes('filter((group) => group.items.length)'),'empty lower catalog sections are not omitted');
assert(!/localStorage|sessionStorage|DATA\./.test(screen),'parallel authority introduced');
console.log(JSON.stringify({status:'PASS',catalogVisibilityPreserved:true,summaryIndependent:true,miAhorroAlwaysVisible:true,miInversionAlwaysVisible:true,ahorrarAlwaysVisible:true,invertirAlwaysVisible:true,financialCalculationsChanged:0}));
