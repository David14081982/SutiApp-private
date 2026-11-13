// Explicit opt-in provider test. Generated fictional documents only; no applicant data.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { extractWithOpenAI } from '../supabase/functions/financial-document-review/openai.mjs';
import { evaluate } from '../supabase/functions/financial-document-review/engine.mjs';
if(process.env.FINREVIEW_SYNTHETIC_LIVE!=='1')throw Error('SYNTHETIC_LIVE_OPT_IN_REQUIRED');
const root=process.env.FINREVIEW_LAB_ROOT||process.cwd(),require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const env={};for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').split(/\r?\n/)){const m=line.match(/^\s*([A-Z0-9_]+)\s*=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
assert(env.OPENAI_API_KEY);
const documents=['ine_front','ine_back','payroll_latest','payroll_previous'].map(code=>({id:code,code,label:code,document_type_id:code}));
const context={documents,requirements:documents.map(d=>({...d,required:true})),applicant_name:'PERSONA FICTICIA DE PRUEBA',submission_day:'2026-11-12',signature_available:false,expected_periods:null};
let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:828,height:1792}});await page.route('**/*',r=>r.abort());
 const attachments=[];
 for(const doc of documents){
  if(doc.code.startsWith('payroll')){
   const latest=doc.code==='payroll_latest',gross=latest?'7,126.49':'7,400.00',deductions=latest?'4,732.64':'4,800.00',net=latest?'2,393.85':'2,600.00';
   await page.setContent(`<style>body{margin:0;background:#f5f5f5;font:16px Arial;color:#111}.bar{padding:30px;font-size:25px}.paper{background:white;margin:100px 20px 0;padding:25px 15px;border:1px solid #555;height:1030px;position:relative}h1{font-size:25px;margin-top:0}table{width:100%;border-collapse:collapse;font-size:14px}td{border:1px solid #777;padding:5px;text-align:center}.columns{display:flex;justify-content:space-between;font-size:12px}.bottom{position:absolute;bottom:30px;left:15px;right:15px;font-size:14px}.bottom div{display:flex;justify-content:space-between;padding:4px;border-bottom:1px solid #777}.muted{font-size:12px}</style><div class=bar>10:42 — VISOR DE RECIBO</div><div class=paper><div class=muted>EJEMPLO FICTICIO SIN VALIDEZ — MÉXICO</div><h1>ISSSTESON · Sonora, México · Recursos Humanos</h1><table><tr><td>NOMBRE<br>PERSONA FICTICIA DE PRUEBA</td><td>ÁREA<br>ADMINISTRACIÓN</td></tr><tr><td>RFC DE PRUEBA<br>XAXX010101000</td><td>CATEGORÍA<br>SUPLENTE</td></tr><tr><td colspan=2>PERIODO DE PAGO<br>${latest?'16/10/2026 AL 31/10/2026':'01/10/2026 AL 15/10/2026'}</td></tr></table><div class=columns><p>PERCEPCIONES<br>SUPLENCIAS ${gross}</p><p>DEDUCCIONES<br>ISR<br>CUOTA SINDICAL<br>SERVICIO MÉDICO</p></div><div class=bottom><div><span>Total Percepciones</span><span>$ ${gross}</span></div><div><span>Total Deducciones</span><span>$ ${deductions}</span></div><div><strong>Neto a pagar</strong><strong>$ ${net}</strong></div></div></div>`);
  }else{
   await page.setContent(`<style>body{margin:0;background:#ddd;font:20px Arial}.holder{width:828px;height:1500px;display:flex;align-items:center;justify-content:center}.card{width:1050px;min-width:1050px;height:560px;padding:25px;box-sizing:border-box;background:#eee1d4;border:3px solid #777;border-radius:20px;transform:rotate(90deg);position:relative}h1{font-size:26px}p{font-size:22px}.valid{position:absolute;right:45px;bottom:50px;font-size:20px}</style><div class=holder><div class=card><h1>INE — CREDENCIAL FICTICIA PARA PRUEBA — SIN VALIDEZ</h1><p>${doc.code==='ine_front'?'NOMBRE<br>PERSONA FICTICIA DE PRUEBA<br><br>AÑO DE REGISTRO 2004':'REVERSO FICTICIO<br>Sin firma capturada para comparación'}</p>${doc.code==='ine_front'?'<div class=valid>VIGENCIA<br>2025–2035</div>':''}</div></div>`);
  }
  const bytes=await page.screenshot();attachments.push({id:doc.id,mime:'image/png',base64:bytes.toString('base64')});
 }
 await browser.close();browser=null;
 const read=await extractWithOpenAI({apiKey:env.OPENAI_API_KEY,model:'gpt-5.6-terra',context,attachments});
 const result=evaluate(context,read.extraction);
 if(result.payroll.latest?.net!==2393.85) console.log(JSON.stringify({syntheticDiagnostic:read.extraction.documents.map(d=>({id:d.id,legibility:d.legibility,type:d.type_matches,name:d.holder_name,net:d.net,gross:d.gross,deductions:d.deductions,currency:d.currency,evidence:d.evidence})),analysis:read.analysis}));
 assert.equal(result.payroll.latest.net,2393.85,'PRINTED_NET_FOOTER');assert.equal(result.payroll.average,2496.93,'AVERAGE_TWO_RECEIPTS');
 assert(result.checks.some(c=>c.key==='ine-valid:ine_front'&&c.status==='PASS'),'ROTATED_YEAR_VALIDITY');
 assert(!result.observations.some(c=>/net:|ine-validity|payroll-calendar/.test(c.key)),'NO_FALSE_FINDINGS');
 assert.equal(read.extraction.documents.find(d=>d.id==='ine_front').valid_until,null,'NO_INVENTED_DATE');
 const report={status:'PASS',syntheticOnly:true,privateDocumentsSent:0,checks:['small_footer_net','Mexican_payroll_currency_evidence','rotated_INE_year_range','no_invented_expiry_date','two_receipt_average','no_fixed_calendar'],analysis:read.analysis,usage:read.usage};
 fs.mkdirSync('docs/qa/evidence/financial-document-review-002',{recursive:true});fs.writeFileSync('docs/qa/evidence/financial-document-review-002/vision-live.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(e){console.error('SYNTHETIC_VISION_FAILED '+e.message);process.exitCode=1;}finally{if(browser)await browser.close();}
