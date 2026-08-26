/* One in-memory H-007 content state; Supabase remains the authority. */
(function () {
  'use strict';

  const listeners = new Set();
  let loadPromise = null;
  let state = Object.freeze({ phase: 'loading', directory: [], minutes: [], documents: [], programs: [], errorCode: null });
  const MIGRATED = Object.freeze(['comite', 'normas', 'minuta', 'finanzas', 'formatos']);
  const NAV = Object.freeze(Object.fromEntries(MIGRATED.map((id) => [id, window.UNION_SCREEN_BY_KEY[id]])));

  function publish(next) {
    state = Object.freeze(Object.assign({ phase: 'error', directory: [], minutes: [], documents: [], programs: [], errorCode: 'SOURCE_ERROR' }, next));
    listeners.forEach((listener) => listener(state));
  }

  function subscribe(listener) {
    listeners.add(listener);
    listener(state);
    return () => listeners.delete(listener);
  }

  function bootstrap() {
    if (loadPromise) return loadPromise;
    publish({ phase: 'loading', errorCode: null });
    loadPromise = Promise.all([
      window.DirectoryRepository.list(),
      window.MinutesRepository.list(),
      window.InstitutionalDocumentsRepository.list(),
      window.InstitutionalProgramsRepository.list(),
    ]).then(([directory, minutes, documents, programs]) => {
      publish({ phase: 'loaded', directory, minutes, documents, programs, errorCode: null });
      return state;
    }).catch(() => {
      publish({ phase: 'error', errorCode: 'SOURCE_ERROR' });
      return state;
    });
    return loadPromise;
  }

  function retry() {
    loadPromise = null;
    return bootstrap();
  }

  function documentBlock(row) {
    return Object.freeze({ id: row.id, kind: 'documento', titulo: row.title, texto: row.description || '', url: row.document_url || '', imageUrl: row.image_url || null });
  }

  function moduleFor(id) {
    const nav = NAV[id];
    if (!nav) return null;
    let blocks = [];
    if (state.phase === 'loaded') {
      if (id === 'comite') blocks = state.directory.map((row) => Object.freeze({ id: row.id, kind: 'texto', titulo: row.name || '—', texto: row.role, foto: row.image_url || '' }));
      if (id === 'minuta') blocks = state.minutes.map(documentBlock);
      if (id === 'normas') blocks = state.documents.filter((row) => row.kind === 'regulation').map(documentBlock);
      if (id === 'formatos') blocks = state.documents.filter((row) => row.kind === 'download' || row.kind === 'form').map(documentBlock);
      if (id === 'finanzas') blocks = state.programs.map((row) => Object.freeze({
        id: row.id, kind: 'texto', titulo: row.category, texto: row.description || '',
        url: row.whatsapp_url || row.facebook_url || row.instagram_url || row.tiktok_url || '',
        imageUrl: row.primary_image_url || null,
      }));
    }
    return Object.freeze({ id, title: nav.label, description: nav.desc, icon: nav.icon, phase: state.phase, errorCode: state.errorCode, blocks: Object.freeze(blocks), retry });
  }

  function useInstitutionalContent() {
    const [snapshot, setSnapshot] = React.useState(state);
    React.useEffect(() => subscribe(setSnapshot), []);
    React.useEffect(() => { bootstrap(); }, []);
    return Object.assign({}, snapshot, { retry, moduleFor });
  }

  window.H007_MIGRATED_MODULE_IDS = MIGRATED;
  window.H007_INSTITUTIONAL_NAV = NAV;
  window.InstitutionalContent = Object.freeze({ bootstrap, retry, subscribe, getState: () => state, moduleFor });
  window.useInstitutionalContent = useInstitutionalContent;
})();
