/* Supabase client boundary. Public runtime config is generated locally/deployment-side. */
(function () {
  'use strict';

  let client = null;

  function config() {
    const root = window.__SUTIAPP_CONFIG__ || {};
    return root.supabase || {};
  }

  function isConfigured() {
    const value = config();
    return Boolean(value.url && value.publishableKey);
  }

  function getClient() {
    if (client) return client;
    if (!isConfigured()) {
      const error = new Error('Supabase runtime configuration is missing');
      error.code = 'SUPABASE_NOT_CONFIGURED';
      throw error;
    }
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      const error = new Error('Supabase browser client failed to load');
      error.code = 'SUPABASE_CLIENT_UNAVAILABLE';
      throw error;
    }

    const value = config();
    client = window.supabase.createClient(value.url, value.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    return client;
  }

  window.SutiSupabase = Object.freeze({ isConfigured, getClient });
})();

