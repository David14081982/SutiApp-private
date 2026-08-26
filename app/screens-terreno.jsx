/* screens-terreno.jsx — SutiApp · "Suti Terreno"
   Pantalla interactiva de venta de lotes: El Fresnillo Reserva Campestre (Hermosillo, Sonora).
   Identidad campestre (café/arena/verde/ámbar) dentro de la línea gráfica Suti (Nunito, tarjetas, sombras).
   Mapa SVG desplazable (drag X/Y), lotes en perímetro, áreas comunes al centro, tarjeta de detalle. */
(function () {
  const { useState, useRef, useEffect, useCallback } = React;
  const I = window.Icon;

  // ---------- Paleta El Fresnillo (sub-marca, no global) ----------
  const F = {
    cafe: '#2a1f14', cafe2: '#3c2c1b', madera: '#5a3e28',
    bg: '#F0F3F4', arena: '#e8dfcd', arenaCard: '#f6f1e6', arenaLine: '#d8ccb2',
    verde: '#3B6D11', verdeMid: '#6FA033', verdeSoft: '#C0DD97', verdePal: '#D8E8BF',
    ambar: '#E7A23C', ambarSoft: '#FAC775', oro: '#BA7517', oroText: '#9a6b16',
    azul: '#185FA5', azulSoft: '#B5D4F4',
    gris: '#bcb4a4', grisText: '#6b6356',
    ink: '#2a1f14', ink2: '#6f6557'
  };

  // ---------- Geometría del mapa ----------
  const W = 690,H = 600,M = 14,DN = 48; // canvas, margin, depth norte/sur
  const ENT_X1 = 308,ENT_X2 = 382; // hueco de entrada (norte)

  // ---------- RNG sembrado (datos estables) ----------
  function mulberry32(a) {
    return function () {
      a |= 0;a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(20260531);
  const r10 = (n) => Math.round(n * 10) / 10;

  function makeLot(n, zona, x, y, w, h) {
    const m2 = 160 + Math.round(rng() * 80); // 160–240 m²
    const frente = 10 + Math.round(rng() * 4); // 10–14 m
    const fondo = 16 + Math.round(rng()); // 16–17 m
    const t = (m2 - 160) / 80;
    let precio = 890000 + t * 700000 + (rng() - 0.5) * 90000; // ligado al tamaño
    precio = Math.max(890000, Math.min(1590000, Math.round(precio / 10000) * 10000));
    const vendido = rng() < 0.11; // ~11% vendidos
    return { id: String(n).padStart(3, '0'), zona, x, y, w, h, m2, frente, fondo, precio, vendido };
  }

  const LOTS = [];
  let nLot = 1;
  // Norte — 14 lotes (7 antes / 7 después de la entrada)
  (function () {
    const y = M,h = DN;
    const segs = [[72, ENT_X1, 7], [ENT_X2, W - 72, 7]];
    segs.forEach(([x0, x1, c]) => {
      const w = (x1 - x0) / c;
      for (let i = 0; i < c; i++) LOTS.push(makeLot(nLot++, 'N', x0 + i * w + 1.6, y, w - 3.2, h));
    });
  })();
  // Sur — 16 lotes
  (function () {
    const y = H - M - DN,h = DN,x0 = 72,x1 = W - 72,c = 16,w = (x1 - x0) / c;
    for (let i = 0; i < c; i++) LOTS.push(makeLot(nLot++, 'S', x0 + i * w + 1.6, y, w - 3.2, h));
  })();
  // Oeste — 10 lotes
  (function () {
    const x = M,w = DN,y0 = 104,y1 = 496,c = 10,h = (y1 - y0) / c;
    for (let i = 0; i < c; i++) LOTS.push(makeLot(nLot++, 'W', x, y0 + i * h + 1.6, w, h - 3.2));
  })();
  // Este — 10 lotes
  (function () {
    const x = W - M - DN,w = DN,y0 = 104,y1 = 496,c = 10,h = (y1 - y0) / c;
    for (let i = 0; i < c; i++) LOTS.push(makeLot(nLot++, 'E', x, y0 + i * h + 1.6, w, h - 3.2));
  })();

  // ---------- Áreas comunes (centro) ----------
  const AREAS = [
  { x: 104, y: 100, w: 238, h: 184, fill: F.azulSoft, line: '#7FB2E0', label: 'Alberca', icon: 'waves', tc: '#0c4a82' },
  { x: 350, y: 100, w: 236, h: 184, fill: F.verdeSoft, line: '#9DC06B', label: 'Parque · Áreas verdes', icon: 'tree', tc: '#34571a' },
  { x: 104, y: 320, w: 146, h: 180, fill: F.verdePal, line: '#B6CE94', label: 'Jardines y senderos', icon: 'leaf', tc: '#3c5a23' },
  { x: 258, y: 320, w: 172, h: 180, fill: F.verdeMid, line: '#5C892B', label: 'Cancha multideportiva', icon: 'court', tc: '#fff' },
  { x: 438, y: 320, w: 148, h: 86, fill: F.ambarSoft, line: '#E6AE4F', label: 'Juegos infantiles', icon: 'play2', tc: '#7a4e0d' },
  { x: 438, y: 414, w: 148, h: 86, fill: 'transparent', line: F.madera, dashed: true, label: 'Salón de eventos', sub: '(próximamente)', icon: 'event', tc: F.madera }];


  // ---------- Calles ----------
  const STREETS = [
  { x: 60, y: 66, w: W - 120, h: 26, dir: 'h', name: 'Calle A' },
  { x: 60, y: 496, w: W - 120, h: 26, dir: 'h', name: 'Calle B' },
  { x: 100, y: 288, w: 490, h: 28, dir: 'h', name: 'Calle C' },
  { x: 66, y: 96, w: 28, h: 408, dir: 'v', name: 'Lateral Oeste' },
  { x: W - 94, y: 96, w: 28, h: 408, dir: 'v', name: 'Lateral Este' }];


  // mini iconos para áreas (trazo blanco/oscuro)
  const AREA_PATHS = {
    waves: '<path d="M2 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
    tree: '<path d="M12 3 7 11h3l-3 5h4v5h2v-5h4l-3-5h3L12 3Z"/>',
    leaf: '<path d="M5 19c0-8 6-13 14-14 0 8-5 14-14 14Z"/><path d="M5 19 14 10"/>',
    court: '<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><path d="M12 5v14"/><circle cx="12" cy="12" r="2.4"/>',
    play2: '<circle cx="8" cy="8" r="2.4"/><path d="M8 10v7"/><path d="m5 13 3-1 3 1"/><path d="m5 21 3-4 3 4"/><path d="M14 7h6v5h-6z"/>',
    event: '<path d="M5 8h14v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8Z"/><path d="M5 8l7-4 7 4"/>'
  };
  function AreaIcon({ name, size, color }) {
    const d = AREA_PATHS[name];if (!d) return null;
    return React.createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', dangerouslySetInnerHTML: { __html: d } });
  }

  // ---------- Billboards 3D (se "paran" sobre el plano inclinado) ----------
  const BILLBOARDS = [
    { type: 'tree', x: 398, y: 165, s: 1.05 }, { type: 'tree', x: 470, y: 205, s: 0.9 }, { type: 'tree', x: 542, y: 168, s: 1 },
    { type: 'tree', x: 150, y: 402, s: 0.95 }, { type: 'tree', x: 208, y: 448, s: 0.85 },
    { type: 'umbrella', x: 224, y: 205, s: 1 },
    { type: 'flag', x: 345, y: 40, s: 1.1 },
  ];
  const BB_SVG = {
    tree: '<ellipse cx="15" cy="40" rx="9" ry="2.4" fill="rgba(20,33,61,.18)"/><rect x="13.3" y="22" width="3.4" height="17" rx="1.6" fill="#8A5A2B"/><circle cx="15" cy="16" r="11" fill="#3f7d1c"/><circle cx="9.5" cy="20" r="7" fill="#4f9325"/><circle cx="20" cy="20" r="6.5" fill="#356a16"/>',
    umbrella: '<ellipse cx="15" cy="40" rx="8" ry="2.2" fill="rgba(20,33,61,.18)"/><rect x="14.2" y="16" width="1.8" height="23" fill="#7a4e0d"/><path d="M3 17a12 8 0 0 1 24 0Z" fill="#e8364f"/><path d="M3 17a12 8 0 0 1 24 0" fill="none" stroke="#fff" stroke-width="1"/><path d="M15 9v8M9 17q6-5 12 0M5.5 17q3.5-3 0 0" stroke="#fff" stroke-width="0.8" fill="none" opacity=".6"/>',
    flag: '<ellipse cx="9" cy="44" rx="7" ry="2.2" fill="rgba(20,33,61,.18)"/><rect x="8" y="6" width="2" height="38" rx="1" fill="#5a6378"/><path d="M10 7h17l-5 6 5 6H10Z" fill="#910022"/>',
  };
  function Billboard({ b }) {
    const w = 30 * b.s, h = (b.type === 'flag' ? 48 : 42) * b.s;
    return (
      <div style={{ position: 'absolute', left: b.x, top: b.y, width: w, height: h, marginLeft: -w / 2, marginTop: -h, transformOrigin: 'bottom center', transform: 'rotateX(-48deg)', pointerEvents: 'none' }}>
        <svg width={w} height={h} viewBox={`0 0 30 ${b.type === 'flag' ? 48 : 42}`} style={{ display: 'block', overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: BB_SVG[b.type] }} />
      </div>
    );
  }

  // ---------- Logo cactus saguaro + fresno ----------
  function FresLogo({ size = 42 }) {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        {/* fresno */}
        <circle cx="16" cy="15" r="10.5" fill="#5C7E2B" />
        <circle cx="10.5" cy="19" r="6.5" fill="#6E9636" />
        <rect x="14.4" y="22" width="3.2" height="16" rx="1.5" fill="#8A5A2B" />
        {/* saguaro */}
        <g fill="#2F6B12">
          <rect x="30.5" y="11" width="6.4" height="28" rx="3.2" />
          <rect x="24.6" y="25" width="4.8" height="11" rx="2.4" />
          <rect x="24.6" y="25" width="7.5" height="4.8" rx="2.4" />
          <rect x="38" y="19" width="4.8" height="13" rx="2.4" />
          <rect x="35.4" y="26" width="7.5" height="4.8" rx="2.4" />
        </g>
        <ellipse cx="33.5" cy="40.5" rx="11" ry="2.2" fill="#8A5A2B" opacity="0.45" />
      </svg>);

  }

  // ---------- helpers de color del lote ----------
  function lotFill(l, sel) {
    if (sel) return F.oro;
    if (l.vendido) return F.gris;
    if (l.zona === 'N') return F.verde;
    if (l.zona === 'S') return F.verdeMid;
    return F.ambar; // W / E
  }
  function lotTextColor(l, sel) {
    if (sel) return '#fff';
    if (l.vendido) return F.grisText;
    if (l.zona === 'E' || l.zona === 'W') return '#3a2a12';
    return '#fff';
  }
  const ZONA_LABEL = { N: 'Frente norte', S: 'Frente sur', W: 'Lateral oeste', E: 'Lateral este' };

  // ---------- Filtros ----------
  const FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'disp', label: 'Disponibles' },
  { id: 'vend', label: 'Vendidos' },
  { id: 'N', label: 'Frente norte' },
  { id: 'S', label: 'Frente sur' },
  { id: 'E', label: 'Lateral este' },
  { id: 'W', label: 'Lateral oeste' }];

  function matchFilter(l, f) {
    if (f === 'todos') return true;
    if (f === 'disp') return !l.vendido;
    if (f === 'vend') return l.vendido;
    return l.zona === f;
  }

  // ============================================================
  function TerrenoScreen({ app }) {
    const [filter, setFilter] = useState('todos');
    const [sel, setSel] = useState(null); // lot id
    const selLot = LOTS.find((l) => l.id === sel) || null;

    const shown = LOTS.filter((l) => matchFilter(l, filter));
    const disp = shown.filter((l) => !l.vendido).length;
    const vend = shown.filter((l) => l.vendido).length;

    // --- pan ---
    const vpRef = useRef(null);
    const [tf, setTf] = useState({ x: -150, y: 0 });
    const [dragging, setDragging] = useState(false);
    const [explored, setExplored] = useState(false);
    const [view3d, setView3d] = useState(true);
    const [z, setZ] = useState(1);
    const drag = useRef(null);
    const moved = useRef(false);

    const Z_MAX = 2.4;
    const fitZ = () => { const vp = vpRef.current; return vp ? Math.min(vp.clientWidth / W, vp.clientHeight / H) : 0.5; };
    const num = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    // clamp de paneo: centra cuando el contenido cabe, si no lo limita a los bordes
    const clamp = (v, vp, content) => content <= vp ? (vp - content) / 2 : Math.max(vp - content, Math.min(0, v));

    const recenter = useCallback(() => {
      const vp = vpRef.current;if (!vp) return;
      setTf({ x: clamp((vp.clientWidth - W * z) / 2, vp.clientWidth, W * z), y: clamp((vp.clientHeight - H * z) / 2, vp.clientHeight, H * z) });
    }, [z]);
    useEffect(() => {recenter();}, []); // encuadre inicial

    // centra suavemente el lote seleccionado en el viewport
    useEffect(() => {
      if (!sel) return;
      const vp = vpRef.current,l = LOTS.find((x) => x.id === sel);
      if (!vp || !l) return;
      setTf({
        x: clamp(vp.clientWidth / 2 - z * (l.x + l.w / 2), vp.clientWidth, W * z),
        y: clamp(vp.clientHeight / 2 - z * (l.y + l.h / 2), vp.clientHeight, H * z)
      });
    }, [sel]);

    // zoom alrededor de un punto del viewport (por defecto, el centro)
    const zoomTo = useCallback((nz, px, py) => {
      const vp = vpRef.current;if (!vp) return;
      nz = num(nz, fitZ(), Z_MAX);
      if (px == null) { px = vp.clientWidth / 2; py = vp.clientHeight / 2; }
      const k = nz / z;
      setZ(nz);
      setTf((t) => ({
        x: clamp(px - k * (px - t.x), vp.clientWidth, W * nz),
        y: clamp(py - k * (py - t.y), vp.clientHeight, H * nz)
      }));
    }, [z]);
    const verTodo = useCallback(() => {
      const vp = vpRef.current;if (!vp) return;
      const nz = fitZ(); setZ(nz);
      setTf({ x: (vp.clientWidth - W * nz) / 2, y: (vp.clientHeight - H * nz) / 2 });
      setExplored(true);
    }, []);

    const onDown = (e) => {
      moved.current = false;setDragging(true);
      drag.current = { x: e.clientX, y: e.clientY, tx: tf.x, ty: tf.y };
    };
    const onMove = (e) => {
      if (!drag.current) return;
      const dx = e.clientX - drag.current.x,dy = e.clientY - drag.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) {moved.current = true;if (!explored) setExplored(true);}
      const vp = vpRef.current;
      setTf({ x: clamp(drag.current.tx + dx, vp.clientWidth, W * z), y: clamp(drag.current.ty + dy, vp.clientHeight, H * z) });
    };
    const endDrag = () => {drag.current = null;setDragging(false);};
    const onUp = (e) => {
      const tap = drag.current && !moved.current;
      endDrag();
      if (tap) pickAt(e.clientX, e.clientY);
    };
    const onWheel = (e) => {
      e.preventDefault();
      const vp = vpRef.current;if (!vp) return;
      const r = vp.getBoundingClientRect();
      if (!explored) setExplored(true);
      zoomTo(z * (e.deltaY < 0 ? 1.14 : 0.88), e.clientX - r.left, e.clientY - r.top);
    };
    // detección manual del lote bajo el puntero (independiente del hit-testing 3D del navegador)
    const pickAt = (cx, cy) => {
      const vp = vpRef.current;if (!vp) return;
      const nodes = vp.querySelectorAll('[data-lot]');
      let best = null, bestScore = Infinity;
      nodes.forEach((n) => {
        const id = n.getAttribute('data-lot'), l = LOTS.find((x) => x.id === id);
        if (!l || !matchFilter(l, filter)) return;
        const r = n.getBoundingClientRect();
        const inside = cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
        const mx = (r.left + r.right) / 2, my = (r.top + r.bottom) / 2;
        const d = (cx - mx) ** 2 + (cy - my) ** 2;
        const score = inside ? d : d + 1e9; // exige caer dentro del recuadro
        if (score < bestScore) {bestScore = score;best = l;}
      });
      setExplored(true);
      if (best && bestScore < 1e9) {
        setSel((cur) => cur === best.id ? null : best.id); // re-tocar el mismo lote lo deselecciona
      } else {
        setSel(null); // tocar zona vacía del mapa oculta la card
      }
    };
    // clic fuera del mapa (excepto botones y la propia card) oculta la card
    const onBgClick = (e) => {
      if (!sel) return;
      if (e.target.closest('button') || e.target.closest('[data-terreno-card]') || e.target.closest('[data-terreno-map]')) return;
      setSel(null);
    };

    return (
      <div onClick={onBgClick} style={{ position: 'absolute', inset: 0, background: F.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif" }}>
        {/* ---------- HEADER (línea Suti: gradiente guinda + chrome frosted + labio blanco) ---------- */}
        <div style={{ flexShrink: 0, background: 'var(--header-bg, var(--grad-guinda))', color: '#fff', padding: '8px 14px 0', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -40, top: -34, opacity: 0.12 }}><window.SutiSeal size={170} /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, position: 'relative' }}>
            <button onClick={app.back} style={{ width: 42, height: 42, borderRadius: 14, border: '1px solid rgba(255,255,255,.22)', background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#fff', flexShrink: 0 }}>
              <I name="arrowL" size={22} stroke={2} />
            </button>
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: '0 6px 16px -6px rgba(0,0,0,.4)' }}>
              <FresLogo size={34} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-.01em' }}>El Fresnillo</div>
              <div style={{ fontSize: 11.5, fontWeight: 600, opacity: .85, marginTop: 2 }}>Reserva Campestre · Hermosillo, Sonora</div>
            </div>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 12, background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.22)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', borderRadius: 999, padding: '6px 12px' }}>
            <I name="land" size={14} stroke={2} />
            <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.04em' }}>SUTI TERRENO</span>
            <span style={{ width: 3, height: 3, borderRadius: 999, background: 'rgba(255,255,255,.5)' }} />
            <span style={{ fontSize: 11.5, fontWeight: 600, opacity: .9 }}>Lotes a plazos · descuento vía nómina</span>
          </div>
          {/* labio blanco redondeado (firma de la app) */}
          <div style={{ position: 'relative', height: 24, background: F.bg, borderRadius: '26px 26px 0 0', marginTop: 16 }}>
            <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 40, height: 5, borderRadius: 999, background: 'var(--hairline-strong)' }} />
          </div>
        </div>

        {/* ---------- STATS ---------- */}
        <div style={{ flexShrink: 0, display: 'flex', gap: 8, padding: '12px 14px 4px' }}>
          {[['Disponibles', disp, 'var(--pos)'], ['Vendidos', vend, 'var(--ink-3)'], ['Total lotes', shown.length, '#2E6EF0']].map(([lab, val, col]) =>
          <div key={lab} style={{ flex: 1, background: 'var(--surface)', borderRadius: 16, padding: '11px 12px', textAlign: 'center', boxShadow: 'var(--neo-sm)' }}>
              <div style={{ fontSize: 25, fontWeight: 900, color: col, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{val}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', marginTop: 5 }}>{lab}</div>
            </div>
          )}
        </div>

        {/* ---------- FILTROS ---------- */}
        <div style={{ flexShrink: 0, display: 'flex', gap: 8, overflowX: 'auto', padding: '10px 14px', scrollbarWidth: 'none' }}>
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button key={f.id} onClick={() => setFilter(f.id)} className="su-btn" style={{
                flexShrink: 0, height: 36, padding: '0 16px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'background .22s cubic-bezier(.2,.7,.3,1), color .22s, box-shadow .22s', border: 'none',
                background: active ? 'var(--grad-guinda-soft)' : 'var(--surface)',
                color: active ? '#fff' : 'var(--ink-2)',
                boxShadow: active ? 'var(--glow-guinda)' : 'var(--neo-sm)'
              }}>{f.label}</button>);

          })}
        </div>

        {/* ---------- MAPA (zona desplazable + zoom) ---------- */}
        <div ref={vpRef} data-terreno-map onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={endDrag} onPointerLeave={endDrag} onWheel={onWheel}
        style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', margin: '0 14px', borderRadius: 18, border: `1px solid ${F.arenaLine}`, cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none', background: view3d ? `radial-gradient(120% 90% at 50% 8%, #f3ece0, ${F.arena} 70%)` : F.arena, perspective: '1100px', perspectiveOrigin: '50% 32%' }}>
          {/* sombra de apoyo (modo maqueta) — capa NO inclinada, no rompe el hit-testing 3D */}
          <div style={{ position: 'absolute', left: '50%', bottom: '8%', width: '82%', height: '30%', transform: 'translateX(-50%)', borderRadius: '50%', background: 'radial-gradient(50% 50% at 50% 50%, rgba(58,42,24,.4), transparent 72%)', filter: 'blur(9px)', pointerEvents: 'none', opacity: view3d ? 1 : 0, transition: 'opacity .42s' }} />
          {/* capa de paneo + zoom (origen sup-izq) */}
          <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0', transformStyle: 'preserve-3d', transform: `translate(${tf.x}px, ${tf.y}px) scale(${z})`, transition: dragging ? 'none' : 'transform .5s cubic-bezier(.22,1,.36,1)' }}>
            {/* capa de inclinación 3D (origen centro) — SIN filter para no aplanar el contexto 3D */}
            <div style={{ width: W, height: H, transformStyle: 'preserve-3d', transformOrigin: 'center center', transform: view3d ? 'rotateX(48deg)' : 'none', transition: 'transform .5s cubic-bezier(.22,1,.36,1)' }}>
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
              <defs>
                <pattern id="fresTex" width="22" height="22" patternUnits="userSpaceOnUse">
                  <rect width="22" height="22" fill={F.arena} />
                  <circle cx="5" cy="5" r="1" fill="#d6cab2" opacity="0.55" />
                  <circle cx="16" cy="14" r="1" fill="#d6cab2" opacity="0.4" />
                </pattern>
                <radialGradient id="fresLight" cx="42%" cy="14%" r="85%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
                  <stop offset="48%" stopColor="#ffffff" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#2a1f14" stopOpacity="0.14" />
                </radialGradient>
              </defs>
              <rect x="0" y="0" width={W} height={H} fill="url(#fresTex)" />
              {view3d && <rect x="0" y="0" width={W} height={H} fill="url(#fresLight)" pointerEvents="none" />}

              {/* rosa de los vientos + escala (anotación de maqueta) */}
              <g pointerEvents="none" opacity="0.72">
                <circle cx="44" cy="48" r="17" fill="#fff" opacity="0.6" />
                <circle cx="44" cy="48" r="17" fill="none" stroke="#97a0b3" strokeWidth="1.2" />
                <path d="M44 34 L48 49 L44 45 L40 49 Z" fill="#910022" />
                <path d="M44 62 L48 47 L44 51 L40 47 Z" fill="#b9c0cd" />
                <text x="44" y="30" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#910022" fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif">N</text>
              </g>
              <g pointerEvents="none" opacity="0.7">
                <rect x="28" y="566" width="22" height="5" fill="#5a6378" />
                <rect x="50" y="566" width="22" height="5" fill="#fff" stroke="#5a6378" strokeWidth="1" />
                <text x="28" y="563" fontSize="9" fontWeight="800" fill="#5a6378" fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif">0</text>
                <text x="72" y="563" textAnchor="end" fontSize="9" fontWeight="800" fill="#5a6378" fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif">50 m</text>
              </g>

              {/* calles */}
              {STREETS.map((s) =>
              <g key={s.name}>
                  <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={6} fill="#cfc6b4" />
                  {s.dir === 'h' ?
                <line x1={s.x + 8} y1={s.y + s.h / 2} x2={s.x + s.w - 8} y2={s.y + s.h / 2} stroke="#fff" strokeWidth="2" strokeDasharray="9 8" opacity="0.85" /> :
                <line x1={s.x + s.w / 2} y1={s.y + 8} x2={s.x + s.w / 2} y2={s.y + s.h - 8} stroke="#fff" strokeWidth="2" strokeDasharray="9 8" opacity="0.85" />}
                  {s.dir === 'h' ?
                <text x={s.x + s.w / 2} y={s.y + s.h / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#7a7060" fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif" letterSpacing="1.5">{s.name.toUpperCase()}</text> :
                <text x={s.x + s.w / 2} y={s.y + s.h / 2} textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#7a7060" fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif" letterSpacing="1.5" transform={`rotate(-90 ${s.x + s.w / 2} ${s.y + s.h / 2})`}>{s.name.toUpperCase()}</text>}
                </g>
              )}

              {/* áreas comunes */}
              {AREAS.map((a) =>
              <g key={a.label}>
                  <rect x={a.x} y={a.y} width={a.w} height={a.h} rx={14} fill={a.fill} stroke={a.line} strokeWidth={a.dashed ? 2 : 1.4} strokeDasharray={a.dashed ? '7 6' : undefined} />
                  <g transform={`translate(${a.x + a.w / 2 - 12}, ${a.y + a.h / 2 - 26})`}><AreaIcon name={a.icon} size={24} color={a.tc} /></g>
                  <text x={a.x + a.w / 2} y={a.y + a.h / 2 + 12} textAnchor="middle" fontSize="13" fontWeight="800" fill={a.tc} fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif">{a.label}</text>
                  {a.sub && <text x={a.x + a.w / 2} y={a.y + a.h / 2 + 28} textAnchor="middle" fontSize="11" fontWeight="600" fill={a.tc} fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif" opacity="0.8">{a.sub}</text>}
                </g>
              )}

              {/* entrada principal */}
              <g>
                <rect x={ENT_X1 - 2} y={M} width={ENT_X2 - ENT_X1 + 4} height={DN} rx={9} fill={F.cafe} />
                <g transform={`translate(${(ENT_X1 + ENT_X2) / 2 - 9}, ${M + 9})`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d8b87a" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: '<path d="M5 21V8l7-4 7 4v13"/><path d="M3.5 21h17"/><path d="M9.5 21v-5h5v5"/>' }} />
                </g>
                <text x={(ENT_X1 + ENT_X2) / 2} y={M + DN - 10} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#f6f1e6" fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif" letterSpacing="0.5">ENTRADA</text>
              </g>

              {/* lotes */}
              {LOTS.map((l) => {
                const isSel = sel === l.id;
                const match = matchFilter(l, filter);
                return (
                  <g key={l.id} data-lot={l.id} opacity={match ? 1 : 0.13} style={{ cursor: match ? 'pointer' : 'default', transition: 'opacity .28s ease' }}>
                    <rect x={l.x} y={l.y} width={l.w} height={l.h} rx={5}
                    fill={lotFill(l, isSel)}
                    stroke={isSel ? F.cafe : 'rgba(255,255,255,.35)'} strokeWidth={isSel ? 3 : 1} />
                    <text x={l.x + l.w / 2} y={l.y + l.h / 2 + 4} textAnchor="middle" fontSize={l.w < 36 ? 10 : 11} fontWeight="800" fill={lotTextColor(l, isSel)} fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif">{l.id}</text>
                  </g>);

              })}

              {/* anillo pulsante del lote seleccionado (encima de todo) */}
              {selLot &&
              <g pointerEvents="none">
                  <rect x={selLot.x - 4} y={selLot.y - 4} width={selLot.w + 8} height={selLot.h + 8} rx={9} fill="none" stroke={F.oro} strokeWidth="3">
                    <animate attributeName="opacity" values="0.95;0.3;0.95" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="stroke-width" values="3;4.5;3" dur="1.5s" repeatCount="indefinite" />
                  </rect>
                </g>
              }
            </svg>
            {/* billboards 3D (de pie sobre el plano) */}
            {view3d && BILLBOARDS.map((b, i) => <Billboard key={i} b={b} />)}
            </div>
          </div>
          {/* degradados de borde (indican que hay más mapa) */}
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 22, pointerEvents: 'none', background: `linear-gradient(${F.arena}, transparent)` }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 22, pointerEvents: 'none', background: `linear-gradient(transparent, ${F.arena})` }} />
          {/* hint arrastrar (se oculta tras la primera interacción) */}
          <div style={{ position: 'absolute', right: 10, bottom: 10, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(42,31,20,.82)', color: '#f6f1e6', borderRadius: 999, padding: '5px 11px', fontSize: 11, fontWeight: 700, pointerEvents: 'none', opacity: explored ? 0 : 1, transform: explored ? 'translateY(6px)' : 'none', transition: 'opacity .4s, transform .4s' }}>
            <I name="grid" size={13} stroke={2} /> Arrastra para explorar
          </div>
        </div>

        {/* ---------- BARRA DE CONTROLES DEL MAPA (debajo del mapa) ---------- */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 14px 2px' }}>
          {/* segmentado 3D / Plano */}
          <div style={{ display: 'flex', gap: 3, background: 'var(--surface)', borderRadius: 999, padding: 3, boxShadow: 'var(--neo-sm)' }}>
            {[['3D', true], ['Plano', false]].map(([lab, v]) =>
            <button key={lab} onClick={() => setView3d(v)} style={{
              height: 30, padding: '0 14px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 800, fontFamily: 'inherit', transition: 'background .22s cubic-bezier(.2,.7,.3,1), color .22s, box-shadow .22s',
              background: view3d === v ? 'var(--grad-guinda-soft)' : 'transparent',
              color: view3d === v ? '#fff' : F.ink2,
              boxShadow: view3d === v ? 'var(--glow-guinda)' : 'none',
            }}>{lab}</button>
            )}
          </div>
          {/* zoom + ver todo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={verTodo} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 800, fontFamily: 'inherit', color: F.ink, background: 'var(--surface)', boxShadow: 'var(--neo-sm)',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={F.ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" /></svg>
              Ver todo
            </button>
            <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: 999, padding: 3, boxShadow: 'var(--neo-sm)' }}>
              {[['−', () => zoomTo(z * 0.77)], ['+', () => zoomTo(z * 1.3)]].map(([lab, fn]) =>
              <button key={lab} onClick={fn} style={{
                width: 36, height: 30, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 20, fontWeight: 700, lineHeight: 1, color: F.ink, fontFamily: 'inherit', borderRadius: 999,
              }}>{lab}</button>
              )}
            </div>
          </div>
        </div>

        {/* ---------- LEYENDA ---------- */}
        <div style={{ flexShrink: 0, display: 'flex', flexWrap: 'wrap', gap: '6px 14px', padding: '11px 16px 4px' }}>
          {[['Norte', F.verde], ['Sur', F.verdeMid], ['Lateral', F.ambar], ['Vendido', F.gris], ['Seleccionado', F.oro], ['Áreas comunes', F.azulSoft]].map(([lab, c]) =>
          <div key={lab} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 11, height: 11, borderRadius: 4, background: c, border: c === F.azulSoft ? '1px solid #7FB2E0' : 'none' }} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: F.ink2 }}>{lab}</span>
            </div>
          )}
        </div>

        {/* ---------- TARJETA DE DETALLE ---------- */}
        <div data-terreno-card style={{ flexShrink: 0, padding: '8px 14px calc(14px + env(safe-area-inset-bottom))' }}>
          {selLot ? <DetailCard key={selLot.id} l={selLot} app={app} /> :
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-card)', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 13, boxShadow: 'var(--neo-sm)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--guinda-50)', display: 'grid', placeItems: 'center', color: 'var(--guinda)', flexShrink: 0 }}>
                <I name="pin" size={22} stroke={1.9} />
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1.35 }}>Toca un lote en el mapa para ver superficie, medidas y precio.</div>
            </div>
          }
        </div>
      </div>);

  }

  // ---------- Tarjeta de detalle del lote (línea gráfica de Inicio) ----------
  function DetailCard({ l, app }) {
    const dispo = !l.vendido;
    const [financeOpen, setFinanceOpen] = React.useState(false);
    const metric = (val, unit, lab) =>
    <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 14, padding: '11px 6px', textAlign: 'center' }}>
        <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{val}<span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)' }}>{' ' + unit}</span></div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', marginTop: 6 }}>{lab}</div>
      </div>;

    return (<React.Fragment>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-card)', padding: 18, boxShadow: 'var(--neo-md)', animation: 'su-slideup .26s cubic-bezier(.22,1,.36,1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--guinda-50)', display: 'grid', placeItems: 'center', color: 'var(--guinda)', flexShrink: 0, boxShadow: 'var(--neo-sm)' }}>
            <I name="land" size={27} stroke={1.9} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif", fontSize: 25, fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>Lote #{l.id}</span>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-3)', marginTop: 3 }}>{ZONA_LABEL[l.zona]}</div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 800, letterSpacing: '.01em',
            background: dispo ? '#E7F6ED' : 'var(--surface-2)', color: dispo ? '#13794A' : 'var(--ink-3)' }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: dispo ? '#1c9d6b' : 'var(--ink-3)' }} />
            {dispo ? 'Disponible' : 'Vendido'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {metric(l.m2, 'm²', 'm² totales')}
          {metric(l.frente, 'm', 'frente')}
          {metric(l.fondo, 'm', 'fondo')}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginTop: 16 }}>
          <div>
            <div style={{ fontSize: 27, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{window.money(l.precio)}</div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)', marginTop: 5 }}>MXN · consulta tus opciones de financiamiento</div>
          </div>
          <span style={{ flexShrink: 0, background: 'var(--guinda-50)', color: 'var(--guinda)', borderRadius: 999, padding: '5px 11px', fontSize: 11.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{window.money(Math.round(l.precio / l.m2))}/m²</span>
        </div>

        {dispo ?
        <button onClick={() => setFinanceOpen(true)} className="su-btn" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: 52, marginTop: 16, borderRadius: 15, border: 'none',
          background: 'var(--grad-guinda-soft)', color: '#fff', fontSize: 15.5, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer',
          boxShadow: 'var(--glow-guinda)'
        }}>Simular financiamiento <span style={{ fontSize: 17 }}>↗</span></button> :

        <button disabled style={{ width: '100%', height: 52, marginTop: 16, borderRadius: 15, border: 'none', background: 'var(--surface-2)', color: 'var(--ink-3)', fontSize: 15, fontWeight: 800, fontFamily: 'inherit', cursor: 'not-allowed' }}>No disponible</button>
        }
      </div>
      {window.FinanceSimSheet && <window.FinanceSimSheet open={financeOpen} onClose={() => setFinanceOpen(false)} it={{ id: 'terrenos', label: `Lote #${l.id}` }} app={app} initialAmount={l.precio} />}
    </React.Fragment>);

  }

  window.TerrenoScreen = TerrenoScreen;
})();
