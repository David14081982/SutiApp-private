/* Read-only projection of the authoritative Google financial criteria. */
(function () {
  const listeners = new Set();
  let rows = [];
  let phase = 'idle';
  let error = null;
  const blocked = () => { throw new Error('FINANCIAL_LEGACY_READ_ONLY'); };
  const emit = () => listeners.forEach((fn) => fn());
  const uniq = (values) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
  function project(rule) {
    return Object.freeze({
      id: rule.criterion_identity,
      sourceId: rule.id, programId: rule.program_id, fondo: rule.fund, categoria: rule.category, sindicato: rule.union,
      tipoEmpleado: 'Todos', tipo: rule.available_on ? 'evento' : 'revolvente', fecha: rule.available_on,
      montoMax: Number(rule.max_amount), tasaQuincenal: Number(rule.rate),
      plazoQuincenas: Number(rule.payment_count), plazoLabel: rule.term_label, periodoPago: rule.payment_period,
      status: rule.status, activo: rule.effective_visibility === 'VISIBLE', readOnly: true,
      sheetRow: Number(rule.sheet_row), visibilityMode: rule.visibility_mode,
      automaticVisibility: rule.automatic_visibility, effectiveVisibility: rule.effective_visibility,
      visibilityWindowStart: rule.visibility_window_start, visibilityWindowEnd: rule.visibility_window_end,
      permanent: rule.permanent === true,
    });
  }
  async function load(force) {
    if (phase === 'loading' && !force) return;
    phase = 'loading'; error = null; emit();
    try {
      const result = await window.FinancialLegacyRepository.listCriteriaCatalog();
      rows = (result.rules || []).map(project); phase = 'ready';
    } catch (reason) { rows = []; phase = 'error'; error = reason; }
    emit();
  }
  const store = {
    load, status: () => phase, error: () => error,
    all: () => rows.slice(), get: (id) => rows.find((row) => row.id === id) || null,
    programas: () => uniq(rows.map((row) => row.programId)), fondos: () => uniq(rows.map((row) => row.fondo)), sindicatos: () => uniq(rows.map((row) => row.sindicato)), categorias: () => uniq(rows.map((row) => row.categoria)),
    query: (filters) => rows.filter((row) => (!filters || filters.fondo === 'all' || row.fondo === filters.fondo) &&
      (!filters || filters.sindicato === 'all' || row.sindicato === filters.sindicato) &&
      (!filters || filters.categoria === 'all' || row.categoria === filters.categoria) &&
      (!filters || filters.tipo === 'all' || row.tipo === filters.tipo)),
    resolve: () => [], revolventesPara: () => [], eventosVigentes: () => [],
    perfilLimites: () => null, validar: () => ({ ok: false, montoMax: 0 }),
    async setVisibility(id, mode, reason) {
      const row = rows.find((item) => item.id === id);
      if (!row) throw new Error('FINANCIAL_CRITERION_NOT_FOUND');
      await window.FinancialLegacyRepository.setCriteriaVisibility(row.id, mode, reason);
      await load(true);
      if (window.financialLegacyStore && window.financialLegacyStore.loadOverview) await window.financialLegacyStore.loadOverview();
      return rows.find((item) => item.id !== id ? false : true) || null;
    },
    blank: blocked, save: blocked, toggle: blocked, remove: blocked, duplicate: blocked, addFondo: blocked, resetAll: blocked,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
  window.FONDOS = { TIPOS: [], PLAZOS: [] };
  window.fundsStore = store;
  window.useFundsStore = function () { const [, force] = React.useState(0); React.useEffect(() => store.subscribe(() => force((n) => n + 1)), []); return store; };
})();
