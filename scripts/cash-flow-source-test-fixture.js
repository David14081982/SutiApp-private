'use strict';
// Synthetic source bases for isolated tests only. Never imported by app/runtime.
module.exports=function(report){
 report.sourceBases={version:1,consultedAt:report.consultedAt,savingsInputsAvailable:true,tables:['Base PV2','Base Solicitudes','Base Ahorro','Base Inversores','Base Contratos'].map(name=>({name,authority:'ISOLATED TEST',classification:'Synthetic',columns:['Referencia','Importe'],rows:[['=HYPERLINK("bad")',12.34]]}))};
 return report;
};
