/* screens-admin-roles.jsx — Módulo Roles y permisos: lista de roles,
   editor con matriz de permisos (Ver/Crear/Editar/Eliminar/Reordenar) por
   módulo del panel y por pantalla del frontend, y "Actuar como rol".
   Exporta window.RolesModule y window.ActingBanner. */
(function () {
  const { useState, useEffect } = React;
  const I = window.Icon;
  const A = () => window.ADMIN;
  const S = () => window.adminStore;

  function useStore() { const [, f] = useState(0); useEffect(() => S().subscribe(() => f((n) => n + 1)), []); return S(); }

  // Banner "Actuando como" — visible en todo el panel cuando el rol activo no es Super Admin
  function ActingBanner({ onManage }) {
    const store = useStore();
    const r = store.actingRole();
    if (r.all) return null;
    return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, background: '#FFF3DC', borderBottom: '1px solid #f0e2c2', padding: '9px 14px' } },
      React.createElement('div', { style: { width: 28, height: 28, borderRadius: 8, background: '#9A6B16', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: 'eye', size: 16, stroke: 2 })),
      React.createElement('div', { style: { flex: 1, minWidth: 0 } },
        React.createElement('div', { style: { fontSize: 12.5, fontWeight: 800, color: '#7a5410' } }, 'Vista previa como: ' + r.name),
        React.createElement('div', { style: { fontSize: 11, fontWeight: 600, color: '#9A6B16' } }, 'El panel se limita a sus permisos')),
      React.createElement('button', { onClick: () => {const principal=store.roles().find(x=>x.all);if(principal)store.setActingRole(principal.id);}, style: { border: 'none', background: '#9A6B16', color: '#fff', fontFamily: 'inherit', fontSize: 12, fontWeight: 800, padding: '7px 12px', borderRadius: 9, cursor: 'pointer', flexShrink: 0 } }, 'Salir'));
  }
  window.ActingBanner = ActingBanner;

  // ── Módulo ──
  function RolesModule({ app, onBack, header }) {
    const store = useStore();
    const [editing, setEditing] = useState(null);
    const roles = store.roles();
    const canCrear = store.can('crear', 'roles');

    return React.createElement('div', null,
      header({ title: 'Roles y permisos', sub: roles.length + ' roles definidos', onBack }),
      React.createElement('div', { className: 'su-app-scroll', style: { padding: '16px 16px 26px' } },
        React.createElement(ActingAsBar, { store }),

        React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '20px 0 12px' } },
          React.createElement('div', { style: { fontSize: 13, fontWeight: 900, color: 'var(--ink-3)', letterSpacing: '.06em' } }, 'ROLES'),
          canCrear && React.createElement('button', { onClick: () => setEditing(store.blankRole()), style: { display: 'inline-flex', alignItems: 'center', gap: 5, height: 38, padding: '0 14px', borderRadius: 12, border: 'none', background: 'var(--grad-guinda-soft)', color: '#fff', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', boxShadow: 'var(--glow-guinda)' } },
            React.createElement(I, { name: 'plus', size: 17, stroke: 2.6 }), 'Nuevo rol')),

        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 11 } },
          roles.map((r) => React.createElement(RoleCard, { key: r.id, role: r, store, onEdit: () => setEditing(r) }))),

        React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', textAlign: 'center', marginTop: 22, lineHeight: 1.5, padding: '0 8px' } }, 'Cada permiso define si el rol puede Ver, Crear, Editar, Eliminar o Reordenar cada módulo y pantalla.')),

      editing && React.createElement(RoleEditor, { role: editing, store, onClose: () => setEditing(null) }));
  }

  function ActingAsBar({ store }) {
    const [open, setOpen] = useState(false);
    const roles = store.roles();
    const cur = store.actingRole();
    return React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--neo-sm)', overflow: 'hidden' } },
      React.createElement('button', { onClick: () => setOpen(!open), style: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', padding: '13px 15px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' } },
        React.createElement('div', { style: { width: 34, height: 34, borderRadius: 10, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: 'eye', size: 18, stroke: 2 })),
        React.createElement('div', { style: { flex: 1, minWidth: 0 } },
          React.createElement('div', { style: { fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' } }, 'Previsualizar el panel como'),
          React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 1 } }, cur.name)),
        React.createElement(I, { name: open ? 'chevD' : 'chevR', size: 18, stroke: 2.2, style: { color: 'var(--ink-3)' } })),
      open && React.createElement('div', { style: { padding: '4px 15px 14px', borderTop: '1px solid var(--hairline)', display: 'flex', flexWrap: 'wrap', gap: 8 } },
        React.createElement('div', { style: { height: 6, width: '100%' } }),
        roles.map((r) => React.createElement('button', {
          key: r.id, onClick: () => store.setActingRole(r.id),
          style: { height: 34, padding: '0 13px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, background: cur.id === r.id ? 'var(--guinda)' : 'var(--surface-2)', color: cur.id === r.id ? '#fff' : 'var(--ink-2)', boxShadow: cur.id === r.id ? 'none' : 'var(--neo-inset)' },
        }, r.name))));
  }

  function RoleCard({ role, store, onEdit }) {
    const count = store.roleActionCount(role);
    const canEdit = store.can('editar', 'roles');
    const canDel = store.can('eliminar', 'roles') && !role.system;
    const canDup = store.can('crear', 'roles');
    const iconBtn = (icon, onClick, tone) => React.createElement('button', { onClick: (e) => { e.stopPropagation(); onClick(); }, style: { width: 36, height: 36, borderRadius: 11, border: 'none', background: 'var(--surface-2)', color: tone || 'var(--ink-2)', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 } }, React.createElement(I, { name: icon, size: 18, stroke: 2 }));
    return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--neo-sm)', padding: 14 } },
      React.createElement('div', { style: { width: 44, height: 44, borderRadius: 13, background: role.all ? 'var(--grad-guinda-soft)' : 'var(--guinda-50)', color: role.all ? '#fff' : 'var(--guinda)', display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: role.all ? 'var(--glow-guinda)' : 'none' } }, React.createElement(I, { name: role.system ? 'shield' : 'users', size: 23, stroke: 2 })),
      React.createElement('button', { onClick: canEdit ? onEdit : undefined, style: { flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: canEdit ? 'pointer' : 'default', fontFamily: 'inherit' } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 7 } },
          React.createElement('span', { style: { fontSize: 15.5, fontWeight: 800, color: 'var(--ink)' } }, role.name),
          role.system && React.createElement(I, { name: 'lock', size: 14, stroke: 2.2, style: { color: 'var(--ink-3)' } })),
        React.createElement('div', { style: { fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.35 } }, role.desc),
        React.createElement('div', { style: { marginTop: 8 } },
          React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: role.all ? 'var(--guinda-50)' : 'var(--surface-2)', color: role.all ? 'var(--guinda)' : 'var(--ink-3)' } },
            React.createElement(I, { name: role.all ? 'checkCircle' : 'shield', size: 12, stroke: 2.2 }), role.all ? 'Acceso total' : count + ' permisos'))),
      React.createElement('div', { style: { display: 'flex', gap: 6, flexShrink: 0 } },
        canDup && iconBtn('copy', () => store.duplicateRole(role.id)),
        canDel && iconBtn('trash', () => store.removeRole(role.id), '#C0341D')));
  }

  // ── Editor de rol + matriz de permisos ──
  function RoleEditor({ role, store, onClose }) {
    const [d, setD] = useState(() => JSON.parse(JSON.stringify(role)));
    const [openGroups, setOpenGroups] = useState({ 'Módulos del panel': true, 'Pantallas del frontend': false });
    const isNew = !store.getRole(role.id);
    const locked = !!d.all;

    const setPerm = (rid, aid, val) => setD((p) => {
      const perms = { ...p.perms, [rid]: { ...(p.perms[rid] || {}), [aid]: val } };
      return { ...p, perms };
    });
    const rowAll = (rid, on) => setD((p) => {
      const row = {}; A().ACTIONS.forEach((a) => { row[a.id] = on; });
      return { ...p, perms: { ...p.perms, [rid]: row } };
    });
    const groupAll = (items, on) => setD((p) => {
      const perms = { ...p.perms };
      items.forEach((it) => { const row = {}; A().ACTIONS.forEach((a) => { row[a.id] = on; }); perms[it.id] = row; });
      return { ...p, perms };
    });

    const save = () => { store.saveRole(d); onClose(); };
    const del = () => { store.removeRole(d.id); onClose(); };

    return React.createElement('div', { style: { position: 'absolute', inset: 0, zIndex: 70, background: 'var(--bg)', display: 'flex', flexDirection: 'column' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--hairline)', flexShrink: 0 } },
        React.createElement('button', { onClick: onClose, style: { width: 40, height: 40, borderRadius: 12, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink)' } }, React.createElement(I, { name: 'close', size: 22, stroke: 2 })),
        React.createElement('span', { style: { flex: 1, fontSize: 16.5, fontWeight: 800 } }, isNew ? 'Nuevo rol' : (locked ? 'Rol del sistema' : 'Editar rol'))),

      React.createElement('div', { className: 'su-app-scroll', style: { flex: 1, overflowY: 'auto', padding: 16 } },
        locked && React.createElement('div', { style: { display: 'flex', gap: 10, background: 'var(--guinda-50)', borderRadius: 14, padding: '13px 15px', marginBottom: 16 } },
          React.createElement(I, { name: 'shield', size: 20, stroke: 2, style: { color: 'var(--guinda)', flexShrink: 0 } }),
          React.createElement('div', { style: { fontSize: 12.5, fontWeight: 700, color: 'var(--guinda)', lineHeight: 1.45 } }, 'Super Administrador siempre tiene acceso total. Este rol no se puede modificar ni eliminar.')),

        React.createElement('div', { style: { marginBottom: 16 } },
          React.createElement('label', { style: { fontSize: 12.5, fontWeight: 800, color: 'var(--ink-2)', display: 'block', marginBottom: 7 } }, 'Nombre del rol'),
          React.createElement('input', { value: d.name, disabled: locked, placeholder: 'Ej. Coordinador de contenido', onChange: (e) => setD((p) => ({ ...p, name: e.target.value })), style: { width: '100%', border: 'none', outline: 'none', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', borderRadius: 13, padding: '13px 14px', fontSize: 14.5, fontFamily: 'inherit', color: 'var(--ink)', boxSizing: 'border-box', opacity: locked ? .6 : 1 } })),
        React.createElement('div', { style: { marginBottom: 18 } },
          React.createElement('label', { style: { fontSize: 12.5, fontWeight: 800, color: 'var(--ink-2)', display: 'block', marginBottom: 7 } }, 'Descripción'),
          React.createElement('input', { value: d.desc, disabled: locked, placeholder: 'Breve descripción', onChange: (e) => setD((p) => ({ ...p, desc: e.target.value })), style: { width: '100%', border: 'none', outline: 'none', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', borderRadius: 13, padding: '13px 14px', fontSize: 14.5, fontFamily: 'inherit', color: 'var(--ink)', boxSizing: 'border-box', opacity: locked ? .6 : 1 } })),

        // leyenda de acciones
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 12px' } },
          React.createElement('span', { style: { fontSize: 13, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-.01em' } }, 'Permisos'),
          React.createElement('div', { style: { flex: 1, height: 1, background: 'var(--hairline)' } })),
        React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 } },
          A().ACTIONS.map((a) => React.createElement('span', { key: a.id, style: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: 'var(--ink-3)' } },
            React.createElement('span', { style: { width: 22, height: 22, borderRadius: 7, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)' } }, React.createElement(I, { name: a.icon, size: 13, stroke: 2 })), a.label))),

        React.createElement('label',{'data-role-impersonation-permission':d.impersonate?'enabled':'disabled',style:{display:'flex',alignItems:'center',gap:11,marginBottom:14,padding:'13px 14px',borderRadius:14,background:'var(--surface)',boxShadow:'var(--neo-sm)',fontSize:13,fontWeight:800,color:'var(--ink)'}},
          React.createElement('input',{type:'checkbox',checked:locked||Boolean(d.impersonate),disabled:locked,onChange:e=>setD(p=>Object.assign({},p,{impersonate:e.target.checked}))}),
          React.createElement('span',null,'Tomar control de una cuenta',React.createElement('small',{style:{display:'block',marginTop:3,color:'var(--ink-3)',fontWeight:600}},'Permiso independiente · requiere motivo y dura máximo 30 minutos'))),

        A().RESOURCE_GROUPS.map((g) => {
          const on = openGroups[g.group];
          return React.createElement('div', { key: g.group, style: { marginBottom: 12, background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--neo-sm)', overflow: 'hidden' } },
            React.createElement('button', { onClick: () => setOpenGroups((o) => ({ ...o, [g.group]: !o[g.group] })), style: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', padding: '13px 14px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' } },
              React.createElement(I, { name: on ? 'chevD' : 'chevR', size: 17, stroke: 2.4, style: { color: 'var(--ink-3)' } }),
              React.createElement('span', { style: { flex: 1, fontSize: 13.5, fontWeight: 900, color: 'var(--ink)' } }, g.group),
              React.createElement('span', { style: { fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', background: 'var(--surface-2)', padding: '3px 9px', borderRadius: 999 } }, g.items.length)),
            on && React.createElement('div', { style: { padding: '0 12px 10px' } },
              !locked && React.createElement('div', { style: { display: 'flex', gap: 8, padding: '2px 2px 10px' } },
                miniBtn('Marcar todo', () => groupAll(g.items, true)),
                miniBtn('Ninguno', () => groupAll(g.items, false))),
              g.items.map((it) => React.createElement(PermRow, { key: it.id, res: it, perms: locked ? null : (d.perms[it.id] || {}), locked, onToggle: (aid, v) => setPerm(it.id, aid, v), onRowAll: (v) => rowAll(it.id, v) })))
          );
        }),
        React.createElement('div', { style: { height: 8 } })),

      React.createElement('div', { style: { display: 'flex', gap: 12, padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', background: 'var(--surface)', borderTop: '1px solid var(--hairline)', flexShrink: 0 } },
        !locked && !isNew && store.can('eliminar', 'roles') && React.createElement('button', { onClick: del, style: { width: 50, height: 50, borderRadius: 13, border: 'none', background: '#FDEAEA', color: '#C0341D', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 } }, React.createElement(I, { name: 'trash', size: 20, stroke: 2 })),
        React.createElement(window.Btn, { variant: 'outline', style: { flex: 1 }, onClick: onClose }, locked ? 'Cerrar' : 'Cancelar'),
        !locked && React.createElement(window.Btn, { variant: 'primary', icon: 'check', style: { flex: 2 }, disabled: !d.name.trim(), onClick: save }, 'Guardar rol')));
  }

  function miniBtn(label, onClick) {
    return React.createElement('button', { onClick, style: { height: 32, padding: '0 12px', borderRadius: 10, border: 'none', background: 'var(--surface-2)', color: 'var(--ink-2)', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' } }, label);
  }

  function PermRow({ res, perms, locked, onToggle, onRowAll }) {
    const allOn = locked || A().ACTIONS.every((a) => perms && perms[a.id]);
    return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px', borderTop: '1px solid var(--hairline)' } },
      React.createElement('button', { onClick: locked ? undefined : () => onRowAll(!allOn), style: { display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: locked ? 'default' : 'pointer', fontFamily: 'inherit', textAlign: 'left' } },
        React.createElement('div', { style: { width: 30, height: 30, borderRadius: 9, background: 'var(--surface-2)', color: 'var(--ink-2)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: res.icon, size: 16, stroke: 2 })),
        React.createElement('span', { style: { fontSize: 13, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, res.label)),
      React.createElement('div', { style: { display: 'flex', gap: 5, flexShrink: 0 } },
        A().ACTIONS.map((a) => {
          const on = locked || !!(perms && perms[a.id]);
          return React.createElement('button', {
            key: a.id, title: a.label, 'aria-label': a.label, disabled: locked,
            onClick: locked ? undefined : () => onToggle(a.id, !on),
            style: { width: 30, height: 30, borderRadius: 8, border: 'none', cursor: locked ? 'default' : 'pointer', display: 'grid', placeItems: 'center', background: on ? 'var(--grad-guinda-soft)' : 'var(--surface-2)', color: on ? '#fff' : 'var(--ink-3)', boxShadow: on ? 'var(--glow-guinda)' : 'var(--neo-inset)', opacity: locked ? .8 : 1 },
          }, React.createElement(I, { name: a.icon, size: 15, stroke: 2 }));
        })));
  }

  window.RolesModule = RolesModule;
})();
