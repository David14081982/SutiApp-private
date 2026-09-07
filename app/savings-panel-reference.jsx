/* Presentational components reconstructed from the owner-supplied reference.
   No demo store, generated savers, financial calculations or persistence. */
(function(){
 const I=window.Icon;
 const M=n=>n==null?'Por confirmar':typeof n!=='number'||!Number.isFinite(n)?'Por revisar':new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n);
 const MD=M;
 const fmt=d=>{if(!d)return 'Sin fecha';const date=new Date(d+'T12:00:00Z');return !/^\d{4}-\d{2}-\d{2}$/.test(d)||Number.isNaN(+date)||date.toISOString().slice(0,10)!==d?'Fecha por revisar':date.toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});};
 const estados={ahorrando:{label:'Ahorrando',fg:'#13794A'},pausado:{label:'Sin descuento',fg:'#9A6100'},baja:{label:'Dejó de ahorrar',fg:'#C0341D'},revision:{label:'Por revisar',fg:'#9A6100'}};
 const St=()=>({fmt,estadoDe:a=>estados[a.estado]||estados.revision,ultimoDescuento:a=>a.ultimo,saldo:a=>a.saldo});
  function KPIs({
    k,
    onGo
  }) {
    const cob = k.cobranza;
    return React.createElement('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    },
    // cifra dominante
    React.createElement('div', {
      style: {
        background: 'var(--grad-guinda)',
        color: '#fff',
        borderRadius: 20,
        padding: '17px 18px',
        boxShadow: 'var(--glow-guinda)',
        position: 'relative',
        overflow: 'hidden'
      }
    }, React.createElement('div', {
      style: {
        position: 'absolute',
        right: -26,
        top: -22,
        opacity: .13
      }
    }, React.createElement(I, {
      name: 'piggy',
      size: 130,
      stroke: 1.4
    })), React.createElement('div', {
      style: {
        fontSize: 11.5,
        fontWeight: 800,
        letterSpacing: '.05em',
        opacity: .9
      }
    }, 'AHORRO DE TODOS LOS AFILIADOS'), React.createElement('div', {
      style: {
        fontSize: 34,
        fontWeight: 900,
        letterSpacing: '-.03em',
        marginTop: 4,
        fontVariantNumeric: 'tabular-nums'
      }
    }, M(k.total)), React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        marginTop: 8,
        fontSize: 12.5,
        fontWeight: 700,
        opacity: .92
      }
    }, React.createElement(I, {
      name: 'users',
      size: 15,
      stroke: 2.2
    }), k.activos + ' ahorrando al corte', React.createElement('span', {
      style: {
        opacity: .5
      }
    }, '·'), k.afiliados + ' en el padrón')),
    // apoyos
    React.createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10
      }
    }, React.createElement('button', {
      onClick: () => onGo('cobranza'),
      style: tile()
    }, head('calendar', 'PRÓXIMO DESCUENTO'), React.createElement('div', {
      style: {
        fontSize: 20,
        fontWeight: 900,
        color: 'var(--ink)',
        letterSpacing: '-.02em',
        marginTop: 5
      }
    }, St().fmt(k.prox)), React.createElement('div', {
      style: {
        fontSize: 12,
        fontWeight: 700,
        color: 'var(--ink-2)',
        marginTop: 3
      }
    }, 'Ahorro previsto'), React.createElement('div', {
      style: {
        fontSize: 15.5,
        fontWeight: 900,
        color: 'var(--guinda)',
        fontVariantNumeric: 'tabular-nums'
      }
    }, M(k.porRecibir))), React.createElement('button', {
      onClick: () => onGo('cobranza'),
      style: tile()
    }, head('trending', 'ÚLTIMO PERIODO'), React.createElement('div', {
      style: {
        fontSize: 20,
        fontWeight: 900,
        color: cob.pct >= 95 ? '#13794A' : '#9A6100',
        letterSpacing: '-.02em',
        marginTop: 5
      }
    }, cob.pct == null ? 'Por conciliar' : cob.pct + '% cobrado'), React.createElement('div', {
      style: {
        height: 6,
        borderRadius: 999,
        background: 'var(--hairline-strong)',
        overflow: 'hidden',
        margin: '7px 0 5px'
      }
    }, React.createElement('div', {
      style: {
        width: Math.min(100, cob.pct || 0) + '%',
        height: '100%',
        borderRadius: 999,
        background: cob.pct >= 95 ? '#13794A' : '#C68100'
      }
    })), React.createElement('div', {
      style: {
        fontSize: 11.5,
        fontWeight: 700,
        color: 'var(--ink-3)',
        fontVariantNumeric: 'tabular-nums'
      }
    }, cob.esperado==null?'Registrado: '+MD(cob.recibido):MD(cob.recibido) + ' de ' + MD(cob.esperado)))), React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        background: 'var(--surface)',
        borderRadius: 16,
        boxShadow: 'var(--neo-sm)',
        padding: '11px 14px',
        gap: 12
      }
    }, half('plus', '#13794A', k.altas, 'altas este mes'), React.createElement('div', {
      style: {
        width: 1,
        alignSelf: 'stretch',
        background: 'var(--hairline)'
      }
    }), half('logout', '#C0341D', k.bajas, 'bajas este mes')));
  }
  function tile() {
    return {
      textAlign: 'left',
      background: 'var(--surface)',
      border: 'none',
      borderRadius: 16,
      padding: '13px 14px',
      boxShadow: 'var(--neo-sm)',
      cursor: 'pointer',
      fontFamily: 'inherit'
    };
  }
  function head(icon, label) {
    return React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        color: 'var(--ink-3)'
      }
    }, React.createElement(I, {
      name: icon,
      size: 14,
      stroke: 2.2
    }), React.createElement('span', {
      style: {
        fontSize: 9.5,
        fontWeight: 900,
        letterSpacing: '.07em'
      }
    }, label));
  }
  function half(icon, color, n, label) {
    return React.createElement('div', {
      style: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 9
      }
    }, React.createElement('div', {
      style: {
        width: 30,
        height: 30,
        borderRadius: 10,
        background: color + '18',
        color,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0
      }
    }, React.createElement(I, {
      name: icon,
      size: 16,
      stroke: 2.3
    })), React.createElement('div', null, React.createElement('div', {
      style: {
        fontSize: 17,
        fontWeight: 900,
        color: 'var(--ink)',
        lineHeight: 1
      }
    }, n), React.createElement('div', {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--ink-3)',
        marginTop: 2
      }
    }, label)));
  }

  // ── Fila de ahorrador (lo que se lee sin abrir) ──────────────
  function Row({
    a,
    onOpen,
    right
  }) {
    const s = St(),
      e = s.estadoDe(a),
      ult = s.ultimoDescuento(a);
    return React.createElement('div', {
      onClick: onOpen,
      'data-savings-person-id': a.id,
      className: 'su-press svp-person',
      role: 'button', tabIndex: 0, onKeyDown: e => {if(e.key==='Enter'||e.key===' '){e.preventDefault();onOpen();}},
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        background: 'var(--surface)',
        borderRadius: 15,
        padding: '12px 13px',
        boxShadow: 'var(--neo-sm)',
        cursor: 'pointer'
      }
    }, React.createElement('div', {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }
    }, React.createElement('span', {
      style: {
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: e.fg,
        flexShrink: 0
      }
    }), React.createElement('span', {
      style: {
        fontSize: 13.5,
        fontWeight: 800,
        color: 'var(--ink)',
        whiteSpace: 'normal', overflowWrap: 'anywhere',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, a.nombre)), React.createElement('div', {
      style: {
        fontSize: 11.5,
        fontWeight: 700,
        color: 'var(--ink-3)',
        marginTop: 3
      }
    }, 'Folio ' + (a.folio || 'SIN REGISTRO') + ' · ' + M(a.aporte) + (a.proceso === 'JUB' ? ' mensual' : ['1','3'].includes(a.proceso) ? ' quincenal' : ' · frecuencia por confirmar')), React.createElement('div', {
      style: {
        fontSize: 11.5,
        fontWeight: 700,
        color: ult ? 'var(--ink-3)' : '#C0341D',
        marginTop: 2
      }
    }, ult ? 'Último descuento ' + s.fmt(ult) : 'Sin descuento registrado')), right || React.createElement('div', {
      style: {
        textAlign: 'right',
        flexShrink: 0
      }
    }, React.createElement('div', {
      style: {
        fontSize: 15.5,
        fontWeight: 900,
        color: 'var(--ink)',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-.02em'
      }
    }, M(s.saldo(a))), React.createElement('div', {
      style: {
        fontSize: 10,
        fontWeight: 900,
        color: e.fg,
        letterSpacing: '.03em',
        marginTop: 3
      }
    }, e.label.toUpperCase())), React.createElement(I, {
      name: 'chevR',
      size: 17,
      stroke: 2.4,
      style: {
        color: 'var(--ink-3)',
        flexShrink: 0
      }
    }));
  }
  function Titulo({
    children,
    sub
  }) {
    return React.createElement('div', {
      style: {
        margin: '18px 0 10px'
      }
    }, React.createElement('div', {
      style: {
        fontSize: 14.5,
        fontWeight: 900,
        color: 'var(--ink)',
        letterSpacing: '-.01em'
      }
    }, children), sub && React.createElement('div', {
      style: {
        fontSize: 12,
        fontWeight: 700,
        color: 'var(--ink-3)',
        marginTop: 3,
        lineHeight: 1.4
      }
    }, sub));
  }

  // ── Pestaña Cobranza ─────────────────────────────────────────
  function Tarjeta({
    title,
    icon,
    right,
    children,
    style
  }) {
    return React.createElement('div', {
      style: Object.assign({
        background: 'var(--surface)',
        borderRadius: 18,
        padding: 15,
        boxShadow: 'var(--neo-sm)'
      }, style)
    }, title && React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        marginBottom: 11
      }
    }, icon && React.createElement('div', {
      style: {
        width: 30,
        height: 30,
        borderRadius: 10,
        background: 'var(--guinda-50)',
        color: 'var(--guinda)',
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0
      }
    }, React.createElement(I, {
      name: icon,
      size: 16,
      stroke: 2.2
    })), React.createElement('div', {
      style: {
        flex: 1,
        fontSize: 13.5,
        fontWeight: 900,
        color: 'var(--ink)'
      }
    }, title), right), children);
  }
  function Fila({
    label,
    valor,
    tono
  }) {
    return React.createElement('div', {
      style: {
        display: 'flex',
        gap: 12,
        alignItems: 'baseline',
        padding: '10px 0',
        borderBottom: '1px solid var(--hairline)'
      }
    }, React.createElement('span', {
      style: {
        flex: 1,
        fontSize: 12.5,
        fontWeight: 700,
        color: 'var(--ink-2)'
      }
    }, label), React.createElement('span', {
      style: {
        fontSize: 13.5,
        fontWeight: 900,
        color: tono || 'var(--ink)',
        fontVariantNumeric: 'tabular-nums',
        textAlign: 'right'
      }
    }, valor));
  }

window.SavingsPanelVisual={KPIs,Row,Titulo,Tarjeta,Fila,M,fmt,estados};
})();
