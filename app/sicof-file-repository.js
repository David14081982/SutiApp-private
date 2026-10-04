/* Explicit SICOF file preparation. No persisted browser data or finance writer. */
(function () {
  'use strict';
  function identity() {
    const auth = window.AffiliateAuth.getState(), actor = auth.session?.user?.id;
    if (auth.phase !== 'authenticated' || !actor) throw Error('SICOF_AUTH_REQUIRED');
    let session = auth.session.session_id || '';
    if (!session && auth.session.access_token) { try { session = JSON.parse(atob(auth.session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).session_id || ''; } catch (_) {} }
    return { actor, affiliate: auth.affiliate?.id || null, session, key: window.SicofView.contextKey() };
  }
  async function invoke(action, values) {
    const subject = identity(), result = await window.SutiSupabase.getClient().functions.invoke('sicof', { body: { action, ...values } });
    if (identity().key !== subject.key) throw Error('SICOF_CONTEXT_CHANGED');
    if (result.error) { let body; try { body = await result.error.context.clone().json(); } catch (_) {} throw Error(body?.error || 'SICOF_UNAVAILABLE'); }
    const response = result.data, context = response?.context;
    if (!response || response.error) throw Error(response?.error || 'SICOF_RESPONSE_INVALID');
    if (context?.actor !== subject.actor || context.effective_affiliate !== subject.affiliate || subject.session && context.session !== subject.session) throw Error('SICOF_CONTEXT_CHANGED');
    return response.data;
  }
  function download(bytes, filename, type) {
    const url = URL.createObjectURL(new Blob([bytes], { type })), link = document.createElement('a');
    link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function downloadResponse(result) {
    if (typeof result?.base64 !== 'string' || typeof result.filename !== 'string') throw Error('SICOF_EXPORT_INVALID');
    download(Uint8Array.from(atob(result.base64), c => c.charCodeAt(0)), result.filename, result.content_type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return result;
  }
  let excelPromise;
  function excel() {
    if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
    if (!excelPromise) excelPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = new URL('app/vendor/exceljs-4.4.0/exceljs.min.js', document.baseURI).href;
      script.integrity = 'sha384-Pqp51FUN2/qzfxZxBCtF0stpc9ONI6MYZpVqmo8m20SoaQCzf+arZvACkLkirlPz'; script.crossOrigin = 'anonymous';
      script.onload = () => window.ExcelJS ? resolve(window.ExcelJS) : reject(Error('SICOF_EXCEL_UNAVAILABLE'));
      script.onerror = () => { script.remove(); excelPromise = null; reject(Error('SICOF_EXCEL_UNAVAILABLE')); }; document.head.appendChild(script);
    });
    return excelPromise;
  }
  async function prepare(file, settings) {
    if (!file || !/\.xlsx$/i.test(file.name) || file.size < 1 || file.size > 6 * 1024 * 1024) throw Error('SICOF_FILE_SIZE_OR_TYPE_INVALID');
    const bytes = new Uint8Array(await file.arrayBuffer()); let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return invoke('FILE_WORKSPACE', { settings, costs: [], bank: { amount: null, declaredBy: '', date: '' }, compact: true, file: { name: file.name, base64: btoa(binary) } });
  }
  async function exportBase(file, settings) {
    const subject = identity();
    if (!file || !Array.isArray(file.rows) || !Array.isArray(file.headers) || file.headers.length !== 15 || !/^\d{4}-\d{2}-\d{2}$/.test(settings.periodIni) || !/^\d{4}-\d{2}-\d{2}$/.test(settings.periodFin) || settings.periodIni > settings.periodFin || settings.periodIni < file.from || settings.periodFin > file.to) throw Error('SICOF_FILE_RANGE_REQUIRED');
    const funds = settings.src === 'todos' ? null : new Set(['Caja de Ahorro', ...(settings.src === 'sel' ? settings.selFunds : [])]);
    if (Array.isArray(file.basis?.funds) && (!funds || [...funds].some(fund => !file.basis.funds.includes(fund)))) throw Error('SICOF_FILE_RANGE_REQUIRED');
    const selected = file.rows.filter(row => row[0] >= settings.periodIni && row[0] <= settings.periodFin && (!funds || funds.has(row[6])));
    const ExcelJS = await excel(); if (identity().key !== subject.key) throw Error('SICOF_CONTEXT_CHANGED');
    const book = new ExcelJS.Workbook(), sheet = book.addWorksheet('HISTORIAL P V2');
    sheet.addRow(file.headers); for (const row of selected) sheet.addRow(row.slice(0, 15));
    sheet.getRow(1).font = { bold: true }; sheet.views = [{ state: 'frozen', ySplit: 1 }]; sheet.autoFilter = { from: 'A1', to: 'O1' };
    sheet.columns.forEach((column, index) => { column.width = index === 4 ? 35 : index === 6 ? 30 : 19; });
    const bytes = await book.xlsx.writeBuffer(); if (identity().key !== subject.key) throw Error('SICOF_CONTEXT_CHANGED');
    const filename = 'SICOF_base_' + settings.periodIni + '_' + settings.periodFin + '.xlsx';
    download(bytes, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); return { filename };
  }
  window.SicofFileRepository = Object.freeze({
    funds: values => invoke('SOURCE_FUNDS', values),
    downloadSource: async settings => downloadResponse(await invoke('DOWNLOAD_SOURCE', { settings })),
    prepare, exportBase,
    exportReport: async (kind, values) => downloadResponse(await invoke('EXPORT', { kind, ...values })),
    saveScenario: values => invoke('SAVE_SCENARIO', { ...values, key: values.key || crypto.randomUUID() })
  });
})();
