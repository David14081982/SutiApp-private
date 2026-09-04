'use strict';

const assert = require('assert').strict;
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'SutiApp.html'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const dependencies = [
  {
    name: 'React',
    version: '18.3.1',
    src: 'app/vendor/react-18.3.1/react.production.min.js',
    integrity: 'sha384-DGyLxAyjq0f9SPpVevD6IgztCFlnMF6oW/XQGmfe+IsZ8TqEiDrcHkMLKI6fiB/Z',
    license: 'app/vendor/react-18.3.1/LICENSE',
  },
  {
    name: 'ReactDOM',
    version: '18.3.1',
    src: 'app/vendor/react-dom-18.3.1/react-dom.production.min.js',
    integrity: 'sha384-gTGxhz21lVGYNMcdJOyq01Edg0jhn/c22nsx0kyqP0TxaV5WVdsSH1fSDUf5YJj1',
    license: 'app/vendor/react-dom-18.3.1/LICENSE',
  },
  {
    name: 'Supabase JS',
    version: '2.112.3',
    src: 'app/vendor/supabase-js-2.112.3/supabase.min.js',
    integrity: 'sha384-l8ah+VgaWtk1mvOe9VC+OirC6qHFF4yH7l7mKRidV9MSti3E9F463bMp6ZVN4kuC',
    license: 'app/vendor/supabase-js-2.112.3/LICENSE',
  },
];

assert.doesNotMatch(html, /https:\/\/(?:unpkg\.com|cdn\.jsdelivr\.net)\//i);
assert.doesNotMatch(worker, /['"](?:unpkg\.com|cdn\.jsdelivr\.net)['"]/i);
for (const dependency of dependencies) {
  const asset = path.join(root, dependency.src);
  const license = path.join(root, dependency.license);
  assert(fs.statSync(asset).isFile(), `${dependency.name} asset missing`);
  assert(fs.statSync(license).isFile(), `${dependency.name} license missing`);
  const calculated = `sha384-${crypto.createHash('sha384').update(fs.readFileSync(asset)).digest('base64')}`;
  assert.equal(calculated, dependency.integrity, `${dependency.name} integrity mismatch`);
  assert(html.includes(`src="${dependency.src}"`), `${dependency.name} is not local`);
  assert(html.includes(`integrity="${dependency.integrity}"`), `${dependency.name} SRI missing`);
  assert(worker.includes(`'./${dependency.src}'`), `${dependency.name} absent from app shell`);
}

const fallbackAt = html.indexOf('id="suti-startup-status"');
const reactAt = html.indexOf('app/vendor/react-18.3.1/react.production.min.js');
assert(fallbackAt >= 0 && fallbackAt < reactAt, 'fallback must exist before React');
assert(html.includes('Cargando SutiApp…'));
assert(html.includes('No fue posible iniciar SutiApp'));
assert(html.includes('id="suti-startup-retry"'));
assert(html.includes('STARTUP_TIMEOUT'));
assert(html.includes('window.__sutiStartupFail'));
assert.match(worker, /const CACHE = 'sutiapp-v149'/);
assert.match(worker, /keys\.filter\(\(key\) => key !== CACHE\)/);

console.log(JSON.stringify({
  status: 'PASS',
  criticalJsLocal: true,
  externalStartupCdnDependency: 'NONE',
  htmlFallback: true,
  serviceWorkerCache: 'sutiapp-v149',
  dependencyIntegrity: dependencies.length,
}));
