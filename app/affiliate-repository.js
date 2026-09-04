/* Sole Supabase data-access boundary for the Afiliados domain. */
(function () {
  'use strict';

  const PUBLIC_FIELDS = [
    'id', 'numero_control', 'full_name', 'display_name',
    'historical_email_raw', 'historical_email_normalized', 'phone_raw',
    'address_raw', 'birth_date_raw', 'gender_raw', 'marital_status_raw',
    'children_count_raw', 'rfc_raw', 'curp_raw',
    'historical_status_raw', 'affiliate_status_raw', 'unit_raw', 'city_raw',
    'employment_position_raw', 'employment_area_raw', 'occupation_raw',
    'employment_entry_date_raw', 'institute_entry_date_raw', 'subdirectorate_raw',
    'union_position_raw', 'employment_level_raw', 'affiliation_raw',
    'union_enrollment_date_raw', 'capture_date_raw', 'termination_date_raw',
    'auth_user_id', 'auth_eligibility', 'auth_ineligibility_reason',
    'source_row_ordinal', 'created_at', 'updated_at',
  ].join(',');

  const PROFILE_PHOTO = Object.freeze({
    fileKey: 'profile_photo',
    sourceColumn: 'Photo',
    sourceColumnLetter: 'DK',
    signedUrlTtlSeconds: 3600,
    cacheTtlMs: 50 * 60 * 1000,
  });

  const DOCUMENTS = Object.freeze({ signedUrlTtlSeconds: 300 });
  const DOCUMENT_LABELS = Object.freeze({
    profile_photo: 'Fotografía',
    ine_front: 'INE frente',
    ine_back: 'INE reverso',
    payroll_receipt: 'Talón de pago',
    payroll_receipt_latest: 'Talón de pago',
    proof: 'Comprobante',
    credential: 'Credencial',
    membership_form: 'Formato de afiliación',
    tribunal_form: 'Formato de Tribunal',
    html_general: 'Otro documento',
  });

  class AffiliateRepositoryError extends Error {
    constructor(code, message, cause) {
      super(message);
      this.name = 'AffiliateRepositoryError';
      this.code = code;
      if (cause) this.cause = cause;
    }
  }

  function sourceError(error) {
    if (error instanceof AffiliateRepositoryError) return error;
    return new AffiliateRepositoryError('SOURCE_ERROR', 'Affiliate authority request failed', error);
  }

  function createAffiliateRepository(clientProvider) {
    const provideClient = clientProvider || (() => window.SutiSupabase.getClient());
    const profilePhotoCache = new Map();

    async function getAuthenticatedUser(client, knownUser) {
      if (knownUser && knownUser.id) return knownUser;
      const result = await client.auth.getUser();
      if (result.error) throw sourceError(result.error);
      if (!result.data || !result.data.user) {
        throw new AffiliateRepositoryError('NOT_AUTHENTICATED', 'No authenticated principal');
      }
      return result.data.user;
    }

    async function getCurrentAffiliate(knownUser) {
      try {
        const client = provideClient();
        const principal = await getAuthenticatedUser(client, knownUser);
        const access = await client.rpc('get_current_affiliate_access_state');
        if (access.error) throw access.error;
        if (access.data === 'ARCHIVED') {
          throw new AffiliateRepositoryError('AFFILIATE_ARCHIVED', 'Affiliate self-service is archived');
        }
        if (access.data === 'IDENTITY_MISMATCH' || access.data === 'AMBIGUOUS_IDENTITY') {
          throw new AffiliateRepositoryError('AUTH_IDENTITY_MISMATCH', 'Authenticated principal does not exactly match one affiliate');
        }
        if (access.data !== 'ACTIVE') {
          throw new AffiliateRepositoryError('AUTH_IDENTITY_WITHOUT_AFFILIATE', 'Authenticated principal has no linked affiliate');
        }
        const effective = await client.rpc('get_effective_affiliate_id');
        if (effective.error) throw effective.error;
        if (!effective.data) {
          throw new AffiliateRepositoryError('AUTH_IDENTITY_MISMATCH', 'Active identity did not resolve exactly one affiliate');
        }
        const [result, context] = await Promise.all([
          client.from('affiliates').select(PUBLIC_FIELDS).eq('id', effective.data).maybeSingle(),
          client.rpc('get_impersonation_context'),
        ]);
        if (result.error) throw result.error;
        if (!result.data) {
          throw new AffiliateRepositoryError(
            'AUTH_IDENTITY_MISMATCH',
            'Effective affiliate could not be verified'
          );
        }
        if (context.error) throw context.error;
        const active = Array.isArray(context.data) ? context.data[0] : null;
        if (active) {
          if (active.actor_real_auth_user_id !== principal.id || active.usuario_contexto_affiliate_id !== result.data.id) {
            throw new AffiliateRepositoryError('AUTH_IDENTITY_MISMATCH', 'Impersonation context does not match the authenticated principal');
          }
        } else {
          const principalEmail = String(principal.email || '').trim().toLowerCase();
          if (!principal.email_confirmed_at || !principalEmail || result.data.auth_user_id !== principal.id || result.data.historical_email_normalized !== principalEmail) {
            throw new AffiliateRepositoryError('AUTH_IDENTITY_MISMATCH', 'Authenticated principal does not exactly match the resolved affiliate');
          }
        }
        return Object.assign({}, result.data, { _impersonation: active || null });
      } catch (error) {
        throw sourceError(error);
      }
    }

    async function getById(id) {
      if (!id) throw new AffiliateRepositoryError('INVALID_ARGUMENT', 'Affiliate id is required');
      try {
        const result = await provideClient().from('affiliates')
          .select(PUBLIC_FIELDS)
          .eq('id', id)
          .maybeSingle();
        if (result.error) throw result.error;
        if (!result.data) throw new AffiliateRepositoryError('NOT_FOUND', 'Affiliate not found');
        return result.data;
      } catch (error) {
        throw sourceError(error);
      }
    }

    async function getByNumeroControl(numeroControl) {
      if (typeof numeroControl !== 'string') {
        throw new AffiliateRepositoryError('INVALID_ARGUMENT', 'numero_control must be TEXT');
      }
      try {
        const result = await provideClient().from('affiliates')
          .select(PUBLIC_FIELDS)
          .eq('numero_control', numeroControl)
          .order('source_row_ordinal', { ascending: true })
          .limit(2);
        if (result.error) throw result.error;
        const rows = result.data || [];
        if (!rows.length) throw new AffiliateRepositoryError('NOT_FOUND', 'Affiliate not found');
        if (rows.length > 1) {
          throw new AffiliateRepositoryError(
            'AMBIGUOUS_NUMERO_CONTROL',
            'numero_control resolves to multiple affiliates'
          );
        }
        return rows[0];
      } catch (error) {
        throw sourceError(error);
      }
    }

    async function getAuthState(id) {
      if (!id) throw new AffiliateRepositoryError('INVALID_ARGUMENT', 'Affiliate id is required');
      try {
        const result = await provideClient().from('affiliates')
          .select('id,auth_user_id,auth_eligibility,auth_ineligibility_reason')
          .eq('id', id)
          .maybeSingle();
        if (result.error) throw result.error;
        if (!result.data) throw new AffiliateRepositoryError('NOT_FOUND', 'Affiliate not found');
        return result.data;
      } catch (error) {
        throw sourceError(error);
      }
    }

    async function getProfilePhoto(affiliateId, knownUser) {
      try {
        const client = provideClient();
        const principal = await getAuthenticatedUser(client, knownUser);
        let resolvedAffiliateId = affiliateId;
        if (!resolvedAffiliateId) {
          const effective = await client.rpc('get_effective_affiliate_id');
          if (effective.error) throw effective.error;
          resolvedAffiliateId = effective.data;
        }
        if (!resolvedAffiliateId) {
          throw new AffiliateRepositoryError('AUTH_IDENTITY_WITHOUT_AFFILIATE', 'Authenticated principal has no linked affiliate');
        }

        const cacheKey = principal.id + ':' + resolvedAffiliateId;
        const cached = profilePhotoCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) return cached.value;
        profilePhotoCache.delete(cacheKey);

        const result = await client.from('affiliate_files')
          .select('id,affiliate_id,private_asset_id,classification,file_key,file_type,source_column,source_column_letter,storage_bucket,storage_path,mime_type,sha256,status,updated_at,url_order')
          .eq('affiliate_id', resolvedAffiliateId)
          .eq('file_key', PROFILE_PHOTO.fileKey)
          .eq('source_column', PROFILE_PHOTO.sourceColumn)
          .eq('source_column_letter', PROFILE_PHOTO.sourceColumnLetter)
          .eq('classification', 'PRIVATE')
          .eq('file_type', 'image')
          .eq('status', 'READY')
          .order('url_order', { ascending: true })
          .limit(2);
        if (result.error) throw result.error;
        const rows = result.data || [];
        if (rows.length > 1) {
          throw new AffiliateRepositoryError('AMBIGUOUS_PROFILE_PHOTO', 'Affiliate has multiple authoritative profile photos');
        }
        if (!rows.length) {
          profilePhotoCache.set(cacheKey, { value: null, expiresAt: Date.now() + PROFILE_PHOTO.cacheTtlMs });
          return null;
        }

        const row = rows[0];
        if (row.affiliate_id !== resolvedAffiliateId || row.storage_bucket !== 'private-assets'
            || !row.private_asset_id || !String(row.mime_type || '').startsWith('image/')) {
          throw new AffiliateRepositoryError('INVALID_PROFILE_PHOTO_RELATION', 'Profile photo relation violates the private asset contract');
        }
        const signed = await client.storage.from(row.storage_bucket)
          .createSignedUrl(row.storage_path, PROFILE_PHOTO.signedUrlTtlSeconds);
        if (signed.error) throw signed.error;
        const signedUrl = signed.data && signed.data.signedUrl;
        if (!signedUrl) throw new AffiliateRepositoryError('PROFILE_PHOTO_SIGNING_FAILED', 'Profile photo signed URL was not created');

        const photo = Object.freeze({
          affiliateId: row.affiliate_id,
          relationId: row.id,
          assetId: row.private_asset_id,
          storageBucket: row.storage_bucket,
          storagePath: row.storage_path,
          sha256: row.sha256,
          signedUrl,
          expiresAt: Date.now() + PROFILE_PHOTO.signedUrlTtlSeconds * 1000,
        });
        profilePhotoCache.set(cacheKey, { value: photo, expiresAt: Date.now() + PROFILE_PHOTO.cacheTtlMs });
        return photo;
      } catch (error) {
        throw sourceError(error);
      }
    }

    async function readDocuments(affiliateId, historicalOnly) {
      try {
        const client = provideClient();
        await getAuthenticatedUser(client);
        let resolvedAffiliateId = affiliateId;
        if (!resolvedAffiliateId) {
          const effective = await client.rpc('get_effective_affiliate_id');
          if (effective.error) throw effective.error;
          resolvedAffiliateId = effective.data;
        }
        if (!resolvedAffiliateId) {
          throw new AffiliateRepositoryError('AUTH_IDENTITY_WITHOUT_AFFILIATE', 'Authenticated principal has no linked affiliate');
        }

        let query = client.from('affiliate_files')
          .select('id,affiliate_id,private_asset_id,public_asset_id,classification,file_key,file_type,source_column,source_column_letter,title,storage_bucket,storage_path,mime_type,sha256,status,sort_order,url_order,created_at,expediente_classification')
          .eq('affiliate_id', resolvedAffiliateId)
          .eq('status', 'READY');
        query = historicalOnly
          ? query.neq('expediente_classification', 'CURRENT_DOCUMENT')
          : query.eq('expediente_classification', 'CURRENT_DOCUMENT');
        const result = await query
          .order('sort_order', { ascending: true })
          .order('url_order', { ascending: true });
        if (result.error) throw result.error;

        const sourceRows = result.data || [];
        const privateRows = sourceRows.filter((row) => row.classification === 'PRIVATE');
        const signedByPath = new Map();
        if (privateRows.length) {
          const paths = Array.from(new Set(privateRows.map((row) => row.storage_path)));
          const signed = await client.storage.from('private-assets').createSignedUrls(paths, DOCUMENTS.signedUrlTtlSeconds);
          if (signed.error) throw signed.error;
          (signed.data || []).forEach((entry, index) => { if (entry && entry.signedUrl) signedByPath.set(paths[index], entry.signedUrl); });
        }
        const documents = sourceRows.map((row) => {
          if (row.affiliate_id !== resolvedAffiliateId) {
            throw new AffiliateRepositoryError('INVALID_DOCUMENT_RELATION', 'Document relation does not belong to the requested affiliate');
          }
          let signedUrl = null;
          let expiresAt = null;
          if (row.classification === 'PRIVATE') {
            if (row.storage_bucket !== 'private-assets' || !row.private_asset_id) {
              throw new AffiliateRepositoryError('INVALID_DOCUMENT_RELATION', 'Private document relation violates the asset contract');
            }
            signedUrl = signedByPath.get(row.storage_path) || null;
            if (!signedUrl) {
              throw new AffiliateRepositoryError('DOCUMENT_SIGNING_FAILED', 'Private document signed URL was not created');
            }
            expiresAt = Date.now() + DOCUMENTS.signedUrlTtlSeconds * 1000;
          } else if (row.classification === 'PUBLIC') {
            if (!row.storage_bucket || !row.public_asset_id) {
              throw new AffiliateRepositoryError('INVALID_DOCUMENT_RELATION', 'Public document relation violates the asset contract');
            }
            signedUrl = client.storage.from(row.storage_bucket).getPublicUrl(row.storage_path).data.publicUrl;
          } else {
            throw new AffiliateRepositoryError('INVALID_DOCUMENT_RELATION', 'Unknown document classification');
          }
          const key = String(row.file_key || '').toLowerCase();
          const mime = String(row.mime_type || '');
          return Object.freeze({
            id: row.id,
            affiliateId: row.affiliate_id,
            label: DOCUMENT_LABELS[key] || 'Otro documento',
            fileKey: key,
            sourceColumn: row.source_column || '',
            sourceColumnLetter: row.source_column_letter || '',
            title: row.title || '',
            icon: key === 'profile_photo' ? 'camera' : (mime.startsWith('image/') ? 'image' : 'doc'),
            kind: mime.startsWith('image/') ? 'image' : (mime === 'application/pdf' ? 'pdf' : 'document'),
            mimeType: mime,
            sha256: row.sha256 || '',
            classification: row.classification,
            expedienteClassification: row.expediente_classification,
            createdAt: row.created_at,
            signedUrl,
            expiresAt,
          });
        });
        return Object.freeze(documents);
      } catch (error) {
        throw sourceError(error);
      }
    }
    const getDocuments=(affiliateId)=>readDocuments(affiliateId,false);
    const getHistoricalDocuments=(affiliateId)=>readDocuments(affiliateId,true);

    function clearProfilePhotoCache() {
      profilePhotoCache.clear();
    }

    async function claimCurrentIdentity() {
      try {
        const result = await provideClient().rpc('claim_affiliate_identity');
        if (result.error) throw result.error;
        return result.data;
      } catch (error) { throw sourceError(error); }
    }

    return Object.freeze({
      getCurrentAffiliate, getById, getByNumeroControl, getAuthState, claimCurrentIdentity,
      getProfilePhoto, getDocuments, getHistoricalDocuments, clearProfilePhotoCache,
    });
  }

  window.AffiliateRepositoryError = AffiliateRepositoryError;
  window.createAffiliateRepository = createAffiliateRepository;
  window.AffiliateRepository = createAffiliateRepository();
})();
