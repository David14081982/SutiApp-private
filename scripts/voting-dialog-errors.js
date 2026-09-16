'use strict';
const fs=require('fs'),path=require('path'),Module=require('module');
const file=path.join(__dirname,'test-voting-browser.js'),source=fs.readFileSync(file,'utf8'),setup=source.slice(0,source.indexOf(" await page.locator('.head').click();assert"));
const tail=`
 await page.evaluate(()=>{window.VotingRepository.action=async()=>{throw Error('transport unavailable');};window.VotingRepository.download=async()=>{throw Error('transport unavailable');};renderVoting(true);});
 await page.locator('[data-voting-admin-consultation] > button').click();
 await page.getByRole('button',{name:'Eliminar consulta',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Eliminar consulta',exact:true}).click();
 await page.getByRole('dialog').getByRole('alert').waitFor();
 await page.getByRole('dialog').getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.getByRole('button',{name:'Regresar',exact:true}).click();
 await page.getByRole('button',{name:'Exportar a Excel',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Votos emitidos',exact:true}).click();
 await page.getByRole('dialog').getByRole('alert').waitFor();
 assert.deepEqual(errors,[]);
 const result={status:'PASS',checks:['archive_error_visible_inside_dialog','export_error_visible_inside_dialog'],productionWrites:0};
 fs.writeFileSync(path.join(out,'dialog-errors.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e.message);process.exitCode=1;});`;
const run=new Module(file,module);run.filename=file;run.paths=module.paths;run._compile(setup+tail,file);
