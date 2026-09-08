'use strict';
const fs = require('fs'), cp = require('child_process'), assert = require('assert').strict;
const root = require('path').resolve(__dirname, '..');
const file = 'app/screens-admin-finanzas.jsx';
const before = cp.execFileSync('git', ['show', 'c5e3a8f:' + file], { cwd: root, encoding: 'utf8' }).replace(/\r/g, '');
const after = fs.readFileSync(require('path').join(root, file), 'utf8').replace(/\r/g, '');
const sections = [
  ['    const load =', '    const closeDetail =', '    const onKeyDown ='],
  ['  function useFinancialDocumentPreviews(', '  // Presentation only:', '  function DesktopFinancialWorkbench('],
  ['    const renderConditions =', '    const renderNavigation =', '    const renderDetail ='],
  ["        h('div', { className: 'finwb-detail-scroll' },", "        h('div', { className: 'finwb-actionbar'", "        h('div', { className: 'finwb-actionbar'"],
];
for (const [start, endAfter, endBefore] of sections) {
  const extract = (text, end) => text.slice(text.indexOf(start), text.indexOf(end, text.indexOf(start))).trim();
  assert(before.includes(start) && after.includes(start), start);
  assert.equal(extract(after, endAfter), extract(before, endBefore), 'Protected data/callback/content changed: ' + start);
}
new (require('vm').Script)(after);
assert(after.includes('dialog.showModal()') && after.includes("'aria-haspopup': 'dialog'"));
assert(!after.includes("className: 'finwb-panel finwb-detail'"));
console.log(JSON.stringify({ status: 'PASS', exactBaseline: 'c5e3a8f', identicalBlocks: ['queue/detail reads, filters, action options, navigation and all save callbacks', 'document preview controller', 'conditions, workflow, product and document renderers', 'all central detail content'], frontendOnly: true }));
