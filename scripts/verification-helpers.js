'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');

function assertPwaVersionSync(root = path.resolve(__dirname, '..')) {
  const html = fs.readFileSync(path.join(root, 'SutiApp.html'), 'utf8');
  const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const htmlVersion = (html.match(/app\/bundle\.js\?v=(\d+)/) || [])[1];
  const workerVersion = (serviceWorker.match(/\.\/app\/bundle\.js\?v=(\d+)/) || [])[1];

  assert.ok(htmlVersion, 'SutiApp.html bundle version is missing');
  assert.ok(workerVersion, 'sw.js bundle version is missing');
  assert.equal(workerVersion, htmlVersion, 'HTML and service worker bundle versions differ');
  assert.match(serviceWorker, /const CACHE = 'sutiapp-v\d+';/, 'service worker cache version is missing');
  return Object.freeze({ bundleVersion: htmlVersion });
}

module.exports = { assertPwaVersionSync };
