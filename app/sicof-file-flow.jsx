/* Explicit file workflow. Private preparation lives only in this component. */
(function () {
  'use strict';
  const h = React.createElement;
  const FILE_LIMIT = 6 * 1024 * 1024;
  const FLOW_CSS = '.sicof-file-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.sicof-file-grid>section{min-width:0}.sicof-file-grid input[type=file]{max-width:100%;width:100%;font:inherit}.sicof-file-name{overflow-wrap:anywhere}.sicof-file-funds{display:grid;gap:9px;max-height:230px;overflow:auto;margin:12px 0}.sicof-file-grid fieldset{min-width:0;border:0;padding:0;margin:0}.sicof-file-grid legend{padding:0}.sicof-file-grid .sicof-segment{flex-wrap:wrap}.sicof-file-grid .sicof-segment button{min-width:0}.sicof-file-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}@media(max-width:760px){.sicof-file-grid{grid-template-columns:minmax(0,1fr)}}';
  const copySettings = settings => ({ ...settings, selFunds: [...(settings.selFunds || [])], yieldPeriods: [...(settings.yieldPeriods || [])] });
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  function deadline(promise, milliseconds) {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('SICOF_READ_TIMEOUT')), milliseconds); })]).finally(() => clearTimeout(timer));
  }
  function Flow({ app, onBack, header, identity, Workbench, defaultSettings, css, errorText }) {
    const [settings, setSettings] = React.useState(() => copySettings(typeof defaultSettings === 'function' ? defaultSettings() : defaultSettings));
    const [file, setFile] = React.useState(null), [prepared, setPrepared] = React.useState(null);
    const [funds, setFunds] = React.useState(null), [busy, setBusy] = React.useState('');
    const [error, setError] = React.useState(''), [notice, setNotice] = React.useState(''), [inputKey, setInputKey] = React.useState(0);
    const live = React.useRef(true), sequence = React.useRef(0), busyRef = React.useRef(false);
    React.useEffect(() => () => { live.current = false; sequence.current++; }, []);
    const valid = ticket => live.current && sequence.current === ticket && window.SicofView.contextKey() === identity;
    const rangeKey = settings.periodIni + ':' + settings.periodFin;
    const currentFunds = funds?.rangeKey === rangeKey ? funds : null;
    const datesValid = validDate(settings.periodIni) && validDate(settings.periodFin) && settings.periodIni <= settings.periodFin;
    function message(failure) {
      const code = String(failure?.code || failure?.message || '');
      if (/FILE_(?:TOO_LARGE|SIZE_OR_TYPE_INVALID)/.test(code)) return 'Selecciona un archivo .xlsx de hasta 6 MB.';
      if (/FILE_HEADERS_INVALID/.test(code)) return 'Las columnas no coinciden. Usa el archivo descargado con una sola hoja HISTORIAL P V2 y sus columnas A–O.';
      if (/FILE_SOURCE_(?:MISMATCH|CHANGED)/.test(code)) return 'El archivo no coincide con la fuente disponible. Descarga otra base con el mismo periodo y fondos, y vuelve a cargarla.';
      if (/FILE_SCOPE_REQUIRED|FILE_BASIS_INVALID/.test(code)) return 'El archivo no corresponde al periodo o los fondos seleccionados. Revisa la selección y prepara la base correspondiente.';
      if (/FILE_(?:INVALID|RESPONSE_INVALID)/.test(code)) return 'No se pudo preparar este archivo. Usa el .xlsx original, con una sola hoja HISTORIAL P V2 y las columnas A–O completas.';
      if (/RANGE|DATE/.test(code)) return 'Revisa las fechas: el inicio debe ser anterior o igual al cierre.';
      return typeof errorText === 'function' ? errorText(failure) : 'No se completó la consulta. Puedes volver a intentarlo.';
    }
    async function run(name, action, complete) {
      if (busyRef.current || !live.current || window.SicofView.contextKey() !== identity) return;
      const ticket = ++sequence.current;
      busyRef.current = true; setBusy(name); setError(''); setNotice('');
      try {
        const response = await deadline(Promise.resolve().then(action), name === 'prepare' ? 60000 : 30000);
        if (valid(ticket)) complete(response);
      } catch (failure) { if (valid(ticket)) setError(message(failure)); }
      finally { if (valid(ticket)) { busyRef.current = false; setBusy(''); } }
    }
    function requireDates(command) {
      if (!validDate(command.periodIni) || !validDate(command.periodFin) || command.periodIni > command.periodFin) throw Error('SICOF_RANGE_INVALID');
    }
    function acceptFunds(response, command) {
      if (!Array.isArray(response?.funds) || response.funds.some(value => typeof value !== 'string' || !value.trim() || value !== value.trim())) throw Error('SICOF_RESPONSE_INVALID');
      setFunds({ rangeKey: command.periodIni + ':' + command.periodFin, values: [...new Set(response.funds)], observed_at: response.observed_at });
    }
    function loadFunds(command = settings, force = false) {
      if (!force && funds?.rangeKey === command.periodIni + ':' + command.periodFin) return;
      const snapshot = copySettings(command);
      run('funds', () => { requireDates(snapshot); return window.SicofFileRepository.funds({ from: snapshot.periodIni, to: snapshot.periodFin }); }, response => acceptFunds(response, snapshot));
    }
    function chooseSource(src) {
      if (busyRef.current) return;
      const next = { ...settings, src };
      setSettings(next); setError(''); setNotice('');
      // Choosing this option is the explicit request; mounting never reads data.
      if (src === 'sel') loadFunds(next);
    }
    function changeDate(key, value) {
      if (busyRef.current) return;
      setSettings(previous => ({ ...previous, [key]: value })); setError(''); setNotice('');
    }
    function download() {
      const snapshot = copySettings(settings);
      run('download', () => { requireDates(snapshot); return window.SicofFileRepository.downloadSource(snapshot); }, response => {
        if (response?.funds) acceptFunds(response, snapshot);
        setNotice('Base descargada. Selecciona ese archivo en el paso 2 para preparar el cálculo.');
      });
    }
    function selectFile(event) {
      if (busyRef.current) return;
      const selected = event.target.files?.[0] || null;
      setError(''); setNotice('');
      if (!selected) { setFile(null); return; }
      if (!/\.xlsx$/i.test(selected.name) || selected.size < 1 || selected.size > FILE_LIMIT) {
        setFile(null); setError(message(Error('SICOF_FILE_SIZE_OR_TYPE_INVALID'))); event.target.value = ''; return;
      }
      setFile(selected);
    }
    function prepare(event) {
      event.preventDefault();
      const selected = file, snapshot = copySettings(settings);
      if (!selected) { setError('Selecciona el archivo .xlsx que quieres utilizar.'); return; }
      run('prepare', () => { requireDates(snapshot); return window.SicofFileRepository.prepare(selected, snapshot); }, response => {
        // Repository already unwraps the authenticated {context,data} envelope.
        if (!response?.workspace || !response.result || response.simulation?.mode !== 'FILE' || !response.file) throw Error(response?.calculation_error || 'SICOF_FILE_RESPONSE_INVALID');
        setPrepared({ response, file: selected, settings: snapshot, metadata: response.file });
      });
    }
    function replaceFile() {
      sequence.current++; busyRef.current = false; setBusy(''); setPrepared(null); setFile(null);
      setError(''); setNotice(''); setInputKey(value => value + 1);
    }
    if (prepared) return h(Workbench, { app, onBack, header, identity, initialResponse: prepared.response, fileSession: { file: prepared.file, settings: prepared.settings, metadata: prepared.metadata }, onReplaceFile: replaceFile });
    const button = (text, action, disabled, secondary) => h('button', { type: 'button', className: 'sicof-btn' + (secondary ? ' secondary' : ''), disabled, onClick: action }, text);
    return h('div', { className: 'sicof', 'data-admin-view': 'sicof', 'data-sicof-phase': busy ? 'preparing-file' : 'select-file' },
      h('style', null, (css || '') + '\n' + FLOW_CSS), header && header({ title: 'Sicof', sub: 'Rendimientos y seguimiento por periodo', onBack }),
      h('div', { className: 'su-app-scroll sicof-content' },
        h('div', { className: 'sicof-title-row' }, h('div', null, h('h1', null, 'Simulador de Rendimiento'), h('p', { className: 'sicof-sub' }, 'Descarga la base, carga el archivo y compara los escenarios con esa información.'))),
        h('div', { className: 'sicof-file-grid' },
          h('section', { className: 'sicof-panel', 'aria-labelledby': 'sicof-file-download-title' },
            h('h2', { className: 'sicof-panel-head', id: 'sicof-file-download-title' }, '1. Descarga la base de préstamos'),
            h('div', { className: 'sicof-panel-body' },
              h('p', { className: 'sicof-sub' }, 'Los registros provienen de Historial P V2, del Google Sheets Sutiapp Final. El archivo conserva una sola hoja y las columnas A–O.'),
              h('fieldset', { disabled: Boolean(busy) },
                h('div', { className: 'sicof-date-row' },
                  h('label', { className: 'sicof-field' }, h('span', null, 'Inicio'), h('input', { type: 'date', required: true, value: settings.periodIni, 'aria-label': 'Inicio del periodo', onChange: event => changeDate('periodIni', event.target.value) })),
                  h('label', { className: 'sicof-field' }, h('span', null, 'Cierre / corte'), h('input', { type: 'date', required: true, value: settings.periodFin, 'aria-label': 'Cierre del periodo', onChange: event => changeDate('periodFin', event.target.value) }))),
                h('div', { className: 'sicof-control', style: { marginTop: 16 } }, h('div', { className: 'sicof-label' }, 'Fuente de la bolsa'),
                  h('div', { className: 'sicof-segment', role: 'group', 'aria-label': 'Fuente de la bolsa' }, [['caja', 'Solo Caja de Ahorro'], ['sel', 'Fondos seleccionados'], ['todos', 'Todos']].map(([value, label]) => h('button', { key: value, type: 'button', 'aria-pressed': settings.src === value, onClick: () => chooseSource(value) }, label)))),
                settings.src === 'sel' && h('div', null,
                  h('p', { className: 'sicof-help' }, 'Caja de Ahorro siempre se incluye. Marca los fondos adicionales.'),
                  currentFunds && h('div', { className: 'sicof-file-funds', role: 'group', 'aria-label': 'Fondos adicionales' }, currentFunds.values.filter(value => value !== 'Caja de Ahorro').map(value => h('label', { className: 'sicof-check', key: value }, h('input', { type: 'checkbox', checked: settings.selFunds.includes(value), onChange: event => setSettings(previous => ({ ...previous, selFunds: event.target.checked ? [...previous.selFunds, value] : previous.selFunds.filter(item => item !== value) })) }), value))),
                  !currentFunds && busy !== 'funds' && h('p', { className: 'sicof-help' }, 'Consulta los fondos disponibles para este periodo.'),
                  button(currentFunds ? 'Volver a consultar fondos' : 'Consultar fondos', () => loadFunds(settings, true), Boolean(busy) || !datesValid, true))),
              h('div', { className: 'sicof-file-actions' }, button(busy === 'download' ? 'Descargando base…' : '↓ Descargar base de préstamos (.xlsx)', download, Boolean(busy) || !datesValid, false)),
              h('p', { className: 'sicof-help' }, 'Sólo se incluyen los fondos y las fechas seleccionados.'))),
          h('section', { className: 'sicof-panel', 'aria-labelledby': 'sicof-file-import-title' },
            h('h2', { className: 'sicof-panel-head', id: 'sicof-file-import-title' }, '2. Carga y prepara el archivo'),
            h('div', { className: 'sicof-panel-body' },
              h('p', { className: 'sicof-sub' }, 'Usa el archivo descargado sin alterar sus columnas ni registros, y conserva el mismo periodo y fondos del paso 1.'),
              h('form', { onSubmit: prepare },
                h('label', { className: 'sicof-field' }, h('span', null, 'Archivo de préstamos (.xlsx)'), h('input', { key: inputKey, type: 'file', accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'aria-label': 'Archivo de préstamos (.xlsx)', disabled: Boolean(busy), onChange: selectFile })),
                file && h('p', { className: 'sicof-help sicof-file-name' }, file.name + ' · ' + Math.max(1, Math.ceil(file.size / 1024)) + ' KB'),
                h('div', { className: 'sicof-file-actions' }, h('button', { type: 'submit', className: 'sicof-btn', disabled: Boolean(busy) || !file || !datesValid }, busy === 'prepare' ? 'Preparando archivo…' : 'Preparar cálculo con este archivo'))),
              h('p', { className: 'sicof-help' }, 'Al preparar se comprueba el archivo y se consulta una vez el ahorro de Supabase. El simulador mostrará las fechas del archivo, los préstamos y el ahorro consultado.'),
              h('p', { className: 'sicof-help' }, 'Después, los filtros compatibles utilizan la información cargada. Para otro inicio o un cierre histórico distinto, prepara una nueva base.')))),
        busy && h('p', { className: 'sicof-status', role: 'status' }, busy === 'funds' ? 'Consultando fondos disponibles…' : busy === 'download' ? 'Generando el archivo del periodo y fondos seleccionados…' : 'Comprobando el archivo y preparando la información de ahorro…'),
        error && h('p', { className: 'sicof-status error', role: 'alert' }, error),
        notice && h('p', { className: 'sicof-status success', role: 'status' }, notice)));
  }
  // A changed identity remounts every private field even if the parent omits key.
  window.SicofFileFlow = props => h(Flow, { ...props, key: props.identity });
})();
