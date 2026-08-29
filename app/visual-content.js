/* One in-memory projection of H-007.2 public visual content. */
(function () {
  'use strict';

  const listeners = new Set();
  let loadPromise = null;
  let brandingPromise = null;
  let state = Object.freeze({ phase: 'loading', brandingPhase: 'loading', homeBanners: [], marketplaceBanners: [], popups: [], companies: [], branding: null, errorCode: null });

  function publish(next) {
    state = Object.freeze(Object.assign({ phase: 'error', brandingPhase: 'error', homeBanners: [], marketplaceBanners: [], popups: [], companies: [], branding: null, errorCode: 'SOURCE_ERROR' }, next));
    if (window.assetsStore && window.assetsStore.setAuthoritative && state.phase !== 'loading') {
      const url = state.phase === 'loaded' && state.branding ? state.branding.home_header_collapsed_url : null;
      window.assetsStore.setAuthoritative('home.header.collapsed', { url: url || null });
    }
    listeners.forEach((listener) => listener(state));
  }

  function bootstrapBranding() {
    if (state.branding) return Promise.resolve(state.branding);
    if (brandingPromise) return brandingPromise;
    brandingPromise = window.BrandingRepository.get().then((branding) => {
      publish(Object.assign({}, state, { branding, brandingPhase: 'loaded' }));
      return branding;
    }).catch((error) => {
      publish(Object.assign({}, state, { branding: null, brandingPhase: 'error' }));
      throw error;
    });
    return brandingPromise;
  }

  function bootstrap() {
    if (loadPromise) return loadPromise;
    publish({ phase: 'loading', errorCode: null });
    loadPromise = Promise.all([
      window.BannerRepository.list('home'),
      window.BannerRepository.list('marketplace'),
      window.PopupRepository.listActive(),
      window.CompaniesRepository.list(),
      bootstrapBranding(),
    ]).then(([homeBanners, marketplaceBanners, popups, companies, branding]) => {
      publish({ phase: 'loaded', homeBanners, marketplaceBanners, popups, companies, branding, errorCode: null });
      return state;
    }).catch(() => {
      publish({ phase: 'error', errorCode: 'SOURCE_ERROR' });
      return state;
    });
    return loadPromise;
  }

  function retry() {
    loadPromise = null;
    brandingPromise = null;
    publish(Object.assign({}, state, { phase: 'loading', brandingPhase: 'loading', branding: null, errorCode: null }));
    return bootstrap();
  }

  function subscribe(listener) {
    listeners.add(listener);
    listener(state);
    return () => listeners.delete(listener);
  }

  function useVisualContent() {
    const [snapshot, setSnapshot] = React.useState(state);
    React.useEffect(() => subscribe(setSnapshot), []);
    React.useEffect(() => { bootstrap(); }, []);
    return Object.assign({}, snapshot, { retry });
  }

  function useVisualBranding() {
    const [snapshot, setSnapshot] = React.useState(state);
    React.useEffect(() => subscribe(setSnapshot), []);
    React.useEffect(() => { bootstrapBranding().catch(() => {}); }, []);
    return { phase: snapshot.brandingPhase, branding: snapshot.branding };
  }

  window.VisualContent = Object.freeze({ bootstrap, bootstrapBranding, retry, subscribe, getState: () => state });
  window.useVisualContent = useVisualContent;
  window.useVisualBranding = useVisualBranding;
})();
