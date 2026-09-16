### Código HTML de la Pantalla A
```html
<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Votaciones · Inicio (afiliado)</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="[https://fonts.gstatic.com](https://fonts.gstatic.com)" crossorigin>
<link href="[https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Spline+Sans+Mono:wght@400;600&display=swap](https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Spline+Sans+Mono:wght@400;600&display=swap)" rel="stylesheet">
<style>
:root{--guinda:#910022;--guinda-50:#fbeef1;--grad-guinda:linear-gradient(150deg,#e8364f 0%,#c41230 42%,#910022 100%);--ink:#14213d;--ink-2:#5a6378;--ink-3:#97a0b3;--surface:#fff;--surface-2:#eef1f6;--line:rgba(20,33,61,.09);--neo-sm:0 6px 16px -8px rgba(20,33,61,.16),0 2px 5px rgba(20,33,61,.05);--neo-md:0 14px 30px -12px rgba(20,33,61,.2),0 4px 10px -2px rgba(20,33,61,.06);--ok:#13794A;--ok-bg:#E7F6ED;--no:#B3261E;--no-bg:#FDECEA;--abs-bg:#EDEFF3;--font:'Nunito',system-ui,sans-serif;--mono:'Spline Sans Mono',ui-monospace,monospace}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{margin:0;font-family:var(--font);background:#d9dee8;color:var(--ink);display:grid;place-items:start center;min-height:100dvh;padding:24px 0}
.phone{width:430px;max-width:100%;background:#f2f3f5;border-radius:30px;overflow:hidden;box-shadow:0 40px 90px -30px rgba(20,33,61,.5);padding:20px 0 28px}
.wrap{padding:0 20px}
.shead{display:flex;align-items:center;gap:8px;margin:0 0 12px}
.shead .ico{width:26px;height:26px;border-radius:8px;background:var(--guinda-50);color:var(--guinda);display:grid;place-items:center}
.shead h2{font-size:16.5px;font-weight:800;letter-spacing:-.01em;margin:0}
.card{background:var(--surface);border-radius:24px;box-shadow:var(--neo-md);overflow:hidden}
.head{display:block;width:100%;text-align:left;border:none;cursor:pointer;font-family:inherit;background:var(--grad-guinda);color:#fff;padding:16px 18px 15px;position:relative;overflow:hidden}
.seal{position:absolute;right:-26px;top:-22px;opacity:.13}
.rel{position:relative}
.state{display:inline-flex;align-items:center;gap:5px;background:#fff;color:var(--guinda);padding:4px 10px;border-radius:999px;font-size:10.5px;font-weight:800;letter-spacing:.06em}
.state.closed{background:rgba(255,255,255,.18);color:#fff}
.hrow{display:flex;align-items:flex-end;gap:12px}
.htitle{font-size:18px;font-weight:800;letter-spacing:-.02em;margin-top:9px;line-height:1.22;text-wrap:pretty}
.hsub{font-size:12px;font-weight:600;opacity:.82;margin-top:2px}
.hhint{font-size:12px;font-weight:700;opacity:.9;margin-top:7px}
.chev{flex-shrink:0;width:32px;height:32px;border-radius:999px;background:rgba(255,255,255,.18);display:grid;place-items:center;transition:transform .22s cubic-bezier(.2,0,0,1)}
.head[aria-expanded="true"] .chev{transform:rotate(180deg)}
.avance{display:flex;align-items:center;gap:9px;margin-top:12px}
.segs{display:flex;gap:4px;flex:1}
.segs i{flex:1;height:5px;border-radius:999px;background:rgba(255,255,255,.28)}
.segs i.on{background:#fff}
.acount{font-size:11.5px;font-weight:800;opacity:.9;font-variant-numeric:tabular-nums}
.body{padding:0 18px 16px;display:flex;flex-direction:column;gap:16px;margin-top:16px}
.body[hidden]{display:none}
.q{padding:16px 0 0;border-top:1px solid var(--line)}
.qtop{display:flex;gap:10px}
.qnum{flex-shrink:0;width:24px;height:24px;border-radius:8px;background:var(--guinda-50);color:var(--guinda);display:grid;place-items:center;font-size:12.5px;font-weight:800;margin-top:1px}
.qnum.voted{background:var(--ok-bg);color:var(--ok)}
.qtext{font-size:14.5px;font-weight:800;line-height:1.3;text-wrap:pretty}
.qdet{font-size:12px;font-weight:500;color:var(--ink-3);line-height:1.4;margin-top:3px;text-wrap:pretty}
.opts{display:flex;gap:8px;margin-top:12px}
.opt{flex:1;min-width:0;min-height:52px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:none;cursor:pointer;font-family:inherit;border-radius:15px;background:var(--surface);box-shadow:var(--neo-sm);padding:8px 4px;transition:transform .16s cubic-bezier(.2,.7,.3,1)}
.opt:active{transform:scale(.975)}
.opt span{font-size:12px;font-weight:800;letter-spacing:-.01em}
.opt.si{color:var(--ok)}.opt.no{color:var(--no)}.opt.abs{color:var(--ink-2)}
.res{margin-top:12px}
.mine{display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:999px;font-size:12px;font-weight:800}
.mine.si{background:var(--ok-bg);color:var(--ok)}.mine.no{background:var(--no-bg);color:var(--no)}.mine.abs{background:var(--abs-bg);color:var(--ink-2)}
.folio{font-size:11.5px;font-weight:600;color:var(--ink-3);font-family:var(--mono)}
.bars{display:flex;flex-direction:column;gap:9px}
.brow>div{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px}
.blabel{font-size:12.5px;font-weight:700;color:var(--ink-2)}
.blabel.on{color:var(--ink)}
.bpct{font-size:12.5px;font-weight:800;font-variant-numeric:tabular-nums}
.bpct em{font-size:11.5px;font-weight:600;color:var(--ink-3);margin-left:6px;font-style:normal}
.track{display:block;height:7px;border-radius:999px;background:var(--abs-bg);overflow:hidden}
.fill{display:block;height:100%;border-radius:999px;transform:scaleX(0);transform-origin:left center;transition:transform .32s cubic-bezier(.2,0,0,1)}
.total{font-size:11.5px;font-weight:600;color:var(--ink-3);margin-top:10px}
.foot{display:flex;gap:8px;align-items:flex-start;font-size:11.5px;font-weight:600;color:var(--ink-3);line-height:1.45;border-top:1px solid var(--line);padding-top:13px}
.backdrop{position:fixed;inset:0;background:rgba(20,33,61,.42);backdrop-filter:blur(3px);opacity:0;pointer-events:none;transition:opacity .22s}
.backdrop.open{opacity:1;pointer-events:auto}
.sheet{position:fixed;left:0;right:0;bottom:0;background:var(--surface);border-radius:26px 26px 0 0;padding:10px 20px calc(20px + env(safe-area-inset-bottom));transform:translateY(100%);transition:transform .32s cubic-bezier(.32,.72,0,1);max-width:430px;margin:0 auto}
.backdrop.open .sheet{transform:none}
.grab{width:42px;height:4px;border-radius:999px;background:var(--surface-2);margin:2px auto 14px}
.stitle{font-size:16.5px;font-weight:800;margin:0 0 14px}
.kicker{font-size:12px;font-weight:700;color:var(--ink-3);letter-spacing:.02em}
.pick{display:flex;align-items:center;gap:11px;border-radius:18px;padding:14px 16px;margin:16px 0 12px}
.pick .big{font-size:19px;font-weight:800;letter-spacing:-.01em}
.pick .lil{font-size:11.5px;font-weight:700;opacity:.8}
.warn{display:flex;gap:8px;align-items:flex-start;font-size:12px;font-weight:600;color:var(--ink-3);line-height:1.45;margin-bottom:16px}
.btns{display:flex;gap:10px}
.btn{height:52px;border:none;border-radius:15px;font-family:inherit;font-size:15px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:9px}
.btn.sec{background:var(--surface-2);color:var(--ink);flex:1}
.btn.pri{background:var(--grad-guinda);color:#fff;box-shadow:0 10px 26px -6px rgba(209,31,58,.55);flex:1.4}
.toast{position:fixed;left:50%;bottom:26px;transform:translate(-50%,20px);background:var(--ink);color:#fff;font-size:13.5px;font-weight:700;padding:12px 18px;border-radius:14px;opacity:0;transition:opacity .2s,transform .2s;pointer-events:none}
.toast.on{opacity:1;transform:translate(-50%,0)}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style></head>
<body>
<div class="phone"><div class="wrap">
  <div class="shead"><div class="ico"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="10" width="17" height="10.5" rx="2"/><path d="M8 10V4.5h8V10"/><path d="M10.5 7h3"/><path d="M9.5 14.5h5"/></svg></div><h2>Votaciones</h2></div>
  <div class="card">
    <button class="head" id="head" aria-expanded="false" aria-controls="body">
      <span class="seal"><svg width="130" height="130" viewBox="0 0 100 100" fill="none" stroke="#fff" stroke-width="2"><circle cx="50" cy="50" r="46"/><circle cx="50" cy="50" r="38"/><path d="M50 18v64M18 50h64"/></svg></span>
      <span class="rel" style="display:block">
        <span class="state" id="state"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg> VOTACIÓN ABIERTA</span>
        <span class="hrow">
          <span style="flex:1;min-width:0;display:block">
            <span class="htitle" style="display:block">Asamblea General Extraordinaria</span>
            <span class="hsub" style="display:block">Cierra el 30 de septiembre · 3,184 afiliados convocados</span>
            <span class="hhint" style="display:block" id="hint">Toca para votar · 3 preguntas por responder</span>
          </span>
          <span class="chev"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 9 7 7 7-7"/></svg></span>
        </span>
        <span class="avance"><span class="segs" id="segs"></span><span class="acount" id="acount">0 de 3</span></span>
      </span>
    </button>
    <div class="body" id="body" hidden></div>
  </div>
</div></div>
<div class="backdrop" id="bd"><div class="sheet" id="sheet"></div></div>
<div class="toast" id="toast"></div>
<script>
const $=id=>document.getElementById(id);
const OPS=[{id:'si',label:'Sí',cls:'si',icon:'<path d="m5 12.5 4.5 4.5L19 7"/>'},{id:'no',label:'No',cls:'no',icon:'<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>'},{id:'abs',label:'Abstención',cls:'abs',icon:'<path d="M6 12h12"/>'}];
const COL={si:'#13794A',no:'#B3261E',abs:'#5a6378'};
const PREGUNTAS=[
 {id:'p1',texto:'Voto por los cambios estatutarios',detalle:'Reforma a los artículos 12, 34 y 51 del Estatuto General presentada en la asamblea.',base:{si:1142,no:386,abs:97}},
 {id:'p2',texto:'Voto reglamento para elecciones del nuevo comité ejecutivo',detalle:'Reglamento que norma convocatoria, planillas, urnas y cómputo de la elección.',base:{si:1268,no:241,abs:116}},
 {id:'p3',texto:'Cambio del porcentaje de préstamo de caja de ahorro del 4% al 3%',detalle:'Reducción de la tasa mensual de los préstamos de la caja de ahorro.',base:{si:1397,no:158,abs:70}}];
const PADRON=3184, ABIERTA=true;
const votos=JSON.parse(localStorage.getItem('demo.voto')||'{}');
const svg=(d,s)=>'<svg width="'+(s||19)+'" height="'+(s||19)+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg>';
const nf=n=>Number(n).toLocaleString('es-MX');
const conteo=p=>{const c={...p.base};const v=votos[p.id];if(v)c[v.opcion]++;const t=c.si+c.no+c.abs;return{total:t,part:Math.round(t/PADRON*100),filas:OPS.map(o=>({...o,votos:c[o.id],pct:Math.round(c[o.id]/t*100)}))}};
function render(){
  const head=$('head'),body=$('body'),segs=$('segs'),acount=$('acount'),hint=$('hint');
  const n=PREGUNTAS.filter(p=>votos[p.id]).length, faltan=PREGUNTAS.length-n, open=head.getAttribute('aria-expanded')==='true';
  segs.innerHTML=PREGUNTAS.map((_,i)=>'<i class="'+(i<n?'on':'')+'"></i>').join('');
  acount.textContent=n+' de '+PREGUNTAS.length;
  hint.textContent=open?'Ocultar las preguntas':(faltan===0?'Ver tus votos y el conteo':'Toca para votar · '+faltan+' pregunta'+(faltan===1?'':'s')+' por responder');
  body.innerHTML=PREGUNTAS.map((p,i)=>{
    const v=votos[p.id];
    let inner;
    if(v){const k=conteo(p),o=OPS.find(x=>x.id===v.opcion);
      inner='<div class="res"><div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap"><span class="mine '+o.cls+'">'+svg('<circle cx="12" cy="12" r="9"/><path d="m8 12 2.8 2.8L16 9.5"/>',14)+' Tu voto: '+o.label+'</span><span class="folio">'+v.folio+'</span></div><div class="bars">'
        +k.filas.map(f=>'<div class="brow"><div><span class="blabel '+(f.id===v.opcion?'on':'')+'">'+f.label+'</span><span class="bpct">'+f.pct+'%<em>'+nf(f.votos)+'</em></span></div><span class="track"><span class="fill" data-pct="'+f.pct+'" style="background:'+COL[f.id]+'"></span></span></div>').join('')
        +'</div><div class="total">'+nf(k.total)+' votos · '+k.part+'% del padrón</div></div>';
    } else if(!ABIERTA){ inner='<div style="font-size:12.5px;font-weight:700;color:var(--ink-3);margin-top:12px">No votaste esta pregunta y la consulta ya cerró.</div>'; }
    else { inner='<div class="opts">'+OPS.map(o=>'<button class="opt '+o.cls+'" data-q="'+p.id+'" data-o="'+o.id+'">'+svg(o.icon)+'<span>'+o.label+'</span></button>').join('')+'</div>'; }
    return '<div class="q"><div class="qtop"><span class="qnum '+(v?'voted':'')+'">'+(i+1)+'</span><div style="flex:1;min-width:0"><div class="qtext">'+p.texto+'</div><div class="qdet">'+p.detalle+'</div></div></div>'+inner+'</div>';
  }).join('')
  +'<div class="foot">'+svg('<path d="M12 3 4.5 6v5.5c0 4.6 3.1 7.8 7.5 9 4.4-1.2 7.5-4.4 7.5-9V6L12 3Z"/><path d="m8.8 12 2.2 2.2 4.2-4.4"/>',14)+'<span>'+(faltan===0?'Ya votaste las '+PREGUNTAS.length+' preguntas. Tu voto quedó registrado con folio y es secreto.':'Tu voto es secreto: el conteo de cada pregunta se revela cuando emites el tuyo.')+'</span></div>';
  requestAnimationFrame(()=>body.querySelectorAll('.fill').forEach(f=>{f.style.transform='scaleX('+Math.max(f.dataset.pct,1.5)/100+')'}));
}
$('head').onclick=()=>{const head=$('head'),body=$('body');const open=head.getAttribute('aria-expanded')==='true';head.setAttribute('aria-expanded',!open);body.hidden=open;render();
  if(!open){body.animate([{opacity:0,transform:'translateY(-8px)'},{opacity:1,transform:'none'}],{duration:320,easing:'cubic-bezier(.2,0,0,1)'})}};
$('body').onclick=e=>{const b=e.target.closest('.opt');if(b)confirmar(PREGUNTAS.find(p=>p.id===b.dataset.q),OPS.find(o=>o.id===b.dataset.o))};
function confirmar(p,o){
  const sheet=$('sheet'),bd=$('bd');
  sheet.innerHTML='<div class="grab"></div><h3 class="stitle">Confirma tu voto</h3><div class="kicker">PREGUNTA '+(PREGUNTAS.indexOf(p)+1)+'</div>'
   +'<div style="font-size:16px;font-weight:800;line-height:1.3;margin-top:4px;text-wrap:pretty">'+p.texto+'</div>'
   +'<div class="pick mine '+o.cls+'">'+svg(o.icon,24)+'<div><div class="lil">Vas a votar</div><div class="big">'+o.label+'</div></div></div>'
   +'<div class="warn">'+svg('<path d="M12 3 4.5 6v5.5c0 4.6 3.1 7.8 7.5 9 4.4-1.2 7.5-4.4 7.5-9V6L12 3Z"/>',15)+'<span>Tu voto es secreto y definitivo: una vez emitido no podrás cambiarlo.</span></div>'
   +'<div class="btns"><button class="btn sec" id="cancel">Cancelar</button><button class="btn pri" id="ok">'+svg('<circle cx="12" cy="12" r="9"/><path d="m8 12 2.8 2.8L16 9.5"/>')+'Confirmar voto</button></div>';
  bd.classList.add('open');
  $('cancel').onclick=cerrar;
  $('ok').onclick=()=>{const ts=Date.now();votos[p.id]={opcion:o.id,ts,folio:'V-2026-'+p.id.toUpperCase()+'-'+String(ts).slice(-5)};
    localStorage.setItem('demo.voto',JSON.stringify(votos));cerrar();render();aviso('Voto registrado · folio '+votos[p.id].folio)};
}
const cerrar=()=>$('bd').classList.remove('open');
$('bd').onclick=e=>{if(e.target===$('bd'))cerrar()};
function aviso(t){const toast=$('toast');toast.textContent=t;toast.classList.add('on');setTimeout(()=>toast.classList.remove('on'),2600)}
render();
</script>
</body></html>
```
---
## 4. Pantalla B — Módulo «Votaciones» del Panel Administrativo
**Dos vistas:** lista de consultas → editor de consulta. Cabecera guinda con flecha
de regreso, título y subtítulo derivado («1 consulta · 1 abierta»).
**Lista:** botón «Nueva consulta»; por cada consulta una tarjeta con título, línea
derivada («3 preguntas · 1,626 votos · cierra 2026-09-30»), chips de estado
(Abierta/Cerrada · Oculta · audiencia) y a la derecha: exportar, duplicar e
interruptor de publicada. Tocar la tarjeta abre el editor.
**Editor, en este orden:** 1 datos de la consulta (título, fecha de cierre, padrón) ·
2 interruptor «Publicada» · 3 **Preguntas** (agregar, editar en hoja, reordenar con
↑/↓, eliminar; cada fila muestra su conteo derivado) · 4 **Quién puede ver esta
votación**: cuatro modos — Todos · Solo registrados · Segmentado (chips de cargo, tipo
de sindicato y nivel) · **Solo estas personas** (campo de correos) · 5 exportar a
Excel · 6 eliminar consulta · 7 barra fija inferior Cancelar / Guardar.
**Campo de correos:** input + botón «Agregar»; Enter también agrega; se pueden pegar
varios separados por coma, punto y coma o espacio; valida formato, evita duplicados,
cada correo es un chip con botón de quitar de 24 px, y el contador dice «N personas
autorizadas» o «Sin correos: nadie verá la votación todavía».
### Código HTML de la Pantalla B
```html
<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Panel · Votaciones (administración)</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="[https://fonts.gstatic.com](https://fonts.gstatic.com)" crossorigin>
<link href="[https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap](https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap)" rel="stylesheet">
<style>
:root{--guinda:#910022;--guinda-50:#fbeef1;--guinda-100:#f3d6de;--grad-guinda:linear-gradient(150deg,#e8364f 0%,#c41230 42%,#910022 100%);--ink:#14213d;--ink-2:#5a6378;--ink-3:#97a0b3;--surface:#fff;--surface-2:#eef1f6;--hairline:#e6eaf1;--neo-sm:0 6px 16px -8px rgba(20,33,61,.16),0 2px 5px rgba(20,33,61,.05);--neo-inset:inset 2px 2px 5px rgba(170,182,204,.3),inset -2px -2px 5px rgba(255,255,255,.9);--glow:0 10px 26px -6px rgba(209,31,58,.55);--ok:#13794A;--ok-bg:#E7F6ED;--bad:#C0341D;--bad-bg:#FDEAEA;--font:'Nunito',system-ui,sans-serif}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{margin:0;font-family:var(--font);background:#d9dee8;color:var(--ink);display:grid;place-items:start center;min-height:100dvh;padding:24px 0}
.phone{width:430px;max-width:100%;background:#f2f3f5;border-radius:30px;overflow:hidden;box-shadow:0 40px 90px -30px rgba(20,33,61,.5);display:flex;flex-direction:column;height:900px}
.top{background:var(--grad-guinda);color:#fff;padding:16px 18px;display:flex;align-items:center;gap:12px;flex-shrink:0}
.top .back{width:36px;height:36px;border-radius:11px;border:none;background:rgba(255,255,255,.18);color:#fff;display:grid;place-items:center;cursor:pointer}
.top>div{flex:1;min-width:0}
.top h1{font-size:18px;font-weight:800;letter-spacing:-.02em;margin:0;line-height:1.18}
.top .sub{font-size:11.5px;font-weight:600;opacity:.85;margin-top:2px}
.scroll{flex:1;overflow:auto;padding:16px 16px 26px;scrollbar-width:none}
.scroll::-webkit-scrollbar{width:0}
.stitle{display:flex;align-items:center;gap:8px;margin:18px 0 12px}
.stitle .ico{width:26px;height:26px;border-radius:8px;background:var(--guinda-50);color:var(--guinda);display:grid;place-items:center;flex-shrink:0}
.stitle b{font-size:13.5px;font-weight:800;display:block}
.stitle s{font-size:11.5px;font-weight:600;color:var(--ink-3);text-decoration:none;display:block;margin-top:1px}
.btn{height:52px;border:none;border-radius:15px;font-family:inherit;font-size:15px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:9px;width:100%}
.btn.pri{background:var(--grad-guinda);color:#fff;box-shadow:var(--glow)}
.btn.sec{background:var(--surface-2);color:var(--ink)}
.btn.out{background:transparent;color:var(--ink-2);box-shadow:inset 0 0 0 1.5px var(--hairline)}
.btn[disabled]{opacity:.55;cursor:default}
.btn.sm{height:44px;font-size:14px;width:auto;padding:0 16px}
.card{background:var(--surface);border-radius:18px;box-shadow:var(--neo-sm);padding:15px;cursor:pointer;display:flex;gap:12px;align-items:flex-start}
.card+.card{margin-top:12px}
.card h3{font-size:15px;font-weight:800;margin:0;line-height:1.25;text-wrap:pretty}
.card .meta{font-size:12px;font-weight:600;color:var(--ink-3);margin-top:3px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.chip{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:999px;background:var(--surface-2);color:var(--ink-3)}
.chip.ok{background:var(--ok-bg);color:var(--ok)}.chip.bad{background:var(--bad-bg);color:var(--bad)}
.icobtn{width:36px;height:36px;border-radius:11px;border:none;background:var(--surface-2);color:var(--ink-2);display:grid;place-items:center;cursor:pointer;flex-shrink:0}
.icobtn.sm{width:32px;height:32px;border-radius:10px}
.icobtn[disabled]{color:#c4cad6;cursor:default}
.tog{width:46px;height:28px;border-radius:999px;border:none;background:var(--surface-2);position:relative;cursor:pointer;flex-shrink:0;transition:background .22s}
.tog[aria-checked="true"]{background:var(--guinda);box-shadow:var(--glow)}
.tog i{position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:999px;background:#fff;box-shadow:0 2px 6px rgba(20,33,61,.25);transition:transform .22s cubic-bezier(.34,1.56,.64,1)}
.tog[aria-checked="true"] i{transform:translateX(18px)}
.field{width:100%;border:none;outline:none;background:var(--surface-2);box-shadow:var(--neo-inset);border-radius:13px;padding:13px 14px;font-size:14.5px;font-family:inherit;color:var(--ink)}
.field:focus-visible{box-shadow:0 0 0 3px var(--guinda-100)}
.field.err{box-shadow:inset 0 0 0 1.5px var(--bad)}
.lab{font-size:11.5px;font-weight:800;color:var(--ink-3);margin-bottom:5px;display:block}
.row2{display:flex;gap:10px}
.panel{background:var(--surface);border-radius:16px;padding:15px;box-shadow:var(--neo-sm)}
.switchrow{display:flex;align-items:center;gap:12px;background:var(--surface);border-radius:16px;padding:14px 15px;box-shadow:var(--neo-sm);margin-top:12px}
.switchrow b{font-size:14.5px;font-weight:800;display:block}
.switchrow s{font-size:12px;font-weight:600;color:var(--ink-3);text-decoration:none;display:block;margin-top:2px}
.qrow{display:flex;gap:11px;align-items:flex-start;background:var(--surface);border-radius:15px;box-shadow:var(--neo-sm);padding:13px;cursor:pointer}
.qrow+.qrow{margin-top:10px}
.qnum{flex-shrink:0;width:24px;height:24px;border-radius:8px;background:var(--guinda-50);color:var(--guinda);display:grid;place-items:center;font-size:12.5px;font-weight:800;margin-top:1px}
.qrow b{font-size:14px;font-weight:800;line-height:1.3;display:block;text-wrap:pretty}
.qrow s{font-size:11.5px;font-weight:600;color:var(--ink-3);text-decoration:none;display:block;margin-top:3px;line-height:1.4}
.qrow .count{font-size:11.5px;font-weight:700;color:var(--ink-3);margin-top:6px;font-variant-numeric:tabular-nums}
.mode{display:flex;align-items:center;gap:12px;text-align:left;width:100%;border:none;cursor:pointer;font-family:inherit;background:var(--surface);border-radius:14px;padding:13px 14px;box-shadow:var(--neo-sm)}
.mode+.mode{margin-top:8px}
.mode[aria-pressed="true"]{box-shadow:var(--glow)}
.mode .ico{width:34px;height:34px;border-radius:11px;background:var(--surface-2);color:var(--ink-3);display:grid;place-items:center;flex-shrink:0}
.mode[aria-pressed="true"] .ico{background:var(--guinda);color:#fff}
.mode b{font-size:14px;font-weight:800;display:block}
.mode s{font-size:11.5px;font-weight:600;color:var(--ink-3);text-decoration:none;display:block;margin-top:1px}
.tag{border:none;cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;padding:8px 12px;border-radius:999px;background:var(--surface);color:var(--ink-2);box-shadow:var(--neo-sm)}
.tag[aria-pressed="true"]{background:var(--guinda);color:#fff;box-shadow:var(--glow)}
.mail{display:inline-flex;align-items:center;gap:6px;background:var(--surface-2);color:var(--ink-2);border-radius:999px;padding:6px 6px 6px 12px;font-size:12px;font-weight:700;max-width:100%}
.mail span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mail button{width:24px;height:24px;border-radius:999px;border:none;background:var(--surface);color:var(--ink-3);display:grid;place-items:center;cursor:pointer;flex-shrink:0}
.danger{display:inline-flex;align-items:center;gap:8px;height:46px;padding:0 18px;border-radius:13px;border:none;cursor:pointer;font-family:inherit;background:var(--bad-bg);color:var(--bad);font-size:14px;font-weight:800;margin-top:20px}
.bar{display:flex;gap:12px;padding:12px 16px;background:var(--surface);border-top:1px solid var(--hairline);flex-shrink:0}
.backdrop{position:fixed;inset:0;background:rgba(20,33,61,.42);backdrop-filter:blur(3px);opacity:0;pointer-events:none;transition:opacity .22s}
.backdrop.open{opacity:1;pointer-events:auto}
.sheet{position:fixed;left:0;right:0;bottom:0;max-width:430px;margin:0 auto;background:var(--surface);border-radius:26px 26px 0 0;padding:10px 20px calc(20px + env(safe-area-inset-bottom));transform:translateY(100%);transition:transform .32s cubic-bezier(.32,.72,0,1)}
.backdrop.open .sheet{transform:none}
.grab{width:42px;height:4px;border-radius:999px;background:var(--surface-2);margin:2px auto 14px}
.toast{position:fixed;left:50%;bottom:26px;transform:translate(-50%,20px);background:var(--ink);color:#fff;font-size:13.5px;font-weight:700;padding:12px 18px;border-radius:14px;opacity:0;transition:opacity .2s,transform .2s;pointer-events:none}
.toast.on{opacity:1;transform:translate(-50%,0)}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style></head>
<body>
<div class="phone">
  <div class="top"><button class="back" id="back" aria-label="Regresar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12H5"/><path d="m11 6-6 6 6 6"/></svg></button><div><h1 id="ttl">Votaciones</h1><div class="sub" id="tsub">1 consulta · 1 abierta</div></div></div>
  <div class="scroll" id="scroll"></div>
  <div class="bar" id="bar" hidden></div>
</div>
<div class="backdrop" id="bd"><div class="sheet" id="sheet"></div></div>
<div class="toast" id="toast"></div>
<script>
const $=id=>document.getElementById(id);
const ICO={ballot:'<rect x="3.5" y="10" width="17" height="10.5" rx="2"/><path d="M8 10V4.5h8V10"/><path d="M10.5 7h3"/><path d="M9.5 14.5h5"/>',menu:'<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',users:'<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.6-3.3 2.9-5 5.5-5s4.9 1.7 5.5 5"/><path d="M16 6.2a3 3 0 0 1 0 5.6"/><path d="M17.5 14c2 .5 3.4 2.1 3.9 4.5"/>',download:'<path d="M12 3v11"/><path d="m7.5 10 4.5 4.5L16.5 10"/><path d="M4 19h16"/>',copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',trash:'<path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/>',plus:'<path d="M12 5v14"/><path d="M5 12h14"/>',check:'<path d="m5 12.5 4.5 4.5L19 7"/>',chevU:'<path d="m5 15 7-7 7 7"/>',chevD:'<path d="m5 9 7 7 7-7"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',lock:'<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',ban:'<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3Z"/>',user:'<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.7-4 3.6-6 7-6s6.3 2 7 6"/>',filter:'<path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z"/>',message:'<path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/>',close:'<path d="m6 6 12 12"/><path d="m18 6-12 12"/>',shield:'<path d="M12 3 4.5 6v5.5c0 4.6 3.1 7.8 7.5 9 4.4-1.2 7.5-4.4 7.5-9V6L12 3Z"/>',finance:'<path d="M4 19V5"/><path d="M4 19h16"/><path d="m7.5 14 3-3.5 3 2 4-5.5"/>',doc:'<path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v5h5"/>',checkCircle:'<circle cx="12" cy="12" r="9"/><path d="m8 12 2.8 2.8L16 9.5"/>'};
const I=(n,s)=>'<svg width="'+(s||17)+'" height="'+(s||17)+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">'+ICO[n]+'</svg>';
const CARGOS=['Afiliado','Delegado','Comité Ejecutivo','Administrador'];
const SINDICATOS=['SUTISSSTESON','SUEISSSTESON','SITISSSTESON','EMPLEADOS DE CONFIANZA'];
const NIVELES=['Suplentes Variables','Suplentes Fijos','Eventuales','Base','Confianza','Jubilados y Pens.'];
const MODES=[{v:'all',l:'Todos',i:'globe',d:'Cualquier persona que abra la app'},{v:'registered',l:'Solo registrados',i:'user',d:'Usuarios con sesión iniciada'},{v:'segment',l:'Segmentado',i:'filter',d:'Por cargo, sindicato y nivel'},{v:'emails',l:'Solo estas personas',i:'message',d:'Lista de correos autorizados'}];
let consultas=[{id:'asamblea-ext-2026',titulo:'Asamblea General Extraordinaria',cierre:'2026-09-30',padron:3184,visible:true,audience:{mode:'all',cargos:[],sindicatos:[],niveles:[],emails:[]},preguntas:[
 {id:'p1',texto:'Voto por los cambios estatutarios',detalle:'Reforma a los artículos 12, 34 y 51 del Estatuto General.',base:{si:1142,no:386,abs:97}},
 {id:'p2',texto:'Voto reglamento para elecciones del nuevo comité ejecutivo',detalle:'Convocatoria, planillas, urnas y cómputo.',base:{si:1268,no:241,abs:116}},
 {id:'p3',texto:'Cambio del porcentaje de préstamo de caja de ahorro del 4% al 3%',detalle:'Reducción de la tasa mensual.',base:{si:1397,no:158,abs:70}}]}];
let vista='lista', draft=null, qDraft=null;
const nf=n=>Number(n||0).toLocaleString('es-MX');
const abierta=c=>c.visible!==false&&new Date(c.cierre+'T23:59:00')>=new Date();
const conteo=p=>{const b=p.base||{si:0,no:0,abs:0},t=b.si+b.no+b.abs;return{total:t,pct:[b.si,b.no,b.abs].map(v=>t?Math.round(v/t*100):0)}};
const audLabel=c=>c.audience.mode==='emails'?(c.audience.emails.length+' correo'+(c.audience.emails.length===1?'':'s')):({all:'Todos',registered:'Registrados',segment:'Segmentado'})[c.audience.mode];
const audIcon=c=>({all:'globe',registered:'user',segment:'filter',emails:'message'})[c.audience.mode];
const normMail=s=>String(s||'').trim().toLowerCase(), okMail=s=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normMail(s));
const uid=p=>p+Math.random().toString(36).slice(2,7);
function aviso(t){const toast=$('toast');toast.textContent=t;toast.classList.add('on');setTimeout(()=>toast.classList.remove('on'),2400)}
function render(){ vista==='lista'?renderLista():renderEditor(); }
function renderLista(){
  const ttl=$('ttl'),tsub=$('tsub'),bar=$('bar'),scroll=$('scroll');
  const ab=consultas.filter(abierta).length;
  ttl.textContent='Votaciones'; tsub.textContent=consultas.length+' consulta'+(consultas.length===1?'':'s')+' · '+ab+' abierta'+(ab===1?'':'s');
  bar.hidden=true;
  scroll.innerHTML='<button class="btn pri" id="nueva" style="margin-bottom:16px">'+I('plus',19)+'Nueva consulta</button>'
   +consultas.map(c=>{const votos=c.preguntas.reduce((a,p)=>a+conteo(p).total,0);return '<div class="card" data-id="'+c.id+'"><div style="flex:1;min-width:0"><h3>'+(c.titulo||'Consulta sin título')+'</h3><div class="meta">'+c.preguntas.length+' pregunta'+(c.preguntas.length===1?'':'s')+' · '+nf(votos)+' votos · cierra '+c.cierre+'</div><div class="chips">'
    +(abierta(c)?'<span class="chip ok">'+I('clock',12)+'Abierta</span>':'<span class="chip bad">'+I('lock',12)+'Cerrada</span>')
    +(c.visible===false?'<span class="chip bad">'+I('ban',12)+'Oculta</span>':'')
    +'<span class="chip">'+I(audIcon(c),12)+audLabel(c)+'</span></div></div>'
    +'<div style="display:flex;align-items:center;gap:6px"><button class="icobtn" data-exp="'+c.id+'" aria-label="Exportar a Excel">'+I('download')+'</button><button class="icobtn" data-dup="'+c.id+'" aria-label="Duplicar">'+I('copy')+'</button>'
    +'<button class="tog" role="switch" aria-checked="'+(c.visible!==false)+'" data-tog="'+c.id+'" aria-label="Publicada"><i></i></button></div></div>'}).join('');
  $('nueva').onclick=()=>{draft={id:uid('cons_'),titulo:'',cierre:'',padron:3184,visible:true,audience:{mode:'all',cargos:[],sindicatos:[],niveles:[],emails:[]},preguntas:[],nuevo:true};vista='editor';render()};
  scroll.onclick=e=>{
    const t=e.target.closest('[data-tog]'),x=e.target.closest('[data-exp]'),d=e.target.closest('[data-dup]'),c=e.target.closest('.card');
    if(t){const k=consultas.find(y=>y.id===t.dataset.tog);k.visible=k.visible===false;return render()}
    if(x){return aviso('Resultados exportados a Excel')}
    if(d){const s=consultas.find(y=>y.id===d.dataset.dup);consultas.push({...JSON.parse(JSON.stringify(s)),id:uid('cons_'),titulo:s.titulo+' (copia)',visible:false});return render()}
    if(c){draft=JSON.parse(JSON.stringify(consultas.find(y=>y.id===c.dataset.id)));vista='editor';render()}};
}
function renderEditor(){
  const d=draft, a=d.audience, ttl=$('ttl'), tsub=$('tsub'), bar=$('bar'), scroll=$('scroll');
  ttl.textContent=d.nuevo?'Nueva consulta':'Editar consulta';
  tsub.textContent=d.preguntas.length+' pregunta'+(d.preguntas.length===1?'':'s');
  const st=(ico,lab,sub)=>'<div class="stitle"><div class="ico">'+I(ico,15)+'</div><div><b>'+lab+'</b>'+(sub?'<s>'+sub+'</s>':'')+'</div></div>';
  const tags=(lab,opts,sel,key)=>'<div style="margin-bottom:14px"><div style="font-size:12px;font-weight:800;color:var(--ink-2);margin-bottom:8px">'+lab+'</div><div style="display:flex;flex-wrap:wrap;gap:7px">'+opts.map(o=>'<button class="tag" aria-pressed="'+(sel.indexOf(o)>-1)+'" data-tag="'+key+'" data-val="'+o+'">'+o+'</button>').join('')+'</div></div>';
  scroll.innerHTML=st('ballot','Datos de la consulta')
   +'<div style="display:flex;flex-direction:column;gap:10px"><input class="field" id="f_tit" placeholder="Título (p. ej. Asamblea General Extraordinaria)" value="'+(d.titulo||'')+'">'
   +'<div class="row2"><label style="flex:1"><span class="lab">CIERRA EL</span><input class="field" type="date" id="f_cie" value="'+(d.cierre||'')+'"></label>'
   +'<label style="flex:1"><span class="lab">PADRÓN CONVOCADO</span><input class="field" type="number" min="0" id="f_pad" value="'+d.padron+'"></label></div></div>'
   +'<div class="switchrow"><div style="flex:1"><b>'+(d.visible===false?'No publicada':'Publicada')+'</b><s>'+(d.visible===false?'No aparece en Inicio':'Aparece en Inicio según sus reglas de acceso')+'</s></div><button class="tog" role="switch" aria-checked="'+(d.visible!==false)+'" id="t_vis" aria-label="Publicada"><i></i></button></div>'
   +st('menu','Preguntas','Se vota Sí · No · Abstención · los cambios se aplican al guardar la consulta')
   +(d.preguntas.length?d.preguntas.map((p,i)=>{const k=conteo(p);return '<div class="qrow" data-q="'+p.id+'"><span class="qnum">'+(i+1)+'</span><div style="flex:1;min-width:0"><b>'+(p.texto||'Pregunta sin texto')+'</b>'+(p.detalle?'<s>'+p.detalle+'</s>':'')+'<div class="count">'+(k.total?'Sí '+k.pct[0]+'% · No '+k.pct[1]+'% · Abs '+k.pct[2]+'% · '+nf(k.total)+' votos':'Sin votos todavía')+'</div></div><div style="display:flex;flex-direction:column;gap:6px"><button class="icobtn sm" data-mv="'+p.id+'" data-dir="-1" '+(i===0?'disabled':'')+' aria-label="Subir">'+I('chevU',16)+'</button><button class="icobtn sm" data-mv="'+p.id+'" data-dir="1" '+(i===d.preguntas.length-1?'disabled':'')+' aria-label="Bajar">'+I('chevD',16)+'</button></div><button class="icobtn sm" data-del="'+p.id+'" aria-label="Eliminar pregunta">'+I('trash',16)+'</button></div>'}).join(''):'<div style="font-size:12.5px;font-weight:600;color:var(--ink-3);background:var(--surface-2);border-radius:14px;padding:14px;line-height:1.45">Sin preguntas. Agrega la primera: es lo que verá el afiliado en Inicio.</div>')
   +'<button class="btn sec" id="addq" style="margin-top:12px">'+I('plus',19)+'Agregar pregunta</button>'
   +st('users','Quién puede ver esta votación','Mismo motor de segmentación del resto del panel')
   +MODES.map(m=>'<button class="mode" aria-pressed="'+(a.mode===m.v)+'" data-mode="'+m.v+'"><span class="ico">'+I(m.i)+'</span><span style="flex:1;min-width:0"><b>'+m.l+'</b><s>'+m.d+'</s></span>'+(a.mode===m.v?'<span style="color:var(--guinda)">'+I('checkCircle',20)+'</span>':'')+'</button>').join('')
   +(a.mode==='segment'?'<div class="panel" style="margin-top:12px"><div style="font-size:11.5px;font-weight:700;color:var(--ink-3);margin-bottom:12px;line-height:1.4">Deja un grupo vacío para no filtrar por ese criterio.</div>'+tags('Cargo en la aplicación',CARGOS,a.cargos,'cargos')+tags('Tipo de sindicato',SINDICATOS,a.sindicatos,'sindicatos')+tags('Nivel de usuario',NIVELES,a.niveles,'niveles')+'</div>':'')
   +(a.mode==='emails'?'<div class="panel" style="margin-top:12px"><div style="font-size:11.5px;font-weight:700;color:var(--ink-3);margin-bottom:10px;line-height:1.4">Sólo los correos de esta lista verán la votación en Inicio. Puedes pegar varios separados por coma.</div><div style="display:flex;gap:8px"><input class="field" id="f_mail" type="email" inputmode="email" autocapitalize="none" placeholder="nombre@correo.mx" style="flex:1"><button class="btn pri sm" id="addmail">'+I('plus',18)+'Agregar</button></div><div id="mailerr" style="font-size:11.5px;font-weight:700;color:var(--bad);margin-top:7px"></div><div style="font-size:11.5px;font-weight:800;color:var(--ink-3);margin:14px 0 8px">'+(a.emails.length?a.emails.length+' persona'+(a.emails.length===1?'':'s')+' autorizada'+(a.emails.length===1?'':'s'):'Sin correos: nadie verá la votación todavía')+'</div><div style="display:flex;flex-wrap:wrap;gap:7px">'+a.emails.map(m=>'<span class="mail"><span>'+m+'</span><button data-rm="'+m+'" aria-label="Quitar '+m+'">'+I('close',13)+'</button></span>').join('')+'</div></div>':'')
   +(d.nuevo?'':st('download','Exportar a Excel','Archivo .csv que Excel abre directo')+'<div style="display:flex;gap:10px"><button class="btn sec" id="exp1">'+I('finance',18)+'Resultados</button><button class="btn sec" id="exp2">'+I('doc',18)+'Votos emitidos</button></div>')
   +(d.nuevo?'':'<button class="danger" id="del">'+I('trash')+'Eliminar consulta</button>');
  const ok=!!d.titulo.trim()&&!!d.cierre;
  bar.hidden=false;
  bar.innerHTML='<button class="btn out" id="cancel" style="flex:1">Cancelar</button><button class="btn pri" id="save" style="flex:2" '+(ok?'':'disabled')+'>'+I('check',19)+(ok?'Guardar consulta':(!d.titulo.trim()?'Falta el título':'Falta la fecha de cierre'))+'</button>';
  $('f_tit').oninput=e=>{d.titulo=e.target.value;syncBar()};
  $('f_cie').onchange=e=>{d.cierre=e.target.value;syncBar()};
  $('f_pad').oninput=e=>{d.padron=parseInt(e.target.value||'0',10)};
  $('t_vis').onclick=()=>{d.visible=d.visible===false;render()};
  $('addq').onclick=()=>hoja({id:uid('p_'),texto:'',detalle:'',base:{si:0,no:0,abs:0}});
  if(!d.nuevo){$('exp1').onclick=()=>aviso('Resultados exportados');$('exp2').onclick=()=>aviso('Votos exportados');
    $('del').onclick=()=>{if(confirm('¿Eliminar esta consulta y sus votos?')){consultas=consultas.filter(c=>c.id!==d.id);vista='lista';render();aviso('Consulta eliminada')}}}
  $('cancel').onclick=()=>{vista='lista';render()};
  $('save').onclick=()=>{if(!ok)return;const i=consultas.findIndex(c=>c.id===d.id);delete d.nuevo;i>=0?consultas[i]=d:consultas.push(d);vista='lista';render();aviso('Consulta guardada')};
  scroll.onclick=e=>{
    const m=e.target.closest('[data-mode]'),g=e.target.closest('[data-tag]'),mv=e.target.closest('[data-mv]'),dl=e.target.closest('[data-del]'),q=e.target.closest('[data-q]'),rm=e.target.closest('[data-rm]');
    if(m){d.audience.mode=m.dataset.mode;return render()}
    if(g){const k=g.dataset.tag,v=g.dataset.val,l=d.audience[k];d.audience[k]=l.indexOf(v)>-1?l.filter(x=>x!==v):l.concat([v]);return render()}
    if(mv){const i=d.preguntas.findIndex(p=>p.id===mv.dataset.mv),j=i+ +mv.dataset.dir;if(j<0||j>=d.preguntas.length)return;d.preguntas.splice(j,0,d.preguntas.splice(i,1)[0]);return render()}
    if(dl){d.preguntas=d.preguntas.filter(p=>p.id!==dl.dataset.del);return render()}
    if(rm){d.audience.emails=d.audience.emails.filter(x=>x!==rm.dataset.rm);return render()}
    if(q){return hoja(JSON.parse(JSON.stringify(d.preguntas.find(p=>p.id===q.dataset.q))))}};
  if(a.mode==='emails'){
    const add=()=>{const partes=$('f_mail').value.split(/[,;\s]+/).map(normMail).filter(Boolean);
      if(!partes.length)return err('Escribe un correo.');
      const malo=partes.find(p=>!okMail(p)); if(malo)return err('Correo inválido: '+malo);
      const nuevos=partes.filter(p=>a.emails.indexOf(p)===-1);
      if(!nuevos.length)return err('Ese correo ya está en la lista.');
      a.emails=a.emails.concat(nuevos);render();$('f_mail').focus()};
    const err=t=>{$('mailerr').textContent=t;$('f_mail').classList.add('err')};
    $('addmail').onclick=add;
    $('f_mail').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();add()}};
    $('f_mail').oninput=()=>{$('mailerr').textContent='';$('f_mail').classList.remove('err')};
  }
  function syncBar(){const o=!!d.titulo.trim()&&!!d.cierre,save=$('save');save.disabled=!o;save.innerHTML=I('check',19)+(o?'Guardar consulta':(!d.titulo.trim()?'Falta el título':'Falta la fecha de cierre'))}
}
function hoja(p){
  qDraft=p;
  const ok=!!p.texto.trim(), sheet=$('sheet');
  sheet.innerHTML='<div class="grab"></div><h3 style="font-size:16.5px;font-weight:800;margin:0 0 14px">Pregunta de la votación</h3>'
   +'<span class="lab">PREGUNTA</span><textarea class="field" id="q_tx" rows="2" placeholder="Voto por los cambios estatutarios" style="resize:vertical;line-height:1.4">'+p.texto+'</textarea>'
   +'<span class="lab" style="margin-top:14px">EXPLICACIÓN (OPCIONAL)</span><textarea class="field" id="q_dt" rows="3" placeholder="Qué se está votando, en palabras claras." style="resize:vertical;line-height:1.4">'+(p.detalle||'')+'</textarea>'
   +'<div style="display:flex;align-items:center;gap:8px;font-size:11.5px;font-weight:600;color:var(--ink-3);margin:14px 0 16px;line-height:1.45">'+I('shield',15)+'<span>Las opciones son siempre Sí, No y Abstención, y el voto del afiliado es definitivo.</span></div>'
   +'<div style="display:flex;gap:10px"><button class="btn sec" id="q_cancel" style="flex:1">Cancelar</button><button class="btn pri" id="q_save" style="flex:1.4" '+(ok?'':'disabled')+'>'+I('check',19)+(ok?'Guardar pregunta':'Falta la pregunta')+'</button></div>';
  $('bd').classList.add('open');
  const sync=()=>{const o=!!qDraft.texto.trim(),q_save=$('q_save');q_save.disabled=!o;q_save.innerHTML=I('check',19)+(o?'Guardar pregunta':'Falta la pregunta')};
  $('q_tx').oninput=e=>{qDraft.texto=e.target.value;sync()};
  $('q_dt').oninput=e=>{qDraft.detalle=e.target.value};
  $('q_cancel').onclick=()=>$('bd').classList.remove('open');
  $('q_save').onclick=()=>{const i=draft.preguntas.findIndex(x=>x.id===qDraft.id);i>=0?draft.preguntas[i]=qDraft:draft.preguntas.push(qDraft);$('bd').classList.remove('open');render()};
}
$('bd').onclick=e=>{if(e.target===$('bd'))$('bd').classList.remove('open')};
$('back').onclick=()=>{vista='lista';render()};
render();
</script>
</body></html>