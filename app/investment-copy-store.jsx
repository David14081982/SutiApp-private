/* Editorial copy of Suti Inversion. Supabase is the only authority: the seeded
   rows are the defaults and there is no code-side fallback text. The calculator
   (rate, bounds, terms, formula) is not part of this store by design. */
(function () {
  'use strict';
  const repo = () => window.InvestmentCopyRepository;
  const listeners = new Set();
  let values = {}, phase = 'idle', error = null, promise = null;

  const GROUPS = Object.freeze([
    { id: 'hero', label: 'Encabezado', icon: 'sparkle', items: [
      { id: 'hero.title', label: 'Título principal', area: true },
      { id: 'hero.lede.strong', label: 'Frase en negritas' },
      { id: 'hero.lede.body', label: 'Párrafo de introducción', area: true },
      { id: 'hero.rate.value', label: 'Cifra grande' },
      { id: 'hero.rate.label', label: 'Etiqueta bajo la cifra' },
      { id: 'hero.rate.annual', label: 'Equivalente anual' },
      { id: 'hero.rate.note', label: 'Nota de la tasa', area: true },
      { id: 'hero.fact.1', label: 'Dato 1' },
      { id: 'hero.fact.2', label: 'Dato 2' },
      { id: 'hero.fact.3', label: 'Dato 3' },
    ] },
    { id: 'steps', label: 'Cómo funciona', icon: 'info', items: [
      { id: 'steps.title', label: 'Título de la sección' },
      { id: 'step.1.title', label: 'Paso 1 · encabezado' },
      { id: 'step.1.body', label: 'Paso 1 · descripción', area: true },
      { id: 'step.2.title', label: 'Paso 2 · encabezado' },
      { id: 'step.2.body', label: 'Paso 2 · descripción', area: true },
      { id: 'step.3.title', label: 'Paso 3 · encabezado' },
      { id: 'step.3.body', label: 'Paso 3 · descripción', area: true },
    ] },
    { id: 'guarantees', label: 'Tu respaldo', icon: 'shield', items: [
      { id: 'guarantees.title', label: 'Título de la sección' },
      { id: 'guarantee.1.title', label: 'Garantía 1 · encabezado' },
      { id: 'guarantee.1.body', label: 'Garantía 1 · descripción', area: true },
      { id: 'guarantee.2.title', label: 'Garantía 2 · encabezado' },
      { id: 'guarantee.2.body', label: 'Garantía 2 · descripción', area: true },
      { id: 'guarantee.3.title', label: 'Garantía 3 · encabezado' },
      { id: 'guarantee.3.body', label: 'Garantía 3 · descripción', area: true },
    ] },
    { id: 'legal', label: 'Aviso legal', icon: 'doc', items: [
      { id: 'legal.note', label: 'Texto del aviso', area: true },
    ] },
  ]);
  const KEYS = Object.freeze(GROUPS.reduce((all, g) => all.concat(g.items.map((i) => i.id)), []));

  const emit = () => listeners.forEach((fn) => fn());

  async function load() {
    phase = 'loading'; error = null; emit();
    try {
      const rows = await repo().list();
      const next = {};
      rows.forEach((row) => { next[row.id] = row.value; });
      values = next; phase = 'loaded';
    } catch (e) {
      values = {}; phase = 'error'; error = e;
      console.error('Investment copy authority error', e);
    }
    emit();
    return store;
  }

  /* Non-blocking advisory: the copy may name a rate or amount the fixed
     simulation does not use. It never prevents saving. */
  function advisory(id, value) {
    const sim = window.SUTI_INVESTMENT_SIMULATION;
    if (!sim) return null;
    const monthly = Number((sim.RATE * 100).toFixed(2));
    const annual = Number((monthly * 12).toFixed(2));
    const text = String(value == null ? '' : value);
    const found = [];
    const near = (a, b) => Math.abs(a - b) < 1e-6;
    if (id === 'hero.rate.value') {
      const n = Number(text.replace(/[^\d.]/g, ''));
      if (n && !near(n, monthly)) found.push(n + '%');
    }
    text.replace(/(\d+(?:[.,]\d+)?)\s*%/g, (match, digits) => {
      const n = Number(String(digits).replace(',', '.'));
      if (!near(n, monthly) && !near(n, annual)) found.push(n + '%');
      return match;
    });
    text.replace(/\$\s*([\d,]+)/g, (match, digits) => {
      const n = Number(digits.replace(/,/g, ''));
      if (n !== sim.MIN && n !== sim.MAX) found.push('$' + n.toLocaleString('en-US'));
      return match;
    });
    if (!found.length) return null;
    return 'Este texto menciona ' + found.join(', ') + '. La simulación calcula ' + monthly + '% mensual (' + annual + '% anual) desde $' + sim.MIN.toLocaleString('en-US') + '.';
  }

  const store = {
    GROUPS, KEYS,
    state: () => ({ phase, error }),
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    text: (id) => (values[id] == null ? '' : values[id]),
    advisory,
    retry: () => { promise = null; return ensure(); },
    async save(id, value) {
      const clean = String(value == null ? '' : value).trim();
      if (!clean || clean.length > 400) return false;
      try {
        const row = await repo().save(id, clean);
        values = Object.assign({}, values, { [id]: row.value });
        emit();
        return true;
      } catch (e) {
        console.error('Investment copy save failed', e);
        return false;
      }
    },
  };
  const ensure = () => promise || (promise = load());

  window.investmentCopyStore = store;
  window.useInvestmentCopy = function () {
    const [, force] = React.useState(0);
    React.useEffect(() => store.subscribe(() => force((n) => n + 1)), []);
    React.useEffect(() => { ensure(); }, []);
    return { phase, error, t: store.text, retry: store.retry, store };
  };
})();
