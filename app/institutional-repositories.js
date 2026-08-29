/* Sole Supabase data-access boundaries for H-007 public institutional content. */
(function () {
  'use strict';

  class InstitutionalRepositoryError extends Error {
    constructor(table, cause) {
      super('Institutional authority request failed');
      this.name = 'InstitutionalRepositoryError';
      this.code = 'SOURCE_ERROR';
      this.table = table;
      if (cause) this.cause = cause;
    }
  }

  function assetUrl(asset, transform) {
    return window.AssetRepository.publicUrl(asset, transform);
  }

  function createRepository(table, fields, project, configure) {
    return Object.freeze({
      async list() {
        try {
          let query = window.SutiSupabase.getClient().from(table).select(fields);
          if (configure) query = configure(query);
          const result = await query.order('sort_order', { ascending: true });
          if (result.error) throw result.error;
          return Object.freeze((result.data || []).map((row) => Object.freeze(project ? project(row) : row)));
        } catch (error) {
          throw new InstitutionalRepositoryError(table, error);
        }
      },
    });
  }

  window.DirectoryRepository = createRepository(
    'directory_members',
    'id,name,role,sort_order,source_row_ordinal,image_asset:app_assets!image_asset_id(id,asset_key,storage_bucket,storage_path,mime_type,alt_text,status)',
    (row) => Object.assign({}, row, { image_url: assetUrl(row.image_asset, { width: 160, height: 160, resize: 'cover', quality: 82 }) }),
    (query) => query.eq('enabled', true)
  );
  window.MinutesRepository = createRepository(
    'minutes',
    'id,title,description,source_date_raw,published_on,sort_order,source_row_ordinal,image_asset:app_assets!minutes_image_asset_id_fkey(id,asset_key,storage_bucket,storage_path,mime_type,alt_text,status),document_asset:app_assets!minutes_document_asset_id_fkey(id,asset_key,storage_bucket,storage_path,mime_type,alt_text,status)',
    (row) => Object.assign({}, row, { image_url: assetUrl(row.image_asset, { width: 640, height: 360, resize: 'cover', quality: 82 }), document_url: assetUrl(row.document_asset) }),
    (query) => query.eq('enabled', true)
  );
  window.InstitutionalDocumentsRepository = createRepository(
    'institutional_documents',
    'id,kind,title,description,sort_order,source_sheet,source_row_ordinal,image_asset:app_assets!institutional_documents_image_asset_id_fkey(id,asset_key,storage_bucket,storage_path,mime_type,alt_text,status),document_asset:app_assets!institutional_documents_document_asset_id_fkey(id,asset_key,storage_bucket,storage_path,mime_type,alt_text,status)',
    (row) => Object.assign({}, row, { image_url: assetUrl(row.image_asset, { width: 640, height: 360, resize: 'cover', quality: 82 }), document_url: assetUrl(row.document_asset) }),
    (query) => query.eq('enabled', true)
  );
  window.InstitutionalProgramsRepository = createRepository(
    'institutional_programs',
    'id,category,description,phone_raw,whatsapp_raw,facebook_url,instagram_url,share_url,location_raw,whatsapp_url,tiktok_url,sort_order,source_row_ordinal,primary_image_asset:app_assets!primary_image_asset_id(id,asset_key,storage_bucket,storage_path,mime_type,alt_text,status)',
    (row) => Object.assign({}, row, { primary_image_url: assetUrl(row.primary_image_asset, { width: 640, height: 360, resize: 'cover', quality: 82 }), gallery_image_urls: [] }),
    (query) => query.eq('enabled', true)
  );
})();
