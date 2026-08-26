/* One in-memory projection of H-007.2 public visual content. */
(function () {
  'use strict';

  const listeners = new Set();
  let loadPromise = null;
  let state = Object.freeze({ phase: 'loading', homeBanners: [], marketplaceBanners: [], popups: [], companies: [], branding: null, errorCode: null });

  function publish(next) {
    state = Object.freeze(Object.assign({ phase: 'error', homeBanners: [], marketplaceBanners: [], popups: [], companies: [], branding: null, errorCode: 'SOURCE_ERROR' }, next));
    if (window.assetsStore && window.assetsStore.setAuthoritative && state.phase !== 'loading') {
      const url = state.phase === 'loaded' && state.branding ? state.branding.home_header_collapsed_url : null;
      window.assetsStore.setAuthoritative('home.header.collapsed', { url: url || null });
    }
    listeners.forEach((listener) => listener(state));
  }

  function bootstrap() {
    if (loadPromise) return loadPromise;
    publish({ phase: 'loading', errorCode: null });
    loadPromise = Promise.all([
      window.BannerRepository.list('home'),
      window.BannerRepository.list('marketplace'),
      window.PopupRepository.listActive(),
      window.CompaniesRepository.list(),
      window.BrandingRepository.get(),
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

  window.VisualContent = Object.freeze({ bootstrap, retry, subscribe, getState: () => state });
  window.useVisualContent = useVisualContent;
})();
