/* Reproducible SutiApp bundle builder. Optional Babel path supports sources with JSX syntax. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const babelPath = process.argv[2];
const sandbox = {};
if (babelPath) {
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.resolve(babelPath), 'utf8'), sandbox, { filename: babelPath });
  if (!sandbox.Babel) throw new Error('Babel Standalone failed to initialize');
}

const files = [
  'vendor-qrcode-generator.js',
  'assets-registry.jsx', 'assets-store.jsx', 'assets-resolver.jsx', 'motion.jsx',
  'icons.jsx', 'brand.jsx', 'ui.jsx', 'image-viewer.jsx', 'rich-text.jsx', 'press.jsx', 'reveal-cards.jsx',
  'union-screen-registry.js', 'data.jsx', 'visual-repositories.js', 'visual-content.js', 'content-repositories.js', 'content-state.js', 'admin-repository.js', 'admin-cutover-repository.js', 'data-export-repository.js', 'program-request-repository.js', 'document-workflow-repository.js', 'bank-account-repository.js', 'program-terms-repository.js', 'credential-qr-repository.js', 'marketplace-repository.js', 'program-catalog-repository.js', 'popup-proposal-repository.js', 'payroll-declaration-repository.js',
  'institutional-repositories.js', 'institutional-content.js', 'tweaks-panel.jsx', 'signature.jsx',
  'screens-home-r2.jsx', 'screens-financiera.jsx', 'screens-inversion.jsx', 'screens-loan.jsx',
  'screens-marketplace.jsx', 'screens-terreno.jsx', 'screens-convenios.jsx',
  'screens-historial.jsx', 'screens-credencial.jsx', 'image-slot.js',
  'screens-documentos.jsx', 'admin-store.jsx', 'admin-cutover-store.jsx', 'custom-screen.jsx',
  'sindicato-store.jsx', 'finance-store.jsx', 'quotes-store.jsx', 'operations-store.jsx', 'flow-store.jsx',
  'funds-store.jsx', 'admin-popup-editor.jsx',
  'section-responsibility.jsx', 'screens-admin-roles.jsx', 'screens-admin-content.jsx', 'screens-admin-news.jsx',
  'screens-admin-convenios.jsx', 'screens-admin-sindicato.jsx', 'screens-admin-finanzas.jsx', 'screens-admin-fondos.jsx', 'screens-admin-fincat.jsx', 'screens-admin-flujos.jsx', 'screens-admin-documents.jsx',
  'fincat-store.jsx',
  'screens-admin-branding.jsx', 'screens-admin-visual-crud.jsx', 'screens-admin-identity.jsx', 'screens-admin-pantallas.jsx', 'screens-admin-requests.jsx', 'screens-admin-data-exports.jsx', 'screens-admin.jsx',
  'company-store.jsx', 'catalog-store.jsx', 'screens-catalogo.jsx',
  'screens-admin-catalogo.jsx', 'screens-admin-planes.jsx', 'membership-repository.js', 'membership-store.jsx',
  'screens-membresias.jsx', 'screens-membership-application.jsx', 'screens-admin-membresias.jsx',
  'screens-company-modules.jsx', 'screens-company.jsx', 'copy-store.jsx',
  'live-text.jsx', 'affiliate-view-model.js', 'affiliate-auth.js', 'app.jsx',
];

const chunks = files.map((file) => {
  const filePath = path.join(root, 'app', file);
  const source = fs.readFileSync(filePath, 'utf8');
  const code = file.endsWith('.jsx') && sandbox.Babel
    ? sandbox.Babel.transform(source, { presets: ['react'], filename: file }).code
    : source.trimEnd();
  return `/* @@file ${file} */\n(function(){\n${code}\n})();\n`;
});

const destination = path.join(root, 'app', 'bundle.js');
const output = chunks.join('');
try {
  new vm.Script(output, { filename: 'app/bundle.js' });
} catch (error) {
  const hint = babelPath ? '' : ' Pass a Babel Standalone path as the first argument for JSX sources.';
  throw new Error(`Bundle syntax validation failed before write: ${error.message}.${hint}`);
}
fs.writeFileSync(destination, output, 'utf8');
process.stdout.write(`Built ${path.relative(root, destination)} from ${files.length} files.\n`);
