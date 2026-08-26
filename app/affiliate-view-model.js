/* In-memory UI projection of the authoritative authenticated affiliate. */
(function () {
  'use strict';

  const EMPTY = '—';
  const hasValue = (value) => value !== null && value !== undefined && String(value).trim() !== '';
  const value = (raw) => hasValue(raw) ? String(raw) : EMPTY;
  const choose = (...values) => value(values.find(hasValue));

  function createAffiliateViewModel(affiliate, profilePhoto) {
    if (!affiliate || !affiliate.id) throw new Error('Authoritative affiliate is required');
    const name = choose(affiliate.full_name, affiliate.display_name);
    const status = choose(affiliate.affiliate_status_raw, affiliate.historical_status_raw);
    const affiliation = value(affiliate.affiliation_raw);
    const numeroControl = value(affiliate.numero_control);

    return Object.freeze({
      id: String(affiliate.id),
      name,
      short: choose(affiliate.display_name, affiliate.full_name),
      numeroControl,
      num: numeroControl,
      numControl: numeroControl,
      email: value(affiliate.historical_email_raw),
      phone: value(affiliate.phone_raw),
      tel: value(affiliate.phone_raw),
      city: value(affiliate.city_raw),
      ciudad: value(affiliate.city_raw),
      unit: value(affiliate.unit_raw),
      unidad: value(affiliate.unit_raw),
      position: value(affiliate.employment_position_raw),
      puestoIsssteson: value(affiliate.employment_position_raw),
      area: value(affiliate.employment_area_raw),
      occupation: value(affiliate.occupation_raw),
      ocupacion: value(affiliate.occupation_raw),
      unionPosition: value(affiliate.union_position_raw),
      puestoSuti: value(affiliate.union_position_raw),
      category: value(affiliate.employment_level_raw),
      nivel: value(affiliate.employment_level_raw),
      affiliation,
      afiliacion: affiliation,
      status,
      role: status,
      seccion: value(affiliate.unit_raw),
      historicalStatus: value(affiliate.historical_status_raw),
      affiliateStatus: value(affiliate.affiliate_status_raw),
      estatusSindicato: value(affiliate.historical_status_raw),
      estatusAfiliado: value(affiliate.affiliate_status_raw),
      rfc: value(affiliate.rfc_raw),
      birthDate: value(affiliate.birth_date_raw),
      fechaNac: value(affiliate.birth_date_raw),
      gender: value(affiliate.gender_raw),
      genero: value(affiliate.gender_raw),
      maritalStatus: value(affiliate.marital_status_raw),
      estadoCivil: value(affiliate.marital_status_raw),
      childrenCount: value(affiliate.children_count_raw),
      hijos: value(affiliate.children_count_raw),
      address: value(affiliate.address_raw),
      direccion: value(affiliate.address_raw),
      employmentEntryDate: value(affiliate.employment_entry_date_raw),
      fechaIngreso: value(affiliate.employment_entry_date_raw),
      instituteEntryDate: value(affiliate.institute_entry_date_raw),
      fechaIngresoInstituto: value(affiliate.institute_entry_date_raw),
      unionEnrollmentDate: value(affiliate.union_enrollment_date_raw),
      fechaInscripcion: value(affiliate.union_enrollment_date_raw),
      captureDate: value(affiliate.capture_date_raw),
      fechaCaptura: value(affiliate.capture_date_raw),
      photoUrl: profilePhoto && profilePhoto.affiliateId === affiliate.id ? profilePhoto.signedUrl : null,
      profilePhotoAssetId: profilePhoto && profilePhoto.affiliateId === affiliate.id ? profilePhoto.assetId : null,
    });
  }

  window.createAffiliateViewModel = createAffiliateViewModel;
})();
