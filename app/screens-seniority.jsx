/* Claude reference adapted to the existing module navigation; real RPC data only. */
(function () {
  'use strict';
  const h = React.createElement;
  const css = `
  .seniority-screen{position:absolute;inset:0;display:flex;flex-direction:column;background:#f6f4f1;color:#1d1b19;font-family:Inter,system-ui,sans-serif;overflow:hidden}
  .seniority-header{background:#7a1230;color:white;padding:20px 20px 22px;border-radius:0 0 28px 28px;flex-shrink:0}
  .seniority-nav{display:flex;align-items:center;justify-content:space-between;gap:12px}
  .seniority-nav button{width:44px;height:44px;flex-shrink:0;border:0;border-radius:14px;background:#ffffff24;color:white;display:grid;place-items:center;cursor:pointer}
  .seniority-nav span{font-size:13px;font-weight:600;letter-spacing:.055em;text-align:center}.seniority-nav .seniority-nav-spacer{width:44px;height:44px;flex-shrink:0}[data-text-size] .seniority-nav .seniority-nav-spacer{min-width:48px}
  .seniority-header h1{margin:18px 0 4px;text-align:center;font-size:28px;font-weight:800;letter-spacing:-.02em}
  .seniority-header p{margin:0;text-align:center;font-size:14px;color:#ffffffd9}
  .seniority-search{flex-shrink:0;padding:14px 16px 0}
  .seniority-search-box{max-width:1000px;margin:auto;display:flex;align-items:center;gap:10px;min-height:48px;padding:0 4px 0 14px;background:white;border:1px solid #ece8e3;border-radius:14px;box-sizing:border-box}
  .seniority-search-box:focus-within{border-color:#7a1230;box-shadow:0 0 0 3px #7a12301f}.seniority-search-box>svg{flex-shrink:0;color:#7a1230}
  .seniority-search input{flex:1;min-width:0;min-height:46px;border:0;outline:0;background:none;padding:0;font:inherit;font-size:16px;color:#1d1b19;-webkit-appearance:none;appearance:none}
  .seniority-search input:focus,.seniority-search input:focus-visible{outline:0;box-shadow:none}.seniority-search input::placeholder{color:#8a837d}.seniority-search input::-webkit-search-cancel-button{-webkit-appearance:none;display:none}
  .seniority-search button{width:40px;height:40px;flex-shrink:0;border:0;border-radius:12px;background:none;color:#6b6560;display:grid;place-items:center;cursor:pointer}
  .seniority-scroll{flex:1;min-height:0;overflow-y:auto;padding:18px 16px 28px;overscroll-behavior:contain}
  .seniority-content{max-width:1000px;margin:auto}.seniority-total{margin:0 4px 20px;color:#6b6560;font-size:12px}
  .seniority-group{margin-bottom:24px}.seniority-group-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:0 4px;margin-bottom:12px}
  .seniority-group-head div{min-width:0}.seniority-parent{font-size:11px;font-weight:600;letter-spacing:.06em;color:#6b6560;text-transform:uppercase}
  .seniority-group h2{font-size:15px;font-weight:800;line-height:1.3;margin:3px 0 0;text-transform:uppercase;overflow-wrap:anywhere}
  .seniority-count{flex-shrink:0;font-size:12px;font-weight:600;color:#57524d;background:#eae6e1;border-radius:999px;padding:4px 10px;white-space:nowrap}
  .seniority-list{background:white;border-radius:18px;border:1px solid #ece8e3;overflow:hidden;list-style:none;padding:0;margin:0}
  .seniority-row{display:grid;grid-template-columns:26px 44px minmax(0,1fr) auto;align-items:center;gap:12px;padding:14px;min-height:76px;box-sizing:border-box;border-top:1px solid #f0ece7}
  .seniority-row:first-child{border-top:0}.seniority-rank{width:26px;height:26px;border-radius:9px;display:grid;place-items:center;font-size:12px;font-weight:800;background:#f0ece7;color:#57524d}
  .seniority-rank-first{background:#7a1230;color:white}.seniority-avatar{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-size:14px;font-weight:700}
  .seniority-name{font-size:15px;font-weight:600;display:block;overflow-wrap:anywhere}.seniority-sub{display:block;font-size:12px;color:#6b6560;margin-top:3px;overflow-wrap:anywhere}
  .seniority-tenure{text-align:right;max-width:145px}.seniority-tenure strong{display:block;font-size:17px;font-weight:800;color:#7a1230;letter-spacing:-.01em}
  .seniority-tenure small{display:block;font-size:11px;color:#6b6560;margin-top:3px}.seniority-state{padding:24px 8px;text-align:center;color:#6b6560;font-size:14px}
  .seniority-state button{margin-top:12px;border:1px solid #7a1230;border-radius:10px;background:white;color:#7a1230;padding:10px 16px;font:inherit;cursor:pointer}
  @media(max-width:480px){.seniority-row{gap:9px;padding:14px 12px;grid-template-columns:26px 40px minmax(0,1fr) minmax(80px,105px)}.seniority-avatar{width:40px;height:40px}.seniority-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.seniority-tenure strong{font-size:16px}.seniority-nav{gap:8px}}
  @media(min-width:700px){.seniority-header{padding-left:32px;padding-right:32px}.seniority-search{padding:18px 32px 0}.seniority-scroll{padding:24px 32px}.seniority-row{padding:18px 20px}.seniority-name{font-size:16px}}
  `;
  // Search matches only the work-module name (area included), never people's names;
  // accents, case and punctuation are ignored and every typed word must appear.
  const fold = text => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  function SeniorityScreen({ app }) {
    const [data, setData] = React.useState({ items: [], total: 0, next_offset: 0, as_of: null });
    const [phase, setPhase] = React.useState('loading');
    const [error, setError] = React.useState('');
    const [query, setQuery] = React.useState('');
    const scroll = React.useRef(null), sentinel = React.useRef(null), busy = React.useRef(false), generation = React.useRef(0);
    const model = window.SeniorityModel;
    const terms = fold(query).split(' ').filter(Boolean), searching = terms.length > 0;
    const complete = !!data.as_of && data.next_offset >= data.total;
    async function load(reset = false, limit) {
      if (busy.current) return;
      busy.current = true;
      const epoch = generation.current;
      setPhase('loading'); setError('');
      try {
        const page = await window.SeniorityRepository.page(reset ? 0 : data.next_offset, limit);
        if (epoch !== generation.current) return;
        if (!reset && data.as_of && (page.as_of !== data.as_of || page.revision !== data.revision)) {
          setData({ items: [], total: 0, next_offset: 0, as_of: null });
          throw new Error('El padrón se actualizó. Vuelve a cargar la lista.');
        }
        setData(current => ({ ...page, items: model.merge(reset ? [] : current.items, page.items) }));
        setPhase('loaded');
      } catch (failure) {
        if (epoch === generation.current) { setError(failure.message); setPhase('error'); }
      } finally { if (epoch === generation.current) busy.current = false; }
    }
    React.useEffect(() => {
      load(true);
      return () => { generation.current += 1; };
    }, []);
    React.useEffect(() => {
      if (searching || phase !== 'loaded' || data.next_offset >= data.total || !sentinel.current) return;
      const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) load(); }, { root: scroll.current, rootMargin: '240px' });
      observer.observe(sentinel.current);
      return () => observer.disconnect();
    }, [searching, phase, data.next_offset, data.total]);
    // A search must see every module, so it reads the remaining pages (same paginated RPC, 100 per call).
    React.useEffect(() => {
      if (searching && phase === 'loaded' && data.next_offset < data.total) load(false, 100);
    }, [searching, phase, data.next_offset, data.total]);
    function search(value) { setQuery(value); if (scroll.current) scroll.current.scrollTop = 0; }
    const groups = [];
    data.items.forEach(row => { let group = groups[groups.length - 1]; if (!group || group.key !== row.unit) { group = { key: row.unit, rows: [], count: row.unit_total }; groups.push(group); } group.rows.push(row); });
    const tints = [['#f6e3e8','#7a1230'],['#e1eef0','#1e5560'],['#f5ebd9','#7a4e10'],['#e8e5f3','#43367a']];
    groups.forEach((group, index) => { group.tint = tints[index % tints.length]; });
    const visible = searching ? groups.filter(group => { const name = fold(group.key || 'Unidad no registrada'); return terms.every(term => name.includes(term)); }) : groups;
    const matched = visible.reduce((sum, group) => sum + group.count, 0);
    const asOf = data.as_of ? ' · Al ' + data.as_of.split('-').reverse().join('/') + ' · Hermosillo' : '';
    const summary = !searching ? data.total + ' agremiados' + asOf : complete ? plural(visible.length, 'módulo', 'módulos') + ' · ' + plural(matched, 'agremiado', 'agremiados') + asOf : 'Buscando en todos los módulos…';
    return h('div', { className: 'seniority-screen', 'data-seniority': phase },
      h('style', null, css),
      h('header', { className: 'seniority-header' },
        h('div', { className: 'seniority-nav' },
          h('button', { type: 'button', onClick: app.back, 'aria-label': 'Regresar a Inicio' }, h(window.Icon, { name: 'arrowL', size: 22 })),
          h('span', null, 'Agremiados por antigüedad'),
          h('span', { className: 'seniority-nav-spacer', 'aria-hidden': true })),
        h('h1', null, 'Antigüedad'), h('p', null, 'Miembros por módulo de trabajo')),
      h('div', { className: 'seniority-search', role: 'search' }, h('div', { className: 'seniority-search-box' },
        h(window.Icon, { name: 'search', size: 20 }),
        h('input', { type: 'search', value: query, placeholder: 'Buscar módulo de trabajo', 'aria-label': 'Buscar módulo de trabajo', autoComplete: 'off', spellCheck: false, enterKeyHint: 'search',
          onChange: event => search(event.target.value),
          onKeyDown: event => { if (event.key === 'Enter') event.currentTarget.blur(); else if (event.key === 'Escape' && query) { event.preventDefault(); search(''); } } }),
        query && h('button', { type: 'button', onClick: () => search(''), 'aria-label': 'Borrar búsqueda' }, h(window.Icon, { name: 'close', size: 18 })))),
      h('div', { ref: scroll, className: 'seniority-scroll su-app-scroll' }, h('div', { className: 'seniority-content' },
        data.as_of && h('p', { className: 'seniority-total', 'data-seniority-total': data.total, 'data-seniority-matches': searching && complete ? matched : undefined, 'aria-live': 'polite' }, summary),
        visible.map(group => {
          const unit = group.key || 'Unidad no registrada', slash = unit.indexOf('/'), tint = group.tint;
          return h('section', { key: unit, className: 'seniority-group', 'data-seniority-unit': unit },
            h('div', { className: 'seniority-group-head' }, h('div', null, slash >= 0 && h('span', { className: 'seniority-parent' }, unit.slice(0, slash)), h('h2', null, slash >= 0 ? unit.slice(slash + 1) : unit)), h('span', { className: 'seniority-count' }, group.count + (group.count === 1 ? ' miembro' : ' miembros'))),
            h('ol', { className: 'seniority-list' }, group.rows.map(row => h('li', { key: row.id, className: 'seniority-row', 'data-seniority-row': row.id },
              h('span', { className: 'seniority-rank' + (row.rank === 1 && row.date_status === 'VALID' ? ' seniority-rank-first' : ''), 'aria-label': 'Posición ' + row.rank }, row.rank),
              h('span', { className: 'seniority-avatar', 'aria-hidden': true, style: { background: tint[0], color: tint[1] } }, (row.name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('')),
              h('span', { style: { minWidth: 0 } }, h('span', { className: 'seniority-name', title: row.name || undefined }, row.name || 'Nombre no registrado'), h('span', { className: 'seniority-sub' }, [row.city, row.numero_control && 'No. ' + row.numero_control].filter(Boolean).join(' · '))),
              h('span', { className: 'seniority-tenure' }, h('strong', null, model.tenure(row.tenure_months)), h('small', null, model.since(row)))))));
        }),
        phase === 'loaded' && !data.total && h('div', { className: 'seniority-state', role: 'status' }, 'No hay agremiados que cumplan los criterios.'),
        phase === 'loaded' && searching && complete && data.total > 0 && !visible.length && h('div', { className: 'seniority-state', role: 'status' }, 'No hay módulos con ese nombre.'),
        phase === 'loading' && h('div', { className: 'seniority-state', role: 'status' }, 'Cargando agremiados…'),
        phase === 'error' && h('div', { className: 'seniority-state', role: 'alert' }, h('div', null, error), h('button', { type: 'button', onClick: () => load(!data.as_of) }, 'Reintentar')),
        h('div', { ref: sentinel, 'aria-hidden': true, style: { height: 1 } }))));
  }
  window.SeniorityScreen = SeniorityScreen;
})();
