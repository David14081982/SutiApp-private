/* Read-only seniority projection. No affiliate profile or browser-persisted copy. */
(function () {
  'use strict';
  function createSeniorityRepository(provideClient) {
    const client = provideClient || (() => window.SutiSupabase.getClient());
    async function page(offset = 0, limit = 50) {
      const result = await client().rpc('get_affiliate_seniority', { p_offset: offset, p_limit: limit });
      if (result.error) throw new Error('No se pudo consultar la antigüedad. Intenta de nuevo.');
      const data = result.data;
      if (!data || !Array.isArray(data.items) || !Number.isInteger(data.total) || !data.as_of || !Number.isInteger(data.next_offset)) {
        throw new Error('La consulta de antigüedad devolvió una respuesta incompleta.');
      }
      return data;
    }
    return Object.freeze({ page });
  }
  function merge(previous, incoming) {
    const unique = new Map(previous.map(row => [row.id, row]));
    incoming.forEach(row => unique.set(row.id, row));
    return Array.from(unique.values());
  }
  function tenure(months) {
    if (!Number.isInteger(months) || months < 0) return 'Sin antigüedad';
    const years = Math.floor(months / 12), rest = months % 12;
    return (years ? years + (years === 1 ? ' año' : ' años') + ' · ' : '') + rest + (rest === 1 ? ' mes' : ' meses');
  }
  function since(row) {
    if (row.date_status === 'MISSING') return 'Fecha de ingreso no registrada';
    if (row.date_status === 'INVALID') return 'Fecha de ingreso inválida';
    if (row.date_status === 'FUTURE') return 'Fecha de ingreso futura';
    const [year, month, day] = row.entry_date.split('-');
    return 'desde ' + day + ' ' + ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][Number(month) - 1] + ' ' + year;
  }
  function csv(rows, asOf) {
    // Prevent spreadsheet formula execution while preserving textual business identifiers.
    const cell = value => '"' + String(value == null ? '' : value).replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""') + '"';
    const header = ['Unidad / Módulo', 'Posición', 'Número de control', 'Nombre', 'Ciudad', 'Ingreso', 'Antigüedad', 'Estado de fecha', 'Fecha de consulta (Hermosillo)'];
    return '\uFEFF' + [header, ...rows.map(row => [row.unit || 'Unidad no registrada', row.rank, row.numero_control, row.name, row.city, row.entry_date, tenure(row.tenure_months), row.date_status, asOf])].map(row => row.map(cell).join(',')).join('\r\n');
  }
  window.SeniorityModel = Object.freeze({ merge, tenure, since, csv });
  window.createSeniorityRepository = createSeniorityRepository;
  window.SeniorityRepository = createSeniorityRepository();
})();
