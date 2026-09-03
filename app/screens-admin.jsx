/* screens-admin.jsx — Panel Administrativo: gate de acceso, menú de módulos
   y módulo de Pop-ups (listado + switch + duplicar + reordenar drag & drop).
   Exporta window.AdminScreen. */
(function () {
  const { useState, useRef, useEffect } = React;
  const I = window.Icon;
  const A = () => window.ADMIN;
  const S = () => window.adminStore;

  // ─────────────────────────────────────────────────────────────
  // Gate de acceso (Super Administrador)
  // ─────────────────────────────────────────────────────────────
  function AdminGate({ app }) {
    const admin = app.admin;
    return React.createElement('div', { style: { minHeight: '100%', background: 'var(--grad-guinda)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '30px 24px', position: 'relative', overflow: 'hidden' } },
      React.createElement('div', { style: { position: 'absolute', right: -60, top: -50, opacity: .12 } }, React.createElement(window.SutiSeal, { size: 240 })),
      React.createElement('div', { style: { position: 'relative', textAlign: 'center', color: '#fff', marginBottom: 26 } },
        React.createElement('div', { style: { width: 76, height: 76, borderRadius: 24, background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.25)', display: 'grid', placeItems: 'center', margin: '0 auto 16px', backdropFilter: 'blur(6px)' } }, React.createElement(I, { name: 'shield', size: 40, stroke: 1.8 })),
        React.createElement('h1', { style: { fontSize: 24, fontWeight: 900, margin: 0, letterSpacing: '-.02em' } }, 'Panel Administrativo'),
        React.createElement('p', { style: { fontSize: 13.5, fontWeight: 600, opacity: .85, margin: '8px 0 0', lineHeight: 1.5 } }, 'Acceso protegido y verificado para esta cuenta.')),
      React.createElement('div', { style: { position: 'relative', background: 'var(--surface)', borderRadius: 22, padding: 20, boxShadow: 'var(--shadow-lg)' } },
        React.createElement('div', { 'data-h008-admin-access': admin.phase, style: { fontSize: 14, fontWeight: 800, color: admin.phase === 'denied' ? '#A32921' : 'var(--ink)', textAlign: 'center' } }, admin.phase === 'loading' ? 'Verificando permisos…' : admin.phase === 'error' ? 'No fue posible verificar tus permisos.' : 'Tu cuenta no tiene una asignación administrativa habilitada.'),
        admin.phase === 'error' && React.createElement(window.Btn, { full: true, size: 'lg', style: { marginTop: 16 }, onClick: admin.retry }, 'Reintentar'),
        React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', textAlign: 'center', marginTop: 14, lineHeight: 1.4 } }, 'Cargo, sindicato, puesto y número de control no conceden permisos.')));
  }

  // ─────────────────────────────────────────────────────────────
  // Menú de módulos
  // ─────────────────────────────────────────────────────────────
  const MODULES = [
    { id: 'administrators', label: 'Administradores', icon: 'shield', desc: 'Altas, asignaciones y revocación', ready: true },
    { id: 'screen_permissions', label: 'Permisos por pantalla', icon: 'lock', desc: 'Responsables y acciones exactas', ready: true },
    { id: 'impersonation', label: 'Tomar control', icon: 'eye', desc: 'Atención temporal como afiliado', ready: true },
    { id: 'affiliates', label: 'Afiliados', icon: 'users', desc: 'Padrón, expedientes y solicitudes', ready: true },
    { id: 'data_exports', label: 'Datos y respaldos', icon: 'download', desc: 'XLSX y CSV por dominio autorizado', ready: true },
    { id: 'popups', label: 'Pop-ups por pantalla', icon: 'message', desc: 'Anuncios y avisos configurables', ready: true },
    { id: 'sindicato', label: 'Tu Sindicato', icon: 'fist', desc: 'Contenido de las 9 pantallas', classification: 'PRODUCTIVE_SUPABASE' },
    { id: 'requests', label: 'Solicitudes', icon: 'receipt', desc: 'Trámites de programas y productos', ready: true },
    { id: 'finanzas', label: 'Finanzas · Solicitudes', icon: 'finance', desc: 'Solicitudes de financiamiento', classification: 'PRODUCTIVE_HYBRID' },
    { id: 'savings', label: 'Caja de Ahorro', icon: 'piggy', desc: 'Participantes, ledger, solicitudes y control', classification: 'PRODUCTIVE_SHADOW' },
    { id: 'fondos', label: 'Fondos y reglas', icon: 'finance', desc: 'Visibilidad SutiApp por criterio', classification: 'PRODUCTIVE_GOOGLE_CONTROLLED' },
    { id: 'fincat', label: 'Catálogo de Finanzas', icon: 'wallet', desc: 'Secciones y productos de Finanzas', classification: 'PRODUCTIVE_HYBRID' },
    { id: 'program_products', label: 'Programas · Productos', icon: 'cart', desc: 'Productos propios, precios e imágenes', ready: true },
    { id: 'flujos', label: 'Etapas y seguimiento', icon: 'clock', desc: 'Etapas por servicio y fechas reales', classification: 'PRODUCTIVE_HYBRID' },
    { id: 'marketplace', label: 'Marketplace', icon: 'cart', desc: 'Productos, imágenes y precios por servicio', ready: true },
    { id: 'aprobaciones', label: 'Aprobación de Pop-ups', icon: 'checkCircle', desc: 'Pop-ups de empresas por revisar', classification: 'PRODUCTIVE_SUPABASE' },
    { id: 'planes', label: 'Planes de empresas', icon: 'handshake', desc: 'Beneficios, precios y ciclos de pago', ready: true },
    { id: 'membresias', label: 'Membresías', icon: 'card', desc: 'Empresas, conceptos, montos y pagos', ready: true },
    { id: 'noticias', label: 'Noticias del sindicato', icon: 'news', desc: 'Publicaciones y responsable', ready: true },
    { id: 'education', label: 'Educación y tutoriales', icon: 'book', desc: 'Recursos, enlaces e imágenes', ready: true },
    { id: 'convenios', label: 'Convenios y beneficios', icon: 'tag', desc: 'Segmentación y catálogos', classification: 'PRODUCTIVE_SUPABASE' },
    { id: 'catalogos', label: 'Catálogos de segmentación', icon: 'filter', desc: 'Sindicatos y categorías de empleado', classification: 'PRODUCTIVE_SUPABASE' },
    { id: 'roles', label: 'Roles y permisos', icon: 'users', desc: 'Ver, crear, editar, eliminar', classification: 'PRODUCTIVE_SUPABASE' },
    { id: 'pantallas', label: 'Acceso a pantallas', icon: 'lock', desc: 'Bloqueo por sindicato y categoría', classification: 'PRODUCTIVE_SUPABASE' },
    { id: 'secciones', label: 'Secciones y componentes', icon: 'grid', desc: 'Contenido y orden del frontend', classification: 'PRODUCTIVE_HYBRID' },
    { id: 'banners', label: 'Banners', icon: 'image', desc: 'Publicidad y campañas', ready: true },
    { id: 'companies_admin', label: 'Empresas', icon: 'tag', desc: 'Directorio, logos y portadas', ready: true },
    { id: 'documents_admin', label: 'Documentos y PDF', icon: 'doc', desc: 'Descargas, formatos y normas', ready: true },
    { id: 'minutes_admin', label: 'Minutas', icon: 'doc', desc: 'Minutas y archivos institucionales', ready: true },
    { id: 'programs_admin', label: 'Programas institucionales', icon: 'fist', desc: 'Contenido y enlaces institucionales', ready: true },
    { id: 'menus', label: 'Menús y botones', icon: 'menu', desc: 'Navegación de la app', classification: 'PRODUCTIVE_HYBRID' },
    { id: 'formularios', label: 'Formularios', icon: 'doc', desc: 'Campos y validaciones', classification: 'PRODUCTIVE_HYBRID' },
    { id: 'branding', label: 'Ícono e instalación', icon: 'sparkle', desc: 'Ícono e imágenes al instalar', ready: true },
  ];

  const ADMIN_DESKTOP_BREAKPOINT = 1024;
  const ADMIN_DESKTOP_QUERY = '(min-width: ' + ADMIN_DESKTOP_BREAKPOINT + 'px)';
  const MODULE_PERMISSION = Object.freeze({
    administrators:'authorization.read',screen_permissions:'authorization.read',impersonation:'affiliates.impersonate',
    affiliates:'affiliates.read',data_exports:'data_exports.read',branding:'assets.read',banners:'banners.read',popups:'popups.read',companies_admin:'companies.read',documents_admin:'documents.read',minutes_admin:'minutes.read',programs_admin:'programs.read',noticias:'news.read',education:'content.read',marketplace:'marketplace.read',program_products:'program_catalog.read',membresias:'memberships.read',planes:'company_portal.read',requests:'program_requests.read',finanzas:'program_requests.read',savings:'savings.read',fondos:'financial_criteria.visibility.read',aprobaciones:'popups.read',sindicato:'union_content.read',fincat:'workflow.read',flujos:'workflow.read',convenios:'companies.read',catalogos:'segmentation.read',roles:'authorization.read',pantallas:'segmentation.read',secciones:'content.read',menus:'content.read',formularios:'content.read'
  });
  const SECTION_MODULE = Object.freeze({noticias:'news',education:['education','tutorials'],convenios:'agreements',companies_admin:'companies',banners:'banners',popups:'popups',documents_admin:'documents',minutes_admin:'minutes',programs_admin:'programs',marketplace:'marketplace'});
  const ADMIN_DESKTOP_GROUPS = Object.freeze([
    { id:'access_control', label:'Acceso y control', icon:'shield', modules:['administrators','screen_permissions','impersonation'] },
    { id:'people', label:'Personas y operación', icon:'users', modules:['affiliates','requests','documents_admin'] },
    { id:'finance', label:'Finanzas', icon:'finance', modules:['program_products','finanzas','savings','fondos','fincat','flujos','membresias'] },
    { id:'commerce', label:'Empresas y convenios', icon:'handshake', modules:['marketplace','convenios','aprobaciones','planes','companies_admin'] },
    { id:'content', label:'Contenido', icon:'news', modules:['sindicato','noticias','education','banners','popups','minutes_admin','programs_admin'] },
    { id:'settings', label:'Acceso y configuración', icon:'settings', modules:['catalogos','roles','pantallas','secciones','menus','formularios','branding'] },
    { id:'data', label:'Datos y respaldos', icon:'download', modules:['data_exports'] },
  ]);
  const MODULE_BADGE = Object.freeze({PRODUCTIVE_SUPABASE:'ACTIVO',PRODUCTIVE_GOOGLE_CONTROLLED:'ACTIVO',PRODUCTIVE_GOOGLE_READONLY:'SOLO LECTURA',PRODUCTIVE_HYBRID:'ACTIVO',PRODUCTIVE_SHADOW:'SHADOW',BLOCKED_FINANCIAL_LEGACY:'NO DISPONIBLE',BLOCKED_EXTERNAL_SOURCE:'FUENTE EXTERNA',OWNER_DECISION_REQUIRED:'DECISIÓN REQUERIDA'});

  function adminModuleAccess(app) {
    const assignment=app.admin.assignment||{permissions:[],sectionActions:[]};
    const sectionActions=assignment.sectionActions||[];
    const sectionOnly=(assignment.permissions||[]).length===0&&sectionActions.length>0;
    const candidates=MODULES;
    const stateFor=(m)=>{
      let permission=MODULE_PERMISSION[m.id];
      if(m.id==='education'&&sectionOnly)permission=app.admin.has('education.read')?'education.read':'tutorials.read';
      if(m.id==='convenios'&&sectionOnly)permission='agreements.read';
      const sectionKeys=[].concat(SECTION_MODULE[m.id]||[]);
      const sectionAccess=sectionKeys.some((key)=>sectionActions.some((entry)=>entry.section_key===key));
      const sectionExport=m.id==='data_exports'&&sectionActions.some((x)=>x.action==='export');
      const productive=m.ready||String(m.classification||'').startsWith('PRODUCTIVE_');
      const canView=sectionExport||sectionAccess||(permission?app.admin.has(permission):productive);
      const usable=productive&&canView;
      const desktopCanView=canView;
      const desktopUsable=productive&&desktopCanView;
      return {permission,sectionAccess,sectionExport,productive,canView,usable,desktopCanView,desktopUsable,openable:usable,badge:MODULE_BADGE[m.classification]};
    };
    return {assignment,sectionOnly,stateFor,mobileModules:candidates.filter((m)=>stateFor(m).canView),desktopModules:candidates.filter((m)=>stateFor(m).desktopUsable)};
  }

  function AdminMenu({ app, onOpen, desktop, modules, header }) {
    const access=adminModuleAccess(app);
    const visibleModules=modules||access.mobileModules;
    const heading=desktop&&header?header({title:'Panel Administrativo',sub:'Cuenta administrativa autorizada'}):React.createElement(AdminHeader, { title: 'Panel Administrativo', sub: 'Cuenta administrativa autorizada' });
    return React.createElement('div', { 'data-admin-view':'menu', style:desktop?{minHeight:'100%'}:undefined },
      heading,
      React.createElement('div', { className: 'su-app-scroll su-stagger', style: desktop?{padding:'26px 28px 36px'}:{ padding: 18 } },
        React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 16, padding: '14px 16px', boxShadow: 'var(--neo-sm)', marginBottom: 18, fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' } },
          'Cada herramienta muestra su fuente productiva o el bloqueo específico que impide activarla.'),
        React.createElement('div', { style: { fontSize: 13, fontWeight: 900, color: 'var(--ink-3)', letterSpacing: '.06em', margin: '4px 0 12px' } }, 'MÓDULOS'),
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: desktop?'repeat(auto-fit,minmax(220px,1fr))':'1fr 1fr', gap: desktop?14:12 } },
          visibleModules.map((m) => {
            const moduleState=access.stateFor(m),usable=desktop?moduleState.desktopUsable:moduleState.usable,canView=desktop?moduleState.desktopCanView:moduleState.canView,openable=desktop?moduleState.desktopUsable:moduleState.openable,badge=moduleState.badge;
            return React.createElement('button', {
              key: m.id, 'data-admin-module': m.id, 'data-admin-status': m.classification|| (usable?'PRODUCTIVE_SUPABASE':'DENIED'), 'aria-disabled': !openable,
              onClick: () => { if (!openable) return app.toast('Tu cuenta no tiene acceso a esta herramienta'); onOpen(m.id); },
              style: { position: 'relative', textAlign: 'left', background: 'var(--surface)', border: desktop?'1px solid #E5E5E9':'none', borderRadius: 18, padding: desktop?18:15, boxShadow: desktop?'0 8px 24px -22px rgba(20,20,24,.55)':'var(--neo-sm)', cursor: openable?'pointer':'default', opacity: openable ? 1 : .55, fontFamily: 'inherit', minHeight:desktop?142:undefined },
            },
              React.createElement('div', { style: { width: 44, height: 44, borderRadius: 13, background: usable ? 'var(--grad-guinda-soft)' : 'var(--surface-2)', color: usable ? '#fff' : 'var(--ink-3)', display: 'grid', placeItems: 'center', boxShadow: usable ? 'var(--glow-guinda)' : 'none' } }, React.createElement(I, { name: m.icon, size: 23, stroke: 2 })),
              React.createElement('div', { style: { fontSize: 14, fontWeight: 800, color: 'var(--ink)', marginTop: 12, lineHeight: 1.2 } }, m.label),
              React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.35 } }, m.desc),
              badge
                ? React.createElement('div', { style: { position: 'absolute', top: 13, right: 13, display: 'inline-flex', alignItems: 'center', gap: 4, background: usable?'#E7F6ED':'var(--surface-2)', color: usable?'#13794A':'var(--ink-3)', fontSize: 8.5, fontWeight: 800, letterSpacing: '.03em', padding: '4px 7px', borderRadius: 999, maxWidth: 102 } }, React.createElement(I, { name: usable?'checkCircle':'lock', size: 10, stroke: 2.4 }), badge)
                : (!canView && React.createElement('div', { style: { position: 'absolute', top: 13, right: 13, display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FDEAEA', color: '#C0341D', fontSize: 9.5, fontWeight: 800, letterSpacing: '.04em', padding: '4px 8px', borderRadius: 999 } }, React.createElement(I, { name: 'ban', size: 11, stroke: 2.4 }), 'SIN ACCESO')));
          })),
        React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', textAlign: 'center', marginTop: 22, lineHeight: 1.5, padding: '0 10px' } }, 'Los cambios disponibles se guardan de forma segura y quedan registrados.')));
  }
  function statCard(icon, n, label, accent) {
    return React.createElement('div', { style: { flex: 1, background: accent ? 'var(--grad-guinda-soft)' : 'var(--surface)', color: accent ? '#fff' : 'var(--ink)', borderRadius: 16, padding: '14px 16px', boxShadow: accent ? 'var(--glow-guinda)' : 'var(--neo-sm)' } },
      React.createElement(I, { name: icon, size: 20, stroke: 2, style: { opacity: accent ? .9 : .5 } }),
      React.createElement('div', { style: { fontSize: 26, fontWeight: 900, marginTop: 6, letterSpacing: '-.02em' } }, n),
      React.createElement('div', { style: { fontSize: 11.5, fontWeight: 700, opacity: accent ? .9 : .6, marginTop: 1 } }, label));
  }

  function AdminHeader({ title, sub, onBack }) {
    return React.createElement('div', { style: { background: 'var(--header-bg, var(--grad-guinda))', color: '#fff', padding: '10px 14px 16px', position: 'relative', overflow: 'hidden' } },
      React.createElement('div', { style: { position: 'absolute', right: -40, top: -40, opacity: .12 } }, React.createElement(window.SutiSeal, { size: 150 })),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, position: 'relative' } },
        onBack && React.createElement('button', { onClick: onBack, 'aria-label':'Volver al panel administrativo', title:'Volver', style: { width: 40, height: 40, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,.16)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#fff', flexShrink: 0 } }, React.createElement(I, { name: 'arrowL', size: 22, stroke: 2 })),
        !onBack && React.createElement('div', { style: { width: 42, height: 42, borderRadius: 13, background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.22)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: 'shield', size: 24, stroke: 2 })),
        React.createElement('div', { style: { flex: 1, minWidth: 0 } },
          React.createElement('div', { style: { fontSize: 19, fontWeight: 900, letterSpacing: '-.02em', lineHeight: 1.1 } }, title),
          sub && React.createElement('div', { style: { fontSize: 12, fontWeight: 600, opacity: .82, marginTop: 2 } }, sub)),
        React.createElement('button', { onClick: () => window.AffiliateAuth.signOut(), 'aria-label': 'Cerrar sesión', style: { width: 40, height: 40, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,.16)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#fff', flexShrink: 0 } }, React.createElement(I, { name: 'logout', size: 20, stroke: 2 }))));
  }

  function useAdminDesktop() {
    const [desktop,setDesktop]=useState(()=>Boolean(window.matchMedia&&window.matchMedia(ADMIN_DESKTOP_QUERY).matches));
    useEffect(()=>{
      if(!window.matchMedia)return;
      const media=window.matchMedia(ADMIN_DESKTOP_QUERY),change=()=>setDesktop(media.matches);
      change();
      if(media.addEventListener)media.addEventListener('change',change);else media.addListener(change);
      return ()=>{if(media.removeEventListener)media.removeEventListener('change',change);else media.removeListener(change);};
    },[]);
    return desktop;
  }

  function AdminDesktopHeader({ title, sub, onBack }) {
    return React.createElement('header', { 'data-admin-desktop-header':'true', style:{position:'sticky',top:0,zIndex:12,minHeight:82,display:'flex',alignItems:'center',gap:14,padding:'14px 28px',background:'rgba(255,255,255,.96)',borderBottom:'1px solid #E3E3E7',backdropFilter:'blur(14px)'} },
      onBack&&React.createElement('button',{onClick:onBack,'aria-label':'Volver al panel administrativo',style:{width:40,height:40,borderRadius:12,border:'1px solid #E4E4E8',background:'#F7F7F8',color:'#343438',display:'grid',placeItems:'center',cursor:'pointer',flexShrink:0}},React.createElement(I,{name:'arrowL',size:20,stroke:2.1})),
      !onBack&&React.createElement('div',{style:{width:40,height:40,borderRadius:12,background:'#F5E9ED',color:'#8A1538',display:'grid',placeItems:'center',flexShrink:0}},React.createElement(I,{name:'shield',size:21,stroke:2.1})),
      React.createElement('div',{style:{flex:1,minWidth:0}},
        React.createElement('div',{style:{fontSize:11,fontWeight:800,letterSpacing:'.08em',textTransform:'uppercase',color:'#8A1538',marginBottom:3}},'Panel administrativo'),
        React.createElement('h1',{tabIndex:-1,style:{fontSize:22,fontWeight:800,letterSpacing:'-.025em',lineHeight:1.12,color:'#202024',margin:0,outline:'none'}},title),
        sub&&React.createElement('div',{style:{fontSize:12.5,fontWeight:600,color:'#73737A',marginTop:3,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},sub)),
      React.createElement('div',{style:{display:'inline-flex',alignItems:'center',gap:7,padding:'8px 11px',borderRadius:999,background:'#E8F5EE',color:'#176B47',fontSize:11.5,fontWeight:800,whiteSpace:'nowrap'}},React.createElement(I,{name:'checkCircle',size:15,stroke:2.2}),'Acceso verificado'),
      React.createElement('button',{onClick:()=>window.AffiliateAuth.signOut(),'aria-label':'Cerrar sesión',title:'Cerrar sesión',style:{width:40,height:40,borderRadius:12,border:'1px solid #E4E4E8',background:'#fff',color:'#57575E',display:'grid',placeItems:'center',cursor:'pointer',flexShrink:0}},React.createElement(I,{name:'logout',size:19,stroke:2})));
  }

  function AdminDesktopSidebar({ app, modules, activeView, onOpen }) {
    const byId={};modules.forEach((m)=>{byId[m.id]=m;});
    const groups=ADMIN_DESKTOP_GROUPS.map((g)=>Object.assign({},g,{items:g.modules.map((id)=>byId[id]).filter(Boolean)})).filter((g)=>g.items.length);
    const initial={};groups.forEach((g,i)=>{initial[g.id]=g.modules.includes(activeView)||(activeView==='menu'&&i===0);});
    const [expanded,setExpanded]=useState(initial);
    useEffect(()=>{const group=groups.find((g)=>g.modules.includes(activeView));if(group)setExpanded((current)=>current[group.id]?current:Object.assign({},current,{[group.id]:true}));},[activeView]);
    const assignment=app.admin.assignment||{permissions:[],sectionActions:[]};
    const sectionOnly=(assignment.permissions||[]).length===0&&(assignment.sectionActions||[]).length>0;
    return React.createElement('aside',{ 'data-admin-desktop-sidebar':'true', style:{width:264,minWidth:264,height:'100%',minHeight:0,display:'flex',flexDirection:'column',background:'#18181B',color:'#fff',borderRight:'1px solid rgba(255,255,255,.04)',fontFamily:"'Manrope',var(--font)"} },
      React.createElement('div',{style:{display:'flex',alignItems:'center',gap:11,padding:'22px 20px 18px'}},
        React.createElement('div',{style:{width:38,height:38,borderRadius:12,background:'#8A1538',display:'grid',placeItems:'center',boxShadow:'0 10px 26px -12px rgba(138,21,56,.9)'}},React.createElement(I,{name:'shield',size:21,stroke:2.2})),
        React.createElement('div',null,React.createElement('div',{style:{fontSize:15,fontWeight:800,lineHeight:1.2}},'SutiApp'),React.createElement('div',{style:{fontSize:11,fontWeight:600,color:'#85858C',marginTop:2}},'Panel administrativo'))),
      React.createElement('nav',{'aria-label':'Módulos administrativos',style:{flex:1,minHeight:0,overflowY:'auto',padding:'4px 12px 18px'}},
        React.createElement('div',{style:{fontSize:10,fontWeight:800,letterSpacing:'.12em',textTransform:'uppercase',color:'#66666D',padding:'0 10px 9px'}},'Áreas'),
        React.createElement('button',{onClick:()=>onOpen('menu'),'aria-current':activeView==='menu'?'page':undefined,'data-admin-sidebar-home':'true',style:{width:'100%',height:42,display:'flex',alignItems:'center',gap:10,border:'none',borderRadius:11,padding:'0 11px',marginBottom:5,background:activeView==='menu'?'#8A1538':'transparent',color:activeView==='menu'?'#fff':'#C7C7CC',fontFamily:'inherit',fontSize:12.5,fontWeight:750,cursor:'pointer',textAlign:'left'}},React.createElement(I,{name:'grid',size:17,stroke:2}),'Resumen'),
        groups.map((group)=>{
          const open=Boolean(expanded[group.id]),active=group.modules.includes(activeView),panelId='admin-desktop-group-'+group.id;
          return React.createElement('div',{key:group.id,style:{marginBottom:4}},
            React.createElement('button',{'data-admin-sidebar-group':group.id,onClick:()=>setExpanded((current)=>Object.assign({},current,{[group.id]:!open})),'aria-expanded':open,'aria-controls':panelId,style:{width:'100%',height:42,display:'flex',alignItems:'center',gap:10,border:'none',borderRadius:11,padding:'0 10px',background:active&&!open?'rgba(138,21,56,.22)':'transparent',color:active?'#fff':'#B8B8BE',fontFamily:'inherit',fontSize:12.5,fontWeight:750,cursor:'pointer',textAlign:'left'}},
              React.createElement(I,{name:group.icon,size:17,stroke:1.9}),React.createElement('span',{style:{flex:1}},group.label),React.createElement(I,{name:open?'chevD':'chevR',size:13,stroke:2.2})),
            open&&React.createElement('div',{id:panelId,role:'group','aria-label':group.label,style:{display:'flex',flexDirection:'column',gap:2,padding:'2px 0 6px 12px'}},group.items.map((m)=>{
              const selected=activeView===m.id;
              return React.createElement('button',{key:m.id,'data-admin-sidebar-module':m.id,onClick:()=>onOpen(m.id),'aria-current':selected?'page':undefined,title:m.label,style:{width:'100%',minHeight:36,display:'flex',alignItems:'center',gap:9,border:'none',borderRadius:9,padding:'7px 10px',background:selected?'rgba(138,21,56,.92)':'transparent',color:selected?'#fff':'#9999A1',fontFamily:'inherit',fontSize:11.5,fontWeight:selected?750:650,cursor:'pointer',textAlign:'left',lineHeight:1.25}},React.createElement('span',{'aria-hidden':'true',style:{width:5,height:5,borderRadius:'50%',background:selected?'#fff':'#55555B',flexShrink:0}}),React.createElement('span',{style:{overflow:'hidden',textOverflow:'ellipsis'}},m.label));
            })));
        })),
      React.createElement('div',{style:{padding:'14px 16px 18px',borderTop:'1px solid rgba(255,255,255,.07)'}},
        React.createElement('div',{style:{display:'flex',alignItems:'center',gap:10}},
          React.createElement('div',{style:{width:36,height:36,borderRadius:11,display:'grid',placeItems:'center',background:'#29292D',color:'#D7D7DB'}},React.createElement(I,{name:'users',size:18,stroke:2})),
          React.createElement('div',{style:{flex:1,minWidth:0}},React.createElement('div',{style:{fontSize:12.5,fontWeight:800,color:'#F1F1F3'}},sectionOnly?'Responsable de sección':'Administrador'),React.createElement('div',{style:{fontSize:10.5,fontWeight:600,color:'#77777E',marginTop:2}},'Cuenta autorizada')),
          React.createElement('button',{onClick:()=>window.AffiliateAuth.signOut(),'aria-label':'Cerrar sesión',title:'Cerrar sesión',style:{width:34,height:34,border:'none',borderRadius:10,display:'grid',placeItems:'center',background:'transparent',color:'#8D8D94',cursor:'pointer'}},React.createElement(I,{name:'logout',size:17,stroke:2})))));
  }

  function AdminDesktopContextPanel({ title, onClose, children }) {
    return React.createElement('aside',{'data-admin-context-panel':'true','aria-label':title||'Contexto',style:{width:320,minWidth:280,maxWidth:'34vw',height:'100%',overflowY:'auto',background:'#fff',borderLeft:'1px solid #E3E3E7',padding:20}},
      React.createElement('div',{style:{display:'flex',alignItems:'center',gap:10,marginBottom:16}},React.createElement('strong',{style:{flex:1,fontSize:14.5,color:'#242428'}},title||'Contexto'),onClose&&React.createElement('button',{onClick:onClose,'aria-label':'Cerrar panel de contexto',style:{width:34,height:34,borderRadius:10,border:'1px solid #E5E5E9',background:'#fff',display:'grid',placeItems:'center',cursor:'pointer'}},React.createElement(I,{name:'close',size:17,stroke:2}))),children);
  }

  function AdminDesktopShell({ app, modules, activeView, onOpen, contextPanel, children }) {
    return React.createElement('div',{'data-admin-desktop-shell':'true',style:{height:'100%',minHeight:0,display:'flex',background:'#EEEEF1',color:'#242428',fontFamily:"'Manrope',var(--font)"}},
      React.createElement(AdminDesktopSidebar,{app,modules,activeView,onOpen}),
      React.createElement('div',{style:{flex:1,minWidth:0,minHeight:0,display:'flex',position:'relative'}},
        React.createElement('main',{id:'admin-desktop-workspace','data-admin-desktop-workspace':'true',style:{flex:1,minWidth:0,height:'100%',overflowY:'auto',overflowX:'hidden',background:'#F1F1F4'}},React.createElement('div',{className:'admin-desktop-module-host',style:{position:'relative',width:'100%',maxWidth:1440,minHeight:'100%',margin:'0 auto'}},children)),
        contextPanel&&React.createElement(AdminDesktopContextPanel,contextPanel)));
  }

  const ADMIN_FOCUSABLE='button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  function useAdminOverlayFocus(open,ref,onClose) {
    useEffect(()=>{
      if(!open||!ref.current)return;
      const previous=document.activeElement,node=ref.current;
      const focusables=()=>Array.from(node.querySelectorAll(ADMIN_FOCUSABLE)).filter((item)=>item.getAttribute('aria-hidden')!=='true');
      const timer=requestAnimationFrame(()=>{const target=node.querySelector('[data-autofocus]')||focusables()[0]||node;target.focus();});
      const keydown=(event)=>{
        if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose&&onClose();return;}
        if(event.key!=='Tab')return;
        const items=focusables();if(!items.length){event.preventDefault();node.focus();return;}
        const first=items[0],last=items[items.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      };
      const focusin=(event)=>{
        if(event.target&&event.target.hasAttribute&&event.target.hasAttribute('data-admin-focus-guard')){
          const items=focusables(),edge=event.target.getAttribute('data-admin-focus-guard'),target=edge==='start'?items[items.length-1]:items[0];if(target)target.focus();return;
        }
        if(node.contains(event.target))return;
        const items=focusables(),target=items[0]||node;target.focus();
      };
      document.addEventListener('keydown',keydown,true);
      document.addEventListener('focusin',focusin,true);
      node.addEventListener('keydown',keydown);
      return ()=>{cancelAnimationFrame(timer);document.removeEventListener('keydown',keydown,true);document.removeEventListener('focusin',focusin,true);node.removeEventListener('keydown',keydown);if(previous&&previous.focus)previous.focus();};
    },[open,onClose]);
  }

  function AdminDesktopDrawer({ open, title, subtitle, onClose, children }) {
    const ref=useRef(null),labelId=React.useId();useAdminOverlayFocus(open,ref,onClose);
    if(!open)return null;
    const node=React.createElement('div',{'data-admin-overlay':'drawer','data-admin-drawer':'true',onMouseDown:(event)=>{if(event.target===event.currentTarget&&onClose)onClose();},style:{position:'fixed',inset:0,zIndex:300,display:'flex',justifyContent:'flex-end',background:'rgba(17,17,20,.46)',backdropFilter:'blur(2px)'}},
      React.createElement('section',{ref,role:'dialog','aria-modal':'true','aria-labelledby':labelId,tabIndex:-1,onKeyDown:(event)=>{if(event.key==='Escape'&&onClose){event.preventDefault();onClose();}},style:{width:'min(520px,100vw)',height:'100%',display:'flex',flexDirection:'column',background:'#fff',boxShadow:'-24px 0 70px -28px rgba(0,0,0,.55)',outline:'none'}},
        React.createElement('header',{style:{display:'flex',alignItems:'center',gap:12,padding:'18px 20px',borderBottom:'1px solid #E5E5E9'}},React.createElement('div',{style:{flex:1,minWidth:0}},React.createElement('h2',{id:labelId,style:{margin:0,fontSize:18,fontWeight:800,color:'#242428'}},title),subtitle&&React.createElement('div',{style:{marginTop:3,fontSize:12,color:'#76767D',fontWeight:600}},subtitle)),React.createElement('button',{'data-autofocus':'true',onClick:onClose,'aria-label':'Cerrar panel',style:{width:38,height:38,borderRadius:11,border:'1px solid #E5E5E9',background:'#fff',display:'grid',placeItems:'center',cursor:'pointer'}},React.createElement(I,{name:'close',size:19,stroke:2}))),
        React.createElement('div',{className:'su-app-scroll',style:{flex:1,minHeight:0,overflowY:'auto',padding:20}},children)));
    return ReactDOM.createPortal(node,document.body);
  }

  function AdminDesktopModal({ open, title, description, onCancel, onClose, onConfirm, cancelLabel, confirmLabel, danger, busy, children }) {
    const close=onCancel||onClose,ref=useRef(null),labelId=React.useId(),descId=React.useId();useAdminOverlayFocus(open,ref,close);
    if(!open)return null;
    const node=React.createElement('div',{'data-admin-overlay':'modal','data-admin-modal':danger?'danger':'confirm',onMouseDown:(event)=>{if(event.target===event.currentTarget&&close)close();},style:{position:'fixed',inset:0,zIndex:320,display:'grid',placeItems:'center',padding:20,background:'rgba(17,17,20,.5)',backdropFilter:'blur(3px)'}},
      React.createElement('section',{ref,role:'dialog','aria-modal':'true','aria-labelledby':labelId,'aria-describedby':description?descId:undefined,tabIndex:-1,onKeyDown:(event)=>{if(event.key==='Escape'&&close){event.preventDefault();close();}},style:{width:'min(480px,100%)',background:'#fff',borderRadius:20,boxShadow:'0 28px 90px -32px rgba(0,0,0,.65)',padding:22,outline:'none'}},
        React.createElement('h2',{id:labelId,style:{margin:0,fontSize:20,fontWeight:800,color:'#242428',letterSpacing:'-.02em'}},title),
        description&&React.createElement('p',{id:descId,style:{margin:'8px 0 0',fontSize:13.5,fontWeight:600,lineHeight:1.5,color:'#6E6E75'}},description),
        children&&React.createElement('div',{style:{marginTop:18}},children),
        React.createElement('div',{style:{display:'flex',justifyContent:'flex-end',gap:10,marginTop:22}},
          close&&React.createElement('button',{'data-autofocus':'true',onClick:close,disabled:busy,style:{minWidth:104,height:42,borderRadius:11,border:'1px solid #DEDEE3',background:'#fff',color:'#494950',fontFamily:'inherit',fontWeight:800,cursor:'pointer'}},cancelLabel||'Cancelar'),
          onConfirm&&React.createElement('button',{onClick:onConfirm,disabled:busy,style:{minWidth:112,height:42,borderRadius:11,border:'none',background:danger?'#B3261E':'#8A1538',color:'#fff',fontFamily:'inherit',fontWeight:800,cursor:busy?'wait':'pointer',opacity:busy?0.7:1}},busy?'Procesando…':(confirmLabel||(danger?'Eliminar':'Confirmar'))))));
    return ReactDOM.createPortal(node,document.body);
  }

  // ─────────────────────────────────────────────────────────────
  // Módulo Pop-ups
  // ─────────────────────────────────────────────────────────────
  function PopupsModule({ app, onBack, onEdit }) {
    const store = useAdminStoreLocal();
    const [screenFilter, setScreenFilter] = useState('all');
    const [viewerOpen, setViewerOpen] = useState(false);
    const [previewItems, setPreviewItems] = useState(null);
    const viewer = store.viewer();
    const P = { crear: store.can('crear', 'popups'), editar: store.can('editar', 'popups'), eliminar: store.can('eliminar', 'popups'), reordenar: store.can('reordenar', 'popups') };

    const groups = A().SCREENS
      .filter((s) => screenFilter === 'all' || s.id === screenFilter)
      .map((s) => ({ screen: s, items: store.forScreen(s.id) }))
      .filter((g) => g.items.length > 0);

    return React.createElement('div', null,
      React.createElement(AdminHeader, { title: 'Pop-ups por pantalla', sub: store.all().length + ' pop-ups configurados', onBack }),
      React.createElement(window.ActingBanner, {}),
      React.createElement('div', { className: 'su-app-scroll', style: { padding: '16px 16px 24px' } },
        // barra: filtro pantalla + nuevo
        React.createElement('div', { style: { display: 'flex', gap: 10, marginBottom: 12 } },
          React.createElement('div', { style: { flex: 1, position: 'relative' } },
            React.createElement('select', { value: screenFilter, onChange: (e) => setScreenFilter(e.target.value), style: { width: '100%', appearance: 'none', WebkitAppearance: 'none', border: 'none', outline: 'none', background: 'var(--surface)', boxShadow: 'var(--neo-sm)', borderRadius: 14, padding: '13px 40px 13px 14px', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', color: 'var(--ink)', cursor: 'pointer' } },
              React.createElement('option', { value: 'all' }, 'Todas las pantallas'),
              A().SCREENS.map((s) => React.createElement('option', { key: s.id, value: s.id }, s.label))),
            React.createElement(I, { name: 'chevD', size: 18, stroke: 2.2, style: { position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' } })),
          P.crear && React.createElement('button', { onClick: () => onEdit(store.blank(screenFilter === 'all' ? 'home' : screenFilter)), style: { display: 'inline-flex', alignItems: 'center', gap: 6, height: 48, padding: '0 16px', borderRadius: 14, border: 'none', background: 'var(--grad-guinda-soft)', color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: 'var(--glow-guinda)', flexShrink: 0 } },
            React.createElement(I, { name: 'plus', size: 19, stroke: 2.6 }), 'Nuevo')),

        // previsualizar como
        React.createElement(ViewerBar, { open: viewerOpen, setOpen: setViewerOpen, viewer, store }),

        // grupos
        groups.length === 0
          ? React.createElement(window.EmptyState, { icon: 'message', title: 'Sin pop-ups', sub: 'Crea el primero con el botón “Nuevo”.', action: P.crear && React.createElement(window.Btn, { variant: 'primary', icon: 'plus', onClick: () => onEdit(store.blank('home')) }, 'Nuevo pop-up') })
          : groups.map((g) => React.createElement('div', { key: g.screen.id, style: { marginTop: 18 } },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 } },
              React.createElement('div', { style: { width: 30, height: 30, borderRadius: 9, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center' } }, React.createElement(I, { name: g.screen.icon, size: 17, stroke: 2 })),
              React.createElement('span', { style: { fontSize: 15, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-.01em' } }, g.screen.label),
              React.createElement('span', { style: { fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)', background: 'var(--surface-2)', padding: '3px 9px', borderRadius: 999 } }, g.items.length),
              g.items.length > 1 && P.reordenar && React.createElement('span', { style: { marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)' } }, React.createElement(I, { name: 'grip', size: 13, stroke: 2 }), 'arrastra para ordenar')),
            React.createElement(DragList, {
              ids: g.items.map((i) => i.id), screen: g.screen.id, store, viewer, perms: P,
              onEdit, onPreview: (p) => setPreviewItems([p]),
            }))),
      ),
      previewItems && React.createElement(window.AdminPopup, { items: previewItems, preview: true, onClose: () => setPreviewItems(null) }));
  }

  function ViewerBar({ open, setOpen, viewer, store }) {
    const seg = (label, value, options, key) => React.createElement('div', { style: { marginBottom: 12 } },
      React.createElement('div', { style: { fontSize: 11.5, fontWeight: 800, color: 'var(--ink-2)', marginBottom: 7 } }, label),
      React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 7 } },
        options.map((o) => React.createElement('button', {
          key: o, onClick: () => store.setViewer({ [key]: o }),
          style: { height: 32, padding: '0 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, background: value === o ? 'var(--guinda)' : 'var(--surface-2)', color: value === o ? '#fff' : 'var(--ink-2)', boxShadow: value === o ? 'none' : 'var(--neo-inset)' },
        }, o))));
    return React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--neo-sm)', overflow: 'hidden' } },
      React.createElement('button', { onClick: () => setOpen(!open), style: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', padding: '13px 15px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' } },
        React.createElement('div', { style: { width: 34, height: 34, borderRadius: 10, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: 'eye', size: 18, stroke: 2 })),
        React.createElement('div', { style: { flex: 1, minWidth: 0 } },
          React.createElement('div', { style: { fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' } }, 'Previsualizar como'),
          React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, viewer.cargo + ' · ' + viewer.sindicato + ' · ' + viewer.nivel + (viewer.registrado ? '' : ' · sin sesión'))),
        React.createElement(I, { name: open ? 'chevD' : 'chevR', size: 18, stroke: 2.2, style: { color: 'var(--ink-3)' } })),
      open && React.createElement('div', { style: { padding: '2px 15px 14px', borderTop: '1px solid var(--hairline)' } },
        React.createElement('div', { style: { height: 12 } }),
        seg('Cargo', viewer.cargo, A().CARGOS, 'cargo'),
        seg('Tipo de sindicato', viewer.sindicato, A().SINDICATOS, 'sindicato'),
        seg('Nivel', viewer.nivel, A().NIVELES, 'nivel'),
        React.createElement('button', { onClick: () => store.setViewer({ registrado: !viewer.registrado }), style: { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)', border: 'none', borderRadius: 11, padding: '9px 12px', cursor: 'pointer', fontFamily: 'inherit', boxShadow: 'var(--neo-inset)' } },
          React.createElement(window.Toggle, { on: viewer.registrado, size: 'sm', glow: false, }),
          React.createElement('span', { style: { fontSize: 13, fontWeight: 700, color: 'var(--ink)' } }, viewer.registrado ? 'Usuario con sesión iniciada' : 'Usuario sin sesión'))));
  }

  // ── Lista con reordenamiento por arrastre (pointer, funciona en táctil) ──
  function DragList({ ids, screen, store, viewer, perms, onEdit, onPreview }) {
    const [order, setOrder] = useState(ids);
    const orderRef = useRef(ids);
    const rowRefs = useRef({});
    const [dragId, setDragId] = useState(null);
    useEffect(() => { const j = ids.join(','); if (j !== orderRef.current.join(',')) { orderRef.current = ids; setOrder(ids); } }, [ids.join(',')]);
    const setBoth = (o) => { orderRef.current = o; setOrder(o); };

    const begin = (e, id) => {
      e.preventDefault();
      setDragId(id);
      const move = (ev) => {
        const y = ev.touches && ev.touches[0] ? ev.touches[0].clientY : ev.clientY;
        const cur = orderRef.current;
        const from = cur.indexOf(id);
        if (from < 0) return;
        let target = cur.length - 1;
        for (let i = 0; i < cur.length; i++) {
          const el = rowRefs.current[cur[i]];
          if (!el) continue;
          const r = el.getBoundingClientRect();
          if (y < r.top + r.height / 2) { target = i; break; }
        }
        if (target !== from) {
          const next = cur.filter((x) => x !== id);
          next.splice(target, 0, id);
          setBoth(next);
        }
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('touchmove', move);
        window.removeEventListener('touchend', up);
        setDragId(null);
        store.reorder(screen, orderRef.current);
      };
      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', up);
      window.addEventListener('touchmove', move, { passive: false });
      window.addEventListener('touchend', up);
    };

    window.useFlipRows(rowRefs, dragId);
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
      order.map((id, i) => {
        const p = store.get(id);
        if (!p) return null;
        const dragging = dragId === id;
        const hidden = p.enabled && !(store.dateActive(p) && store.audienceMatch(p, viewer));
        return React.createElement('div', {
          key: id, ref: (el) => { rowRefs.current[id] = el; },
          style: { position: 'relative', zIndex: dragging ? 6 : 1, transform: dragging ? 'scale(1.02)' : 'none', transition: dragging ? 'none' : 'transform .16s', boxShadow: dragging ? 'var(--shadow-lg)' : 'none', borderRadius: 16 },
        }, React.createElement(PopupRow, { p, order: i + 1, dragging, hidden, perms, onGrab: perms.reordenar ? (e) => begin(e, id) : null, onEdit, onPreview, store }));
      }));
  }

  function PopupRow({ p, order, dragging, hidden, perms, onGrab, onEdit, onPreview, store }) {
    const aud = p.audience || { mode: 'all' };
    const audLabel = { all: 'Todos', registered: 'Registrados', segment: 'Segmentado' }[aud.mode] || 'Todos';
    const iconBtn = (icon, onClick, tone) => React.createElement('button', {
      onClick: (e) => { e.stopPropagation(); onClick(); },
      style: { width: 36, height: 36, borderRadius: 11, border: 'none', background: 'var(--surface-2)', color: tone || 'var(--ink-2)', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 },
    }, React.createElement(I, { name: icon, size: 18, stroke: 2 }));

    return React.createElement('div', { style: { display: 'flex', alignItems: 'stretch', gap: 0, background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--neo-sm)', overflow: 'hidden', opacity: p.enabled ? 1 : .6 } },
      // grip (solo si puede reordenar)
      onGrab
        ? React.createElement('div', { onPointerDown: onGrab, onTouchStart: onGrab, style: { display: 'grid', placeItems: 'center', width: 34, background: 'var(--surface-2)', color: 'var(--ink-3)', cursor: 'grab', touchAction: 'none', flexShrink: 0 } }, React.createElement(I, { name: 'grip', size: 18, stroke: 2 }))
        : React.createElement('div', { style: { width: 10, flexShrink: 0 } }),
      // body (tap = editar, si tiene permiso)
      React.createElement('button', { onClick: () => (perms.editar ? onEdit(p) : onPreview(p)), style: { flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: '12px 12px', cursor: 'pointer', fontFamily: 'inherit' } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement('span', { style: { fontSize: 11, fontWeight: 900, color: 'var(--guinda)', background: 'var(--guinda-50)', minWidth: 20, height: 20, padding: '0 5px', borderRadius: 6, display: 'inline-grid', placeItems: 'center' } }, order),
          React.createElement('span', { style: { fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 } }, p.titulo || 'Sin título')),
        React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 } },
          tagChip((aud.mode === 'segment' ? 'filter' : aud.mode === 'registered' ? 'user' : 'globe'), audLabel),
          (p.startDate || p.endDate) && tagChip('calendar', 'Programado'),
          hidden && tagChip('ban', 'Oculto en vista', true),
          !p.enabled && tagChip('power', 'Inactivo'))),
      // actions
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 10px', justifyContent: 'center' } },
        iconBtn('eye', () => onPreview(p), 'var(--guinda)'),
        perms.crear && iconBtn('copy', () => store.duplicate(p.id))),
      // switch (activar/desactivar = editar)
      React.createElement('div', { style: { display: 'grid', placeItems: 'center', padding: '0 12px 0 2px' } },
        React.createElement(window.Toggle, { on: p.enabled, size: 'lg', onClick: (e) => { e.stopPropagation(); if (perms.editar) store.toggle(p.id); }, disabled: !perms.editar, 'aria-label': 'Activar', })));
  }
  function tagChip(icon, label, warn) {
    return React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: warn ? '#FDEAEA' : 'var(--surface-2)', color: warn ? '#C0341D' : 'var(--ink-3)' } },
      React.createElement(I, { name: icon, size: 12, stroke: 2.2 }), label);
  }

  // hook local (evita depender del orden de carga de window.useAdminStore)
  function useAdminStoreLocal() {
    const [, force] = useState(0);
    useEffect(() => S().subscribe(() => force((n) => n + 1)), []);
    return S();
  }

  function ClassifiedModule({ module, onBack, header }) {
    const reasons={fondos:'Las reglas financieras se consultan desde el sistema autorizado.'};
    const labels={BLOCKED_FINANCIAL_LEGACY:'No disponible',BLOCKED_EXTERNAL_SOURCE:'Fuente no disponible',OWNER_DECISION_REQUIRED:'Decisión del propietario requerida'};
    return React.createElement('div',{'data-admin-view':module.id,'data-admin-classification':module.classification},
      header({title:module.label,sub:labels[module.classification]||module.classification,onBack}),
      React.createElement('div',{className:'su-app-scroll',style:{padding:16}},
        React.createElement('div',{style:{background:'var(--surface)',borderRadius:18,padding:18,boxShadow:'var(--neo-sm)'}},
          React.createElement('div',{style:{width:48,height:48,borderRadius:14,display:'grid',placeItems:'center',background:'var(--surface-2)',color:'var(--guinda)',marginBottom:14}},React.createElement(I,{name:module.icon,size:24,stroke:2})),
          React.createElement('div',{style:{fontSize:16,fontWeight:900,color:'var(--ink)',marginBottom:8}},labels[module.classification]),
          React.createElement('div',{style:{fontSize:13,color:'var(--ink-2)',fontWeight:600,lineHeight:1.55}},reasons[module.id]),
          React.createElement('div',{style:{marginTop:14,padding:'10px 12px',borderRadius:12,background:'#FFF3DC',color:'#7A5410',fontSize:11.5,fontWeight:700,lineHeight:1.45}},'No se usa localStorage, DATA ni mocks como sustituto productivo. La interfaz Claude original permanece en el repositorio para reactivarse cuando exista autoridad aprobada.'))));
  }

  // ─────────────────────────────────────────────────────────────
  // Screen raíz del tab Admin
  // ─────────────────────────────────────────────────────────────
  function AdminScreen({ app }) {
    const [view, setView] = useState('menu');       // 'menu' | 'popups' | 'roles' | ...
    const [viewContext, setViewContext] = useState(null);
    const company=window.useCompanyStore?window.useCompanyStore():null;
    const desktop=useAdminDesktop();
    const authorized=Boolean(app.admin&&app.admin.phase==='authorized');
    useEffect(()=>{
      const root=document.documentElement;
      if(desktop&&authorized)root.setAttribute('data-admin-desktop','true');else root.removeAttribute('data-admin-desktop');
      return ()=>{root.removeAttribute('data-admin-desktop');};
    },[desktop,authorized]);

    if (!app.admin || app.admin.phase !== 'authorized') {
      if(company&&company.state().phase==='loaded'&&company.companies().length)return React.createElement(window.CompanyScreen,{app});
      return React.createElement(AdminGate, { app });
    }

    const allowedViews = ['menu'].concat(MODULES.map((m)=>m.id)).concat(['directory_admin']);
    if (!allowedViews.includes(view)) { setView('menu'); return null; }

    const access=adminModuleAccess(app);
    const activeModule=MODULES.find((m)=>m.id===view);
    if(activeModule&&!access.stateFor(activeModule).canView){setView('menu');return null;}
    const headerFn = (props) => React.createElement(desktop?AdminDesktopHeader:AdminHeader, props);
    const openView=(id)=>{setViewContext(null);setView(id);};
    const affiliateContext=viewContext&&viewContext.from==='affiliates'?viewContext:null;
    const backFromAffiliateLink=()=>{if(affiliateContext)setView('affiliates');else openView('menu');};
    const backFromEditor = () => setView(viewContext ? 'sindicato' : 'menu');
    let body;
    if (view === 'administrators') body = React.createElement(window.AdministratorsModule, { app, onBack: () => openView('menu'), header: headerFn });
    else if (view === 'screen_permissions') body = React.createElement(window.ScreenPermissionsModule, { app, onBack: () => openView('menu'), header: headerFn });
    else if (view === 'impersonation') body = React.createElement(window.ImpersonationModule, { app, onBack: () => openView('menu'), header: headerFn });
    else if (view === 'affiliates') body = React.createElement(window.AffiliatesAdminModule, { app, initialAffiliateId:affiliateContext&&affiliateContext.affiliateId, onBack: () => openView('menu'), header: headerFn, onOpenModule:(id,context)=>{setViewContext(context||null);setView(id);} });
    else if (view === 'data_exports') body = React.createElement(window.DataExportsModule, { app, onBack: () => setView('menu'), header: headerFn });
    else if (view === 'branding') body = React.createElement(window.BrandingModule, { app, onBack: () => setView('menu'), header: headerFn, canEdit: app.admin.has('assets.write') });
    else if (view === 'noticias') body = React.createElement(window.NewsModule, { app, onBack: () => setView('menu'), header: headerFn });
    else if(view==='marketplace')body=React.createElement(window.MarketplaceModule,{app,onBack:()=>setView('menu'),header:headerFn,canEdit:app.admin.has('marketplace.create')||app.admin.has('marketplace.update')});
    else if(view==='program_products')body=React.createElement(window.ProgramProductsModule,{app,onBack:()=>setView('menu'),header:headerFn});
    else if(view==='membresias')body=React.createElement(window.MembresiasModule,{app,onBack:()=>setView('menu'),header:headerFn});
    else if(view==='documents_admin')body=React.createElement(window.DocumentsAdminModule,{app,onBack:backFromAffiliateLink,header:headerFn,initialAffiliateId:affiliateContext&&affiliateContext.affiliateId});
    else if(view==='planes')body=React.createElement(window.PlanesModule,{app,onBack:()=>setView('menu'),header:headerFn});
    else if(view==='requests')body=React.createElement(window.RequestsModule,{app,onBack:backFromAffiliateLink,header:headerFn,initialAffiliateId:affiliateContext&&affiliateContext.affiliateId});
    else if(view==='finanzas')body=React.createElement(window.FinanzasModule,{app,onBack:backFromAffiliateLink,header:headerFn,initialAffiliateId:affiliateContext&&affiliateContext.affiliateId});
    else if(view==='savings')body=React.createElement(window.SavingsAdminModule,{app,onBack:backFromAffiliateLink,header:headerFn,initialAffiliateId:affiliateContext&&affiliateContext.affiliateId});
    else if(view==='fondos')body=React.createElement(window.FondosModule,{app,onBack:()=>setView('menu'),header:headerFn});
    else if(view==='aprobaciones')body=React.createElement(ApprovalsModule,{app,onBack:()=>setView('menu'),header:headerFn});
    else if(view==='sindicato')body=React.createElement(window.SindicatoModule,{app,onBack:()=>setView('menu'),header:headerFn,onOpenEditor:(id,context)=>{setViewContext(context||null);setView(id);}});
    else if(view==='fincat')body=React.createElement(window.FinCatModule,{app,onBack:()=>setView('menu'),header:headerFn});
    else if(view==='flujos')body=React.createElement(window.FlujosModule,{app,onBack:()=>setView('menu'),header:headerFn,canEdit:app.admin.has('workflow.write')});
    else if(view==='convenios')body=React.createElement(window.ConveniosModule,{app,onBack:backFromEditor,header:headerFn});
    else if(view==='catalogos')body=React.createElement(window.CatalogosModule,{app,onBack:()=>setView('menu'),header:headerFn});
    else if(view==='roles')body=React.createElement(window.RolesModule,{app,onBack:()=>setView('menu'),header:headerFn});
    else if(view==='pantallas')body=React.createElement(window.PantallasModule,{app,onBack:()=>setView('menu'),header:headerFn});
    else if(view==='secciones')body=React.createElement(window.ContentModule,{app,onBack:()=>setView('menu'),header:headerFn,resourceId:'secciones'});
    else if(view==='menus')body=React.createElement(window.ContentModule,{app,onBack:()=>setView('menu'),header:headerFn,resourceId:'menus',typeFilter:'menu',title:'Menús y botones'});
    else if(view==='formularios')body=React.createElement(window.ContentModule,{app,onBack:()=>setView('menu'),header:headerFn,resourceId:'formularios',typeFilter:'form',title:'Formularios'});
    else if((MODULES.find((m)=>m.id===view)||{}).classification&&!String((MODULES.find((m)=>m.id===view)||{}).classification).startsWith('PRODUCTIVE_'))body=React.createElement(ClassifiedModule,{module:MODULES.find((m)=>m.id===view),onBack:()=>setView('menu'),header:headerFn});
    else if (view !== 'menu') body = React.createElement(window.VisualCrudModule, { kind: view === 'companies_admin' ? 'companies' : view === 'documents_admin' ? 'documents' : view === 'minutes_admin' ? 'minutes' : view === 'programs_admin' ? 'programs' : view === 'directory_admin' ? 'directory' : view, app, onBack: backFromEditor, header: headerFn, filterKinds:viewContext&&viewContext.kinds, title:viewContext&&viewContext.title });
    else body = React.createElement(AdminMenu, { app, desktop, modules:desktop?access.desktopModules:undefined, header:headerFn, onOpen:openView });

    return desktop
      ? React.createElement(AdminDesktopShell,{app,modules:access.desktopModules,activeView:view,onOpen:openView},body)
      : React.createElement('div', { style: { minHeight: '100%', background: 'var(--bg)' } }, body);
  }

  window.AdminScreen = AdminScreen;
  window.AdminDesktopShell = AdminDesktopShell;
  window.AdminDesktopDrawer = AdminDesktopDrawer;
  window.AdminDesktopModal = AdminDesktopModal;
  window.AdminDesktopContextPanel = AdminDesktopContextPanel;
  window.ADMIN_DESKTOP_BREAKPOINT = ADMIN_DESKTOP_BREAKPOINT;
  window.AdminDesktopAccess = Object.freeze({visibleModules:(app)=>adminModuleAccess(app).desktopModules.map((m)=>m.id)});

  // ── Selector de acceso: Administrador o Empresa ──
  function AccessGate({ app }) {
    const [mode, setMode] = useState('admin');
    const seg = (id, label, icon) => React.createElement('button', { onClick: () => setMode(id), style: { flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 11, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, background: mode === id ? 'var(--surface)' : 'transparent', color: mode === id ? 'var(--guinda)' : 'rgba(255,255,255,.85)', boxShadow: mode === id ? 'var(--neo-sm)' : 'none' } }, React.createElement(I, { name: icon, size: 17, stroke: 2 }), label);
    return React.createElement('div', { style: { minHeight: '100%', position: 'relative' } },
      React.createElement('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5, padding: '14px 16px 0' } },
        React.createElement('div', { style: { display: 'flex', gap: 4, background: 'rgba(0,0,0,.25)', backdropFilter: 'blur(8px)', borderRadius: 14, padding: 4 } },
          seg('admin', 'Administrador', 'shield'), seg('empresa', 'Empresa', 'handshake'))),
      React.createElement('div', { style: { paddingTop: 4 } }, mode === 'admin' ? React.createElement(AdminGate, { app }) : React.createElement(window.CompanyGate, { app })));
  }

  // ── Cola de aprobación de Pop-ups de empresas ──
  function ApprovalsModule({ app, onBack, header }) {
    const [rej, setRej] = useState(null);
    const [reason, setReason] = useState('');
    const [rows,setRows]=useState([]);
    const [phase,setPhase]=useState('loading');
    const load=async()=>{setPhase('loading');try{setRows((await window.PopupProposalRepository.list()).slice());setPhase('loaded');}catch(_){setRows([]);setPhase('error');}};
    useEffect(()=>{load();},[]);
    const pend = rows.filter((p)=>p.status==='pending');
    const recent = rows.filter((p)=>p.status==='approved'||p.status==='rejected').slice(0,20);
    const coName = (id,p) => p.empresaNombre || ((window.companyStore&&window.companyStore.get(id)||{}).name) || id || '—';
    const approve=async(id)=>{try{await window.PopupProposalRepository.review(id,true,'');await load();app.toast&&app.toast('Pop-up aprobado como borrador');}catch(_){app.toast&&app.toast('No se pudo aprobar');}};
    const reject=async(id)=>{try{await window.PopupProposalRepository.review(id,false,reason);setRej(null);setReason('');await load();app.toast&&app.toast('Pop-up rechazado');}catch(_){app.toast&&app.toast('No se pudo rechazar');}};
    return React.createElement('div', { 'data-admin-view':'aprobaciones' },
      header({ title: 'Aprobación de Pop-ups', sub: pend.length + ' pendiente(s)', onBack }),
      React.createElement('div', { className: 'su-app-scroll', style: { padding: 16 } },
        phase==='error' ? React.createElement(window.EmptyState,{icon:'warning',title:'No fue posible cargar',sub:'Reintenta la consulta de propuestas.',actionLabel:'Reintentar',onAction:load}) :
        phase==='loading' ? React.createElement(window.EmptyState,{icon:'clock',title:'Cargando propuestas',sub:'Consultando la fuente productiva.'}) :
        pend.length === 0 ? React.createElement(window.EmptyState, { icon: 'checkCircle', title: 'Todo al día', sub: 'No hay pop-ups de empresas por revisar.' }) :
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
            pend.map((p) => React.createElement('div', { key: p.id, style: { background: 'var(--surface)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--neo-sm)' } },
              React.createElement('div', { style: { height: 120, position: 'relative', background: `linear-gradient(150deg, hsl(${p.hue || 345},70%,42%), hsl(${p.hue || 345},65%,26%))` } },
                React.createElement('image-slot', { id: p.slotId, shape: 'rect', fit: 'cover', placeholder: '', style: { position: 'absolute', inset: 0, width: '100%', height: '100%' } }),
                React.createElement('div', { style: { position: 'absolute', top: 10, left: 10 } }, React.createElement(window.Badge, { tone: 'amber', icon: 'clock' }, 'PENDIENTE'))),
              React.createElement('div', { style: { padding: 14 } },
                React.createElement('div', { style: { fontSize: 11.5, fontWeight: 800, color: 'var(--guinda)' } }, coName(p.ownerCompany,p)),
                React.createElement('div', { style: { fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginTop: 2 } }, p.titulo || 'Sin título'),
                p.contenido && React.createElement('div', { style: { fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 500, marginTop: 5, lineHeight: 1.45 } }, p.contenido),
                rej === p.id
                  ? React.createElement('div', { style: { marginTop: 12 } },
                    React.createElement('input', { value: reason, autoFocus: true, placeholder: 'Motivo del rechazo…', onChange: (e) => setReason(e.target.value), style: { width: '100%', border: 'none', outline: 'none', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', borderRadius: 12, padding: '11px 13px', fontSize: 13.5, fontFamily: 'inherit', color: 'var(--ink)', boxSizing: 'border-box', marginBottom: 10 } }),
                    React.createElement('div', { style: { display: 'flex', gap: 10 } },
                      React.createElement(window.Btn, { variant: 'outline', size: 'sm', style: { flex: 1 }, onClick: () => { setRej(null); setReason(''); } }, 'Cancelar'),
                      React.createElement(window.Btn, { size: 'sm', style: { flex: 1, background: '#C0341D', color: '#fff', boxShadow: 'none' }, disabled: !reason.trim(), onClick: () => reject(p.id) }, 'Confirmar rechazo')))
                  : React.createElement('div', { style: { display: 'flex', gap: 10, marginTop: 12 } },
                    React.createElement(window.Btn, { variant: 'outline', size: 'sm', icon: 'close', style: { flex: 1 }, onClick: () => { setRej(p.id); setReason(''); } }, 'Rechazar'),
                    React.createElement(window.Btn, { size: 'sm', icon: 'check', style: { flex: 1 }, onClick: () => approve(p.id) }, 'Aprobar')))))),
        recent.length > 0 && React.createElement('div', { style: { marginTop: 20 } },
          React.createElement('div', { style: { fontSize: 12.5, fontWeight: 900, color: 'var(--ink-3)', letterSpacing: '.05em', marginBottom: 10 } }, 'REVISADOS'),
          recent.map((p) => React.createElement('div', { key: p.id, style: { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', borderRadius: 12, padding: '10px 13px', boxShadow: 'var(--neo-sm)', marginBottom: 8 } },
            React.createElement('span', { style: { flex: 1, fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, p.titulo),
            React.createElement(window.Badge, { tone: p.status === 'approved' ? 'green' : 'red', icon: p.status === 'approved' ? 'checkCircle' : 'close' }, p.status === 'approved' ? 'Aprobado' : 'Rechazado')))) ));
  }
})();
