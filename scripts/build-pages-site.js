'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
// A new route must have an explicit controller and a registered backend module.
// This reads schema evidence only; it never creates permissions during a build.
require('./screen-permission-contract').check();
const outputArg = process.argv[2] || '_site';
const output = path.resolve(root, outputArg);
const url = String(process.env.SUTIAPP_SUPABASE_URL || '').trim();
const publishableKey = String(process.env.SUTIAPP_SUPABASE_PUBLISHABLE_KEY || '').trim();

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
  throw new Error('SUTIAPP_SUPABASE_URL must be an https://*.supabase.co URL');
}
if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) {
  throw new Error('SUTIAPP_SUPABASE_PUBLISHABLE_KEY must be a publishable browser key');
}
if (fs.existsSync(output)) {
  throw new Error(`Output already exists: ${output}`);
}

const publicFiles = [
  'SutiApp.html',
  'sw.js',
  'manifest.webmanifest',
  'icon-180.png',
  'icon-192.png',
  'icon-notification-badge.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'assets/branding/home-header-collapsed.webp',
  'assets/branding/credencial-puno.png',
  'app/bundle.js',
  'app/text-size.css',
  'app/vendor/react-18.3.1/react.production.min.js',
  'app/vendor/react-18.3.1/LICENSE',
  'app/vendor/react-dom-18.3.1/react-dom.production.min.js',
  'app/vendor/react-dom-18.3.1/LICENSE',
  'app/vendor/supabase-js-2.112.3/supabase.min.js',
  'app/vendor/supabase-js-2.112.3/LICENSE',
  'app/supabase-client.js',
  'app/affiliate-repository.js',
  'app/financial-legacy-repository.js',
  'app/payroll-declaration-repository.js',
];

for (const relative of publicFiles) {
  const source = path.join(root, relative);
  if (!fs.statSync(source).isFile()) throw new Error(`Required public file missing: ${relative}`);
  const target = path.join(output, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (relative.startsWith('app/vendor/') && relative.endsWith('.js')) {
    // Windows CRLF checkouts must produce the exact LF vendor bytes signed in HTML.
    const bytes = fs.readFileSync(source, 'utf8').replace(/\r\n/g, '\n');
    const html = fs.readFileSync(path.join(root, 'SutiApp.html'), 'utf8');
    const tag = [...html.matchAll(/<script\b[^>]*>/g)].map(m=>m[0]).find(t=>t.includes('src="'+relative+'"'));
    const expected = tag && /integrity="sha384-([^"]+)"/.exec(tag);
    if (!expected || crypto.createHash('sha384').update(bytes).digest('base64') !== expected[1]) throw new Error('VENDOR_INTEGRITY_MISMATCH: '+relative);
    fs.writeFileSync(target, bytes);
  } else fs.copyFileSync(source, target);
}

fs.copyFileSync(path.join(root, 'SutiApp.html'), path.join(output, 'index.html'));
fs.writeFileSync(path.join(output, '.nojekyll'), '');
fs.writeFileSync(
  path.join(output, 'app', 'supabase-config.js'),
  `window.__SUTIAPP_CONFIG__ = Object.freeze({ supabase: Object.freeze({ url: ${JSON.stringify(url)}, publishableKey: ${JSON.stringify(publishableKey)} }) });\n`,
  'utf8',
);

console.log(JSON.stringify({ status: 'PASS', output, files: publicFiles.length + 3 }));
