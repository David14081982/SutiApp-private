/* Sole Supabase boundaries for H-007.2/H-007.3 visual content. */
(function () {
  'use strict';

  class VisualRepositoryError extends Error {
    constructor(domain, cause) {
      super('Visual authority request failed');
      this.name = 'VisualRepositoryError';
      this.code = 'SOURCE_ERROR';
      this.domain = domain;
      if (cause) this.cause = cause;
    }
  }

  function publicUrl(asset, transform) {
    if (!asset || asset.status !== 'READY' || !asset.storage_bucket || !asset.storage_path) return null;
    const transformable = ['image/jpeg', 'image/png', 'image/webp'].includes(String(asset.mime_type || '').toLowerCase());
    const options = transform && transformable ? { transform } : undefined;
    const result = window.SutiSupabase.getClient().storage.from(asset.storage_bucket).getPublicUrl(asset.storage_path, options);
    return result && result.data ? result.data.publicUrl : null;
  }

  async function list(table, fields, configure) {
    try {
      let query = window.SutiSupabase.getClient().from(table).select(fields);
      query = configure(query);
      const result = await query;
      if (result.error) throw result.error;
      return Object.freeze((result.data || []).map((row) => Object.freeze(row)));
    } catch (error) {
      throw new VisualRepositoryError(table, error);
    }
  }

  const assetFields = 'id,asset_key,storage_bucket,storage_path,mime_type,alt_text,status';

  window.AssetRepository = Object.freeze({
    publicUrl,
    async getByKey(assetKey) {
      const rows = await list('app_assets', assetFields, (query) => query.eq('asset_key', assetKey).limit(1));
      return rows.length ? Object.freeze(Object.assign({}, rows[0], { url: publicUrl(rows[0]) })) : null;
    },
  });

  window.BrandingRepository = Object.freeze({
    async get() {
      const relation = (alias, constraint) => `${alias}:app_assets!${constraint}(${assetFields})`;
      const fields = [
        'id,app_name,short_name,description,updated_at',
        relation('app_icon_asset', 'app_settings_app_icon_asset_id_fkey'),
        relation('institutional_seal_asset', 'app_settings_institutional_seal_asset_id_fkey'),
        relation('favicon_asset', 'app_settings_favicon_asset_id_fkey'),
        relation('apple_touch_asset', 'app_settings_apple_touch_asset_id_fkey'),
        relation('pwa_icon_192_asset', 'app_settings_pwa_icon_192_asset_id_fkey'),
        relation('pwa_icon_512_asset', 'app_settings_pwa_icon_512_asset_id_fkey'),
        relation('pwa_maskable_512_asset', 'app_settings_pwa_maskable_512_asset_id_fkey'),
        relation('install_screen_1_asset', 'app_settings_install_screen_1_asset_id_fkey'),
        relation('install_screen_2_asset', 'app_settings_install_screen_2_asset_id_fkey'),
        relation('install_screen_3_asset', 'app_settings_install_screen_3_asset_id_fkey'),
      ].join(',');
      const [rows, homeHeaderAsset] = await Promise.all([
        list('app_settings', fields, (query) => query.eq('id', 'primary').limit(1)),
        window.AssetRepository.getByKey('home.header.collapsed'),
      ]);
      if (rows.length !== 1) throw new VisualRepositoryError('app_settings');
      const row = rows[0];
      return Object.freeze({
        id: row.id, app_name: row.app_name, short_name: row.short_name,
        description: row.description, updated_at: row.updated_at,
        app_icon_url: window.AssetRepository.publicUrl(row.app_icon_asset),
        institutional_seal_url: window.AssetRepository.publicUrl(row.institutional_seal_asset, { width: 240, height: 240, resize: 'contain', quality: 84 }),
        favicon_url: window.AssetRepository.publicUrl(row.favicon_asset),
        apple_touch_url: window.AssetRepository.publicUrl(row.apple_touch_asset),
        pwa_icon_192_url: window.AssetRepository.publicUrl(row.pwa_icon_192_asset),
        pwa_icon_512_url: window.AssetRepository.publicUrl(row.pwa_icon_512_asset),
        pwa_maskable_512_url: window.AssetRepository.publicUrl(row.pwa_maskable_512_asset),
        home_header_collapsed_url: homeHeaderAsset && window.AssetRepository.publicUrl(homeHeaderAsset, { width: 860, height: 180, resize: 'cover', quality: 82 }),
        install_screens: Object.freeze([
          window.AssetRepository.publicUrl(row.install_screen_1_asset),
          window.AssetRepository.publicUrl(row.install_screen_2_asset),
          window.AssetRepository.publicUrl(row.install_screen_3_asset),
        ]),
      });
    },
  });

  window.BannerRepository = Object.freeze({
    async list(placement) {
      const rows = await list('banners', `id,placement,title,description,action_label,action_url,company_raw,category_raw,sort_order,image_asset:app_assets!image_asset_id(${assetFields})`,
        (query) => query.eq('placement', placement).eq('enabled', true).order('sort_order', { ascending: true }));
      return Object.freeze(rows.map((row) => Object.freeze(Object.assign({}, row, { image_url: publicUrl(row.image_asset, { width: 860, height: 448, resize: 'cover', quality: 82 }) }))));
    },
  });

  window.PopupRepository = Object.freeze({
    async listActive() {
      const now = new Date().toISOString();
      const rows = await list('popups', `id,title,body,action_label,action_url,sort_order,image_asset:app_assets!image_asset_id(${assetFields})`,
        (query) => query.eq('enabled', true).or(`start_at.is.null,start_at.lte.${now}`).or(`end_at.is.null,end_at.gte.${now}`).order('sort_order', { ascending: true }));
      return Object.freeze(rows.map((row) => Object.freeze({
        id: row.id, titulo: row.title || '', contenido: row.body || '', image_url: publicUrl(row.image_asset, { width: 680, height: 368, resize: 'cover', quality: 82 }),
        ctaText: row.action_label || 'Continuar', actionType: row.action_url ? 'url' : 'none',
        actionTarget: row.action_url || null, hue: 345,
      })));
    },
  });

  window.CompaniesRepository = Object.freeze({
    async list() {
      const rows = await list('companies', `id,display_name,description,category_raw,address_raw,location_raw,phone_raw,whatsapp_raw,website_url,sort_order,logo_asset:app_assets!logo_asset_id(${assetFields}),company_assets(role,sort_order,asset:app_assets!asset_id(${assetFields}))`,
        (query) => query.eq('enabled', true).order('sort_order', { ascending: true }));
      return Object.freeze(rows.map((row) => {
        const linked = (row.company_assets || []).slice().sort((a, b) => a.sort_order - b.sort_order);
        const cover = linked.find((item) => item.role === 'cover');
        return Object.freeze(Object.assign({}, row, {
          logo_url: publicUrl(row.logo_asset, { width: 192, height: 192, resize: 'contain', quality: 82 }),
          cover_url: cover ? publicUrl(cover.asset, { width: 860, height: 480, resize: 'cover', quality: 82 }) : null,
          gallery_urls: Object.freeze(linked.filter((item) => item.role === 'gallery').map((item) => publicUrl(item.asset, { width: 640, height: 460, resize: 'cover', quality: 82 })).filter(Boolean)),
        }));
      }));
    },
  });
})();
