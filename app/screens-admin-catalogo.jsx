/* screens-admin-catalogo.jsx — Módulo "Marketplace": administra los productos y
   servicios que aparecen en "Disponibles ahora" (Finanzas y Convenios).
   Se usa desde el Panel Administrativo (todas las categorías) y desde el Panel
   Empresarial con un scope fijo (cada tercero administra lo suyo).
   Exporta window.MarketplaceModule, window.CatalogEditorList. */
(function () {
  const { useEffect, useState, useRef } = React;
  const I = window.Icon;
  const S = () => window.catalogStore;
  const lbl = { fontSize: 12, fontWeight: 800, color: 'var(--ink-2)', display: 'block', marginBottom: 6 };
  const inputBase = { width: '100%', border: 'none', outline: 'none', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', borderRadius: 12, padding: '11px 13px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', color: 'var(--ink)', boxSizing: 'border-box' };

  function Toggle({ on, onClick, disabled }) {
    return React.createElement(window.Toggle, { on: on, size: 'lg', onClick, disabled, 'aria-label': 'Cambiar', glow: false, });
  }
  function miniBtn(icon, onClick, disabled, label, flip) {
    return React.createElement('button', { onClick, disabled, 'aria-label': label, style: { width: 30, height: 30, borderRadius: 9, border: 'none', cursor: disabled ? 'default' : 'pointer', display: 'grid', placeItems: 'center', background: 'var(--surface-2)', color: 'var(--ink-3)', opacity: disabled ? .35 : 1, transform: flip ? 'none' : 'rotate(180deg)' } }, React.createElement(I, { name: icon, size: 15, stroke: 2.2 }));
  }

  // ── Lista + editor para un scope concreto (reutilizada por ambos paneles) ──
  function CatalogEditorList({ scope, scopeId, empresaId, editable, actor, dark, permissions }) {
    const store = window.useCatalogStore();
    const [edit, setEdit] = useState(null);
    const list = store.byScope(scope, scopeId);
    const listRef = useRef(null);
    window.useFlipRows(listRef);
    const addBg = dark ? 'linear-gradient(145deg,#1b2c52,#14213d)' : 'var(--grad-guinda-soft)';
    const P=permissions||{create:editable,update:editable,delete:editable,publish:editable,order:editable,assets:editable};
    if(store.state().phase==='loading'&&list.length===0)return React.createElement(window.Skeleton,{h:180,r:16});
    if(store.state().phase==='error')return React.createElement(window.EmptyState,{icon:'alert',title:'No pudimos cargar el Marketplace',sub:'La fuente autoritativa no está disponible.',action:React.createElement(window.Btn,{onClick:store.retry},'Reintentar')});
    return React.createElement('div', null,
      P.create && React.createElement('button', {
        onClick: () => setEdit(store.blank(scope, scopeId, empresaId)),
        style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', height: 46, borderRadius: 13, border: 'none', background: addBg, color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer', marginBottom: 14 },
      }, React.createElement(I, { name: 'plus', size: 18, stroke: 2.6 }), 'Nuevo producto o servicio'),
      list.length === 0
        ? React.createElement(window.EmptyState, { icon: 'cart', title: 'Sin productos', sub: 'Los que agregues aquí aparecerán en "Disponibles ahora".' })
        : React.createElement('div', { ref: listRef, style: { display: 'flex', flexDirection: 'column', gap: 10 } },
          list.map((p, i) => React.createElement('div', { key: p.id, 'data-flip-key': p.id, style: { display: 'flex', alignItems: 'center', gap: 11, background: 'var(--surface)', borderRadius: 14, padding: 11, boxShadow: 'var(--neo-sm)', opacity: p.activo === false ? .55 : 1 } },
            React.createElement('div', { style: { width: 48, height: 48, borderRadius: 11, overflow: 'hidden', background: 'var(--surface-2)', flexShrink: 0, display: 'grid', placeItems: 'center', color: 'var(--ink-3)' } },
              p.imagenes && p.imagenes[0]
                ? React.createElement('img', { src: p.imagenes[0], alt: '', style: { width: '100%', height: '100%', objectFit: 'cover' } })
                : React.createElement(I, { name: 'image', size: 20, stroke: 1.9 })),
            React.createElement('button', { onClick: () => setEdit(p), style: { flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 } },
              React.createElement('div', { style: { fontSize: 14, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, p.nombre || 'Sin nombre'),
              React.createElement('div', { style: { fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } },
                (p.precio != null && !p.cotiza ? window.money(p.precio) : 'Se cotiza') + ((p.imagenes || []).length ? ' · ' + p.imagenes.length + ' img' : ' · sin imagen'))),
            P.order && React.createElement('div', { style: { display: 'flex', gap: 4, flexShrink: 0 } },
              miniBtn('chevD', () => store.move(p.id, 1), i === list.length - 1, 'Bajar', true),
              miniBtn('chevD', () => store.move(p.id, -1), i === 0, 'Subir')),
            P.publish && React.createElement(Toggle, { on: p.activo !== false, onClick: () => store.toggle(p.id) })))),
      edit && React.createElement(ItemEditor, { item: edit, editable:edit.id?P.update:P.create,permissions:P, actor, lockScope: true, onClose: () => setEdit(null) }));
  }

  // ── Editor de producto ──
  function ItemEditor({ item, editable, permissions, actor, lockScope, onClose }) {
    const [d, setD] = useState(() => JSON.parse(JSON.stringify(item)));
    const [err, setErr] = useState('');
    const [busy,setBusy]=useState(false);
    const [pending,setPending]=useState([]);
    const set = (k, v) => setD((p) => ({ ...p, [k]: v }));
    const isNew = !S().get(item.id);
    const cats = S().categories();
    const assets=d.imagenAssets||[];
    const imgs=(d.imagenes||[]).concat(pending.map((x)=>x.url));
    const companies=((window.VisualContent&&window.VisualContent.getState().companies)||[]).filter((x)=>x.enabled!==false);

    const addImgs = (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      setErr('');
      const room=Math.max(0,8-imgs.length);setPending((old)=>old.concat(files.slice(0,room).map((file)=>({file,url:URL.createObjectURL(file)}))));
      e.target.value = '';
    };
    const rmImg = (i) => {if(i<assets.length)setD((p)=>({ ...p,imagenAssets:(p.imagenAssets||[]).filter((_,k)=>k!==i),imagenes:(p.imagenes||[]).filter((_,k)=>k!==i)}));else setPending((old)=>old.filter((_,k)=>k!==i-assets.length));};
    const primary = (i) => {if(i<assets.length)setD((p)=>{const aa=(p.imagenAssets||[]).slice(),ii=(p.imagenes||[]).slice();const[a]=aa.splice(i,1),[u]=ii.splice(i,1);return{...p,imagenAssets:[a,...aa],imagenes:[u,...ii]};});else setPending((old)=>{const j=i-assets.length,a=old.slice(),x=a.splice(j,1)[0];return[x,...a];});};
    const save = async () => {
      if (!String(d.nombre || '').trim()) { setErr('Escribe el nombre del producto o servicio.'); return; }
      if (!d.scopeId) { setErr('Selecciona la categoría o convenio al que pertenece.'); return; }
      if(!(d.company_id||d.empresaId)){setErr('Selecciona la empresa responsable.');return;}
      const rec = { ...d, precio: d.cotiza ? null : (Number(d.precio) || null) };
      if (!d.cotiza && rec.precio == null) { setErr('Define un precio o activa "Se cotiza".'); return; }
      setBusy(true);setErr('');try{const saved=await S().save(rec,actor);const ids=(d.imagenAssets||[]).map((x)=>x.id);for(const entry of pending)ids.push(await S().uploadProductAsset(entry.file,saved.empresaId));await S().replaceProductAssets(saved.id,ids);await S().retry();pending.forEach((x)=>URL.revokeObjectURL(x.url));onClose();}catch(e){setErr('No se pudo guardar. Revisa los datos e inténtalo de nuevo.');setBusy(false);}
    };
    const del = async () => { if (window.confirm('¿Eliminar este producto del Marketplace?')) {try{setBusy(true);await S().remove(d.id,actor);onClose();}catch(e){setErr('No se pudo eliminar el producto.');setBusy(false);}} };

    return React.createElement('div', { style: { position: 'absolute', inset: 0, zIndex: 78, background: 'var(--bg)', display: 'flex', flexDirection: 'column' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--hairline)' } },
        React.createElement('button', { onClick: onClose, 'aria-label': 'Cerrar', style: { width: 40, height: 40, borderRadius: 12, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink)' } }, React.createElement(I, { name: 'close', size: 22, stroke: 2 })),
        React.createElement('span', { style: { flex: 1, fontSize: 16, fontWeight: 800 } }, isNew ? 'Nuevo producto' : 'Editar producto')),
      React.createElement('div', { className: 'su-app-scroll', style: { flex: 1, overflowY: 'auto', padding: 16 } },
        React.createElement('label', { style: lbl }, 'Imágenes'),
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9, marginBottom: 8 } },
          imgs.map((src, i) => React.createElement('div', { key: i, style: { position: 'relative', paddingTop: '75%', borderRadius: 12, overflow: 'hidden', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)' } },
            React.createElement('img', { src, alt: '', style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' } }),
            i === 0 && React.createElement('span', { style: { position: 'absolute', left: 5, bottom: 5, fontSize: 9.5, fontWeight: 800, letterSpacing: '.06em', background: 'rgba(0,0,0,.6)', color: '#fff', padding: '3px 7px', borderRadius: 999 } }, 'PORTADA'),
            (!permissions||permissions.assets)&&React.createElement('button', { onClick: () => rmImg(i), 'aria-label': 'Quitar', style: { position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.55)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' } }, React.createElement(I, { name: 'close', size: 14, stroke: 2.6 })),
            (!permissions||permissions.assets)&&i > 0 && React.createElement('button', { onClick: () => primary(i), 'aria-label': 'Usar como portada', style: { position: 'absolute', bottom: 4, right: 4, width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.55)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' } }, React.createElement(I, { name: 'star', size: 13, stroke: 2.4 })))),
          (!permissions||permissions.assets)&&React.createElement('label', { style: { position: 'relative', paddingTop: '75%', borderRadius: 12, border: '1.5px dashed var(--hairline-strong)', background: 'var(--surface)', cursor: 'pointer', display: 'block' } },
            React.createElement('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--guinda)' } }, React.createElement(I, { name: 'plus', size: 22, stroke: 2.6 })),
            React.createElement('input', { type: 'file', accept: 'image/*', multiple: true, onChange: addImgs, style: { display: 'none' } }))),
        React.createElement('div', { style: { fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.45, marginBottom: 14 } }, 'La primera imagen es la portada. Si agregas varias, el afiliado las verá en carrusel y podrá ampliarlas.'),

        React.createElement('label', { style: lbl }, 'Nombre'),
        React.createElement('input', { value: d.nombre || '', disabled: !editable, maxLength: 60, placeholder: 'Ej. Nissan Versa 2021', onChange: (e) => set('nombre', e.target.value), style: { ...inputBase, marginBottom: 12 } }),

        React.createElement('label', { style: lbl }, 'Detalle corto (se muestra bajo el nombre)'),
        React.createElement('input', { value: d.ficha || '', disabled: !editable, maxLength: 48, placeholder: 'Ej. Seminuevo · 48k km', onChange: (e) => set('ficha', e.target.value), style: { ...inputBase, marginBottom: 12 } }),

        React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 12, background: 'var(--surface)', borderRadius: 14, padding: '12px 15px', boxShadow: 'var(--neo-sm)', marginBottom: 12 } },
          React.createElement('div', { style: { flex: 1 } },
            React.createElement('div', { style: { fontSize: 14, fontWeight: 800 } }, 'Se cotiza (sin precio visible)'),
            React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, marginTop: 3, lineHeight: 1.45 } }, 'El afiliado no verá precio: enviará su solicitud y el proveedor cargará la cotización antes de simular.')),
          React.createElement(Toggle, { on: !!d.cotiza, disabled: !editable, onClick: () => set('cotiza', !d.cotiza) })),
        !d.cotiza && React.createElement(React.Fragment, null,
          React.createElement('label', { style: lbl }, 'Precio'),
          React.createElement('input', { type: 'number', value: d.precio == null ? '' : d.precio, disabled: !editable, placeholder: '0', onChange: (e) => set('precio', e.target.value === '' ? null : Number(e.target.value)), style: { ...inputBase, marginBottom: 12 } })),

        React.createElement('label', { style: lbl }, 'Descripción completa'),
        React.createElement('textarea', { value: d.desc || '', disabled: !editable, rows: 5, placeholder: 'Características, condiciones, qué incluye…', onChange: (e) => set('desc', e.target.value), style: { ...inputBase, marginBottom: 12, resize: 'vertical', lineHeight: 1.55 } }),

        React.createElement('label', { style: lbl }, 'Etiqueta destacada (opcional)'),
        React.createElement('input', { value: d.badge || '', disabled: !editable, maxLength: 12, placeholder: 'Ej. OFERTA', onChange: (e) => set('badge', e.target.value), style: { ...inputBase, marginBottom: 12 } }),

        React.createElement('div',{style:{display:'flex',gap:12}},
          React.createElement('div',{style:{flex:1}},React.createElement('label',{style:lbl},'Descuento (%)'),React.createElement('input',{type:'number',min:0,max:100,value:d.discount_percent==null?'':d.discount_percent,disabled:!editable,onChange:(e)=>set('discount_percent',e.target.value===''?null:Number(e.target.value)),style:{...inputBase,marginBottom:12}})),
          React.createElement('div',{style:{flex:1}},React.createElement('label',{style:lbl},'Stock'),React.createElement('input',{type:'number',min:0,value:d.stock==null?'':d.stock,disabled:!editable,onChange:(e)=>set('stock',e.target.value===''?null:Number(e.target.value)),style:{...inputBase,marginBottom:12}}))),

        !empresaId&&React.createElement(React.Fragment,null,React.createElement('label',{style:lbl},'Empresa responsable'),React.createElement('select',{value:d.company_id||d.empresaId||'',disabled:!editable,onChange:(e)=>{set('company_id',e.target.value);set('empresaId',e.target.value);},style:{...inputBase,marginBottom:12,appearance:'auto'}},React.createElement('option',{value:''},'Selecciona…'),companies.map((c)=>React.createElement('option',{key:c.id,value:c.id},c.display_name)))),

        !lockScope && React.createElement(React.Fragment, null,
          React.createElement('label', { style: lbl }, 'Categoría o servicio al que pertenece'),
          React.createElement('select', {
            value: d.scope + '|' + d.scopeId, disabled: !editable,
            onChange: (e) => { const [sc, sid] = e.target.value.split('|'); setD((p) => ({ ...p, scope: sc, scopeId: sid })); },
            style: { ...inputBase, marginBottom: 12, appearance: 'auto' },
          },
            React.createElement('option', { value: '|' }, 'Selecciona…'),
            cats.map((c) => React.createElement('option', { key: c.scope + c.scopeId, value: c.scope + '|' + c.scopeId }, c.label + ' — ' + c.group)))),

        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', borderRadius: 14, padding: '12px 15px', boxShadow: 'var(--neo-sm)', marginBottom: 14 } },
          React.createElement('div', { style: { flex: 1, fontSize: 14, fontWeight: 800 } }, 'Activo (visible en el Marketplace)'),
          React.createElement(Toggle, { on: d.activo !== false, disabled: !!permissions&&!permissions.publish, onClick: () => set('activo', d.activo === false) })),

        err && React.createElement('div', { style: { fontSize: 12.5, fontWeight: 700, color: '#C0341D', marginBottom: 12 } }, err),
        editable
          ? React.createElement('div', { style: { display: 'flex', gap: 10 } },
            !isNew&&(!permissions||permissions.delete)&&React.createElement('button', { onClick: del, 'aria-label': 'Eliminar', style: { width: 46, borderRadius: 13, border: 'none', background: '#FDEAEA', color: '#C0341D', cursor: 'pointer', display: 'grid', placeItems: 'center' } },React.createElement(I, { name: 'trash', size: 18, stroke: 2 })),
            React.createElement(window.Btn, { variant: 'outline', style: { flex: 1 }, onClick: onClose }, 'Cancelar'),
            React.createElement(window.Btn, { icon: 'check', style: { flex: 2 }, disabled:busy,onClick: save }, busy?'Guardando…':'Guardar'))
          : React.createElement(window.Btn, { full: true, variant: 'outline', onClick: onClose }, 'Cerrar')));
  }

  // ── Módulo del Panel Administrativo ──
  function MarketplaceModule({ app, onBack, header, canEdit }) {
    const store = window.useCatalogStore();
    useEffect(()=>{store.retry();},[]);
    const editable = canEdit !== false;
    const permissions={create:app.admin.has('marketplace.create'),update:app.admin.has('marketplace.update'),delete:app.admin.has('marketplace.delete'),publish:app.admin.has('marketplace.publish'),order:app.admin.has('marketplace.order'),assets:app.admin.has('marketplace.assets')};
    const [cat, setCat] = useState(null);const[editCat,setEditCat]=useState(null);
    const cats = store.categories();

    if (cat) {
      return React.createElement('div', null,
        header({ title: cat.label, sub: 'Productos y servicios del Marketplace', onBack: () => setCat(null) }),
        React.createElement('div', { className: 'su-app-scroll', style: { padding: 16 } },
          React.createElement(window.SectionResponsibilityPanel,{sectionKey:'marketplace',allowedActions:['read','create','update','delete','publish','order','assets'],app}),
          React.createElement(CatalogEditorList, { scope: cat.scope, scopeId: cat.scopeId, editable, permissions, actor: 'Administrador' })));
    }

    const groups = [];
    cats.forEach((c) => { let g = groups.find((x) => x.title === c.group); if (!g) { g = { title: c.group, items: [] }; groups.push(g); } g.items.push(c); });

    return React.createElement('div', null,
      header({ title: 'Marketplace', sub: 'Productos y servicios de cada categoría', onBack }),
      window.ActingBanner && React.createElement(window.ActingBanner, {}),
      React.createElement('div', { className: 'su-app-scroll su-stagger', style: { padding: 16 } },
        React.createElement(window.SectionResponsibilityPanel,{sectionKey:'marketplace',allowedActions:['read','create','update','delete','publish','order','assets'],app}),
        React.createElement('div', { style: { fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: 14 } },
          'Lo que configures aquí es lo que el afiliado ve en ', React.createElement('b', { style: { color: 'var(--ink-2)' } }, '"Disponibles ahora"'), ' dentro de cada servicio. Los productos de empresas con convenio también los edita cada empresa desde su panel.'),
        permissions.create&&React.createElement('button',{onClick:()=>setEditCat({name:'',slug:'',description:'',enabled:true,sort_order:cats.length+1}),style:{display:'flex',alignItems:'center',justifyContent:'center',gap:7,width:'100%',height:44,borderRadius:13,border:'none',background:'var(--grad-guinda-soft)',color:'#fff',fontWeight:800,marginBottom:16}},React.createElement(I,{name:'plus',size:18}),'Nueva categoría'),
        groups.map((g) => React.createElement('div', { key: g.title, style: { marginBottom: 18 } },
          React.createElement('div', { style: { fontSize: 11, fontWeight: 800, letterSpacing: '.1em', color: 'var(--ink-3)', marginBottom: 9 } }, g.title.toUpperCase()),
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
            g.items.map((c) => {
              const n = store.count(c.scope, c.scopeId);
              const act = store.live(c.scope, c.scopeId).length;
              return React.createElement('button', { key: c.scope + c.scopeId, onClick: () => setCat(c), onContextMenu:(e)=>{if(permissions.update){e.preventDefault();setEditCat(store.rawCategories().find((x)=>x.id===c.id));}}, style: { display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', background: 'var(--surface)', borderRadius: 14, padding: '11px 13px', boxShadow: 'var(--neo-sm)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' } },
                React.createElement(window.IconTile, { icon: c.icon || 'cart', size: 38 }),
                React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                  React.createElement('div', { style: { fontSize: 14, fontWeight: 800, color: 'var(--ink)' } }, c.label),
                  React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 2 } }, n === 0 ? 'Sin productos' : n + ' producto(s) · ' + act + ' visible(s)')),
                React.createElement(I, { name: 'chevR', size: 19, stroke: 2.2, style: { color: 'var(--ink-3)', flexShrink: 0 } }));
            })))),
        editable && React.createElement('button', {
          disabled:true,
          style: { display: 'flex', alignItems: 'center', gap: 7, margin: '4px auto 0', background: 'none', border: 'none', color: 'var(--ink-3)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' },
        }, React.createElement(I, { name: 'shield', size: 15, stroke: 2 }), 'Catálogo protegido'),
        editCat&&React.createElement(CategoryEditor,{item:editCat,store,onClose:()=>setEditCat(null)})));
  }

  function CategoryEditor({ item, store, onClose }) {
    const [d,setD]=useState(()=>Object.assign({},item));
    const [err,setErr]=useState('');
    const [busy,setBusy]=useState(false);
    const set=(key,value)=>setD((old)=>Object.assign({},old,{[key]:value}));
    const save=async()=>{if(!String(d.name||'').trim()||!String(d.slug||'').trim()){setErr('Nombre y slug son obligatorios.');return;}try{setBusy(true);await store.saveCategory(d);onClose();}catch(_){setErr('No se pudo guardar la categoría.');setBusy(false);}};
    return React.createElement('div',{style:{position:'absolute',inset:0,zIndex:79,background:'var(--bg)',display:'flex',flexDirection:'column'}},
      React.createElement('div',{style:{display:'flex',alignItems:'center',padding:12,background:'var(--surface)'}},
        React.createElement('button',{onClick:onClose,style:{width:40,height:40,border:'none',background:'none'}},React.createElement(I,{name:'close',size:22})),
        React.createElement('b',{style:{flex:1}},d.id?'Editar categoría':'Nueva categoría')),
      React.createElement('div',{className:'su-app-scroll',style:{padding:16}},
        React.createElement('label',{style:lbl},'Nombre'),
        React.createElement('input',{value:d.name||'',onChange:(e)=>set('name',e.target.value),style:{...inputBase,marginBottom:12}}),
        React.createElement('label',{style:lbl},'Slug'),
        React.createElement('input',{value:d.slug||'',onChange:(e)=>set('slug',e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'-')),style:{...inputBase,marginBottom:12}}),
        React.createElement('label',{style:lbl},'Descripción'),
        React.createElement('textarea',{value:d.description||'',onChange:(e)=>set('description',e.target.value),style:{...inputBase,marginBottom:12}}),
        err&&React.createElement('div',{style:{color:'#C0341D',fontWeight:700,marginBottom:10}},err),
        React.createElement(window.Btn,{full:true,icon:'check',disabled:busy,onClick:save},busy?'Guardando…':'Guardar')));
  }

  Object.assign(window, { MarketplaceModule, CatalogEditorList });
})();
