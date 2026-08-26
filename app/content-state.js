/* One in-memory Phase 2 editorial projection; errors never activate mocks. */
(function () {
  'use strict';
  const listeners = new Set();
  let promise = null;
  let state = Object.freeze({ phase: 'loading', news: [], errorCode: null });
  function publish(next) {
    state = Object.freeze(Object.assign({ phase: 'error', news: [], errorCode: 'EDITORIAL_SOURCE_ERROR' }, next));
    listeners.forEach((fn) => fn(state));
  }
  function subscribe(fn) { listeners.add(fn); fn(state); return () => listeners.delete(fn); }
  function bootstrap() {
    if (promise) return promise;
    publish({ phase: 'loading', errorCode: null });
    promise = window.NewsRepository.list().then((news) => {
      publish({ phase: 'loaded', news, errorCode: null });
      return state;
    }).catch(() => {
      publish({ phase: 'error', news: [], errorCode: 'EDITORIAL_SOURCE_ERROR' });
      return state;
    });
    return promise;
  }
  function retry() { promise = null; return bootstrap(); }
  function useEditorialContent() {
    const [snapshot, setSnapshot] = React.useState(state);
    React.useEffect(() => subscribe(setSnapshot), []);
    React.useEffect(() => { bootstrap(); }, []);
    return Object.assign({}, snapshot, { retry });
  }
  window.EditorialContent = Object.freeze({ bootstrap, retry, subscribe, getState: () => state });
  window.useEditorialContent = useEditorialContent;
})();
