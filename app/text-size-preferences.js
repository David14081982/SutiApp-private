/* Personal presentation preference. Supabase Auth is the only durable authority.
   Never use this editable metadata for identity, permissions or business rules. */
(function () {
  'use strict';
  const KEY = 'sutiapp_text_size';
  const OPTIONS = Object.freeze([
    { value: 'small', label: 'Pequeño', scale: 0.875 },
    { value: 'normal', label: 'Normal', scale: 1 },
    { value: 'large', label: 'Grande', scale: 1.15 },
    { value: 'largest', label: 'Muy grande', scale: 1.35 },
  ]);
  const valid = value => OPTIONS.some(option => option.value === value);
  function fromUser(user) {
    const value = user && user.user_metadata && user.user_metadata[KEY];
    if (value == null) return 'normal';
    if (!valid(value)) throw new Error('INVALID_TEXT_SIZE');
    return value;
  }
  async function read(principal) {
    const result = await window.SutiSupabase.getClient().auth.getUser();
    if (result.error) throw result.error;
    if (!result.data.user || result.data.user.id !== principal) throw new Error('TEXT_SIZE_SESSION_CHANGED');
    return fromUser(result.data.user);
  }
  async function write(principal, value) {
    if (!valid(value)) throw new Error('INVALID_TEXT_SIZE');
    // No user selector is sent: the Auth server always updates the JWT owner.
    const auth = window.SutiSupabase.getClient().auth;
    const current = await auth.getUser();
    if (current.error) throw current.error;
    if (!current.data.user || current.data.user.id !== principal) throw new Error('TEXT_SIZE_SESSION_CHANGED');
    const result = await auth.updateUser({ data: { [KEY]: value } });
    if (result.error) throw result.error;
    if (!result.data.user || result.data.user.id !== principal || fromUser(result.data.user) !== value) throw new Error('TEXT_SIZE_NOT_CONFIRMED');
    return value;
  }
  function useTextSizePreference(principal) {
    const [state, setState] = React.useState({ value: 'normal', status: 'loading', error: '' });
    const live = React.useRef(0), busy = React.useRef(false);
    const reload = React.useCallback(async () => {
      const ticket = ++live.current;
      setState(previous => ({ ...previous, status: 'loading', error: '' }));
      try {
        const value = await read(principal);
        if (live.current === ticket) setState({ value, status: 'ready', error: '' });
      } catch (error) {
        if (live.current === ticket) setState(previous => ({ ...previous, status: 'error', error: error.message === 'INVALID_TEXT_SIZE'
          ? 'Esta versión no reconoce tu tamaño de texto guardado. Actualiza la aplicación y vuelve a abrirla. Tu preferencia se conserva en tu cuenta.'
          : 'No pudimos cargar tu tamaño de texto. Revisa tu conexión e inténtalo de nuevo.' }));
      }
    }, [principal]);
    React.useEffect(() => {
      reload();
      const refresh = () => { if (document.visibilityState === 'visible' && !busy.current) reload(); };
      document.addEventListener('visibilitychange', refresh);
      return () => { ++live.current; document.removeEventListener('visibilitychange', refresh); };
    }, [reload]);
    const choose = async value => {
      if (!valid(value) || busy.current || state.status === 'loading') return;
      busy.current = true;
      const ticket = ++live.current, previous = state.value;
      setState({ value, status: 'saving', error: '' }); // immediate typography; persistence remains explicit
      try {
        await write(principal, value);
        if (live.current === ticket) setState({ value, status: 'saved', error: '' });
      } catch (_) {
        if (live.current === ticket) setState({ value: previous, status: 'error', error: 'No se guardó el cambio. Conservamos el tamaño anterior. Revisa tu conexión y vuelve a elegir.' });
      } finally { busy.current = false; }
    };
    return { ...state, choose, reload };
  }
  function TextSizeSettings({ preference }) {
    return React.createElement('section', { className: 'su-text-settings', 'aria-labelledby': 'text-size-title' },
      React.createElement('h2', { id: 'text-size-title' }, 'Tamaño de texto'),
      React.createElement('p', null, 'Elige el tamaño que te resulte más cómodo. Se aplica a toda tu app y se guarda en tu cuenta.'),
      React.createElement('fieldset', { disabled: preference.status === 'saving' || preference.status === 'loading', 'aria-describedby': 'text-size-status' },
        React.createElement('legend', { className: 'su-visually-hidden' }, 'Tamaño de texto'),
        OPTIONS.map(option => React.createElement('label', { key: option.value, className: 'su-text-option', 'data-selected': preference.value === option.value },
          React.createElement('input', { type: 'radio', name: 'text-size', value: option.value, checked: preference.value === option.value, onChange: () => preference.choose(option.value) }),
          React.createElement('span', null, option.label)))),
      React.createElement('p', { className: 'su-text-preview' }, 'Así leerás tus avisos, solicitudes y beneficios.'),
      React.createElement('p', { id: 'text-size-status', role: preference.error ? 'alert' : 'status', 'aria-live': 'polite' },
        preference.error || (preference.status === 'saving' ? 'Guardando tu preferencia…' : preference.status === 'loading' ? 'Cargando tu preferencia…' : preference.status === 'saved' ? 'Tamaño de texto guardado.' : 'Puedes cambiarlo cuando lo necesites.')),
      preference.error && React.createElement(window.Btn, { variant: 'outline', onClick: preference.reload }, 'Volver a cargar'));
  }
  window.TextSizePreferences = Object.freeze({ read, write, fromUser, options: OPTIONS });
  window.useTextSizePreference = useTextSizePreference;
  window.TextSizeSettings = TextSizeSettings;
})();
