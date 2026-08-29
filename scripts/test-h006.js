'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const vm = require('vm');

const read = (file) => fs.readFileSync(file, 'utf8');
const source = read('app/affiliate-view-model.js');
const context = { window: {} };
vm.createContext(context);
vm.runInContext(source, context, { filename: 'affiliate-view-model.js' });

const raw = {
  id: 'affiliate-test', numero_control: '001-A', full_name: 'Nombre Real',
  display_name: 'Nombre', historical_email_raw: 'Historical@Example.COM ',
  phone_raw: '', city_raw: 'Hermosillo', unit_raw: 'Unidad 1',
  affiliation_raw: 'AFILIADO', affiliate_status_raw: 'ACTIVO',
};
const user = context.window.createAffiliateViewModel(raw);
assert.equal(user.id, raw.id);
assert.equal(user.numeroControl, '001-A');
assert.equal(user.name, 'Nombre Real');
assert.equal(user.email, 'Historical@Example.COM ');
assert.equal(user.phone, '—');
assert.equal(user.photoUrl, null);
assert(Object.isFrozen(user));
assert(!('ahorro' in user));
assert(!('creditoDisp' in user));

const migrated = ['app/app.jsx', 'app/screens-home-r2.jsx', 'app/screens-credencial.jsx']
  .map(read).join('\n');
for (const forbidden of ['D().user', 'DATA.user', 'useUserPhoto', 'suti_user_photo', 'suti_bank_v1', 'BankSheet', 'creditoDisp', 'u.ahorro']) {
  assert(!migrated.includes(forbidden), `forbidden migrated identity source: ${forbidden}`);
}
for (const required of [
  "'data-affiliate-field': 'topbar-name'", "'data-affiliate-field': 'profile-name'",
  "'data-affiliate-field': 'credential-name'", 'user: auth.affiliateView',
]) assert(migrated.includes(required), `missing H-006 marker: ${required}`);

const auth = read('app/affiliate-auth.js');
assert(auth.includes('createAffiliateViewModel(affiliate, profilePhoto)'));
assert(auth.includes('AffiliateRepository.getProfilePhoto(affiliate.id, session.user)'));
assert(auth.includes("publish({ phase: 'authenticated', session, affiliate, affiliateView,"));
const repository = read('app/affiliate-repository.js');
for (const field of ['historical_email_raw', 'birth_date_raw', 'union_enrollment_date_raw']) {
  assert(repository.includes(`'${field}'`), `missing repository field: ${field}`);
}

console.log('H-006 identity projection tests: PASS');
