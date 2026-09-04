'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'sutiapp-pages-'));
fs.rmdirSync(output);

const result = spawnSync(process.execPath, ['scripts/build-pages-site.js', output], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    SUTIAPP_SUPABASE_URL: 'https://example.supabase.co',
    SUTIAPP_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_QA_ONLY_NOT_REAL',
  },
});

assert.equal(result.status, 0, result.stderr || result.stdout);
const required = [
  'index.html', 'SutiApp.html', 'sw.js', 'manifest.webmanifest', '.nojekyll',
  'app/bundle.js', 'app/supabase-config.js', 'app/supabase-client.js',
  'app/vendor/react-18.3.1/react.production.min.js', 'app/vendor/react-18.3.1/LICENSE',
  'app/vendor/react-dom-18.3.1/react-dom.production.min.js', 'app/vendor/react-dom-18.3.1/LICENSE',
  'app/vendor/supabase-js-2.112.3/supabase.min.js', 'app/vendor/supabase-js-2.112.3/LICENSE',
  'app/affiliate-repository.js', 'app/financial-legacy-repository.js',
  'app/payroll-declaration-repository.js', 'assets/branding/home-header-collapsed.webp',
];
for (const relative of required) assert(fs.existsSync(path.join(output, relative)), `missing ${relative}`);

const config = fs.readFileSync(path.join(output, 'app', 'supabase-config.js'), 'utf8');
assert(config.includes('https://example.supabase.co'));
assert(config.includes('sb_publishable_QA_ONLY_NOT_REAL'));

const forbidden = ['supabase.env', '.env', 'docs', 'uploads', 'backups', '.git'];
for (const relative of forbidden) assert(!fs.existsSync(path.join(output, relative)), `forbidden ${relative}`);

const manifest = JSON.parse(fs.readFileSync(path.join(output, 'manifest.webmanifest'), 'utf8'));
assert.equal(manifest.start_url, './SutiApp.html');
assert.equal(manifest.scope, './');

const html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
assert(/navigator\.serviceWorker\.register\(["']sw\.js["']\)/.test(html));
assert(html.includes('app/supabase-config.js'));
assert(!/https:\/\/(?:unpkg\.com|cdn\.jsdelivr\.net)\//.test(html));
assert(html.includes('Cargando SutiApp…'));
assert(html.includes('No fue posible iniciar SutiApp'));
assert(html.includes('id="suti-startup-retry"'));

fs.rmSync(output, { recursive: true, force: true });
console.log(JSON.stringify({ status: 'PASS', pwa: true, forbiddenFiles: 0 }));
