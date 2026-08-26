/* assets-store.jsx — F1.3
   Capa de overrides del admin sobre ASSETS_REGISTRY. Persiste en localStorage.
   SIN CONSUMIDORES en F1.3. No toca otros globals en tiempo de carga:
   la suscripción a ImageSlotAPI se engancha de forma perezosa (primera lectura
   o primera suscripción), no al cargar el archivo.

   Forma de un override: { icon?: string, url?: string|null }
     icon  reemplaza el nombre de icono del registro
     url   reemplaza la imagen (data-URL o URL); null explícito = "sin imagen"
*/
(function () {
  const LS_KEY = 'suti.assets.v1';
  let data = null;                 // { [resKey]: {icon?, url?} }
  const authoritative = {};       // proyecciones runtime desde Supabase; nunca persisten
  const subs = new Set();
  let slotUnsub = null;

  function read() {
    if (data) return data;
    try { data = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; }
    catch (e) { data = {}; }
    if (typeof data !== 'object') data = {};
    return data;
  }

  function persist() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(read())); } catch (e) {}
    subs.forEach((fn) => { try { fn(); } catch (e) {} });
  }

  // Perezoso: los cambios de <image-slot> también invalidan lo que resuelva
  // el resolver, así que reemitimos. Solo se engancha si alguien usa el store.
  function attach() {
    if (slotUnsub) return;
    const api = window.ImageSlotAPI;
    if (!api || typeof api.subscribe !== 'function') return;
    slotUnsub = api.subscribe(() => subs.forEach((fn) => { try { fn(); } catch (e) {} }));
  }

  function get(key) {
    attach();
    if (Object.prototype.hasOwnProperty.call(authoritative, key)) return Object.assign({}, authoritative[key]);
    const v = read()[key];
    return v ? Object.assign({}, v) : null;
  }

  function set(key, patch) {
    if (!key || !patch || typeof patch !== 'object') return false;
    const d = read();
    const next = Object.assign({}, d[key]);
    if ('icon' in patch) { if (patch.icon) next.icon = patch.icon; else delete next.icon; }
    if ('url' in patch) { if (patch.url === undefined) delete next.url; else next.url = patch.url; }
    if (Object.keys(next).length) d[key] = next; else delete d[key];
    persist();
    return true;
  }

  function reset(key) {
    const d = read();
    if (!(key in d)) return false;
    delete d[key];
    persist();
    return true;
  }

  function clear() { data = {}; persist(); }

  function setAuthoritative(key, value) {
    if (!key || !value || typeof value !== 'object') return false;
    const next = Object.assign({}, value);
    if (JSON.stringify(authoritative[key]) === JSON.stringify(next)) return false;
    authoritative[key] = next;
    subs.forEach((fn) => { try { fn(); } catch (e) {} });
    return true;
  }

  window.assetsStore = Object.freeze({
    get,
    set,
    reset,
    clear,
    setAuthoritative,
    keys: () => Object.keys(read()),
    all: () => JSON.parse(JSON.stringify(read())),
    subscribe: (fn) => {
      if (typeof fn !== 'function') return () => {};
      attach();
      subs.add(fn);
      return () => subs.delete(fn);
    },
  });
})();
