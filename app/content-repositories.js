/* Phase 2 public editorial repositories. Supabase is the only runtime authority. */
(function () {
  'use strict';
  const assetFields = 'id,asset_key,storage_bucket,storage_path,mime_type,alt_text,status';
  function client() { return window.SutiSupabase.getClient(); }
  function url(asset) { return window.AssetRepository.publicUrl(asset); }
  function projectNews(row) {
    return Object.freeze(Object.assign({}, row, {
      hue: row.accent_hue,
      date: row.display_date || '',
      read: row.reading_minutes ? String(row.reading_minutes) + ' min' : '',
      visible: row.published,
      image_url: url(row.image_asset),
    }));
  }
  async function listNews() {
    const fields = `id,title,tag,body,image_asset_id,accent_hue,display_date,reading_minutes,published,publish_from,publish_until,sort_order,image_asset:app_assets!image_asset_id(${assetFields})`;
    const result = await client().from('news_articles').select(fields).order('sort_order', { ascending: true });
    if (result.error) throw result.error;
    return Object.freeze((result.data || []).map(projectNews));
  }
  async function listEducational(kind) {
    let query = client().from('educational_resources').select(`id,resource_kind,title,description,image_asset_id,document_asset_id,external_url,sort_order,provenance,image_asset:app_assets!image_asset_id(${assetFields}),document_asset:app_assets!document_asset_id(${assetFields})`).order('sort_order', { ascending: true });
    if (kind) query = query.eq('resource_kind', kind);
    const result = await query;
    if (result.error) throw result.error;
    return Object.freeze((result.data || []).map((row) => Object.freeze(Object.assign({}, row, { image_url: url(row.image_asset), document_url: url(row.document_asset) }))));
  }
  window.NewsRepository = Object.freeze({ list: listNews, project: projectNews });
  window.EducationalRepository = Object.freeze({ list: listEducational });
})();
