/* SICOF-only disposable, context-bound simulation. No storage or data requests. */
(function () {
  'use strict';
  function create() {
    const worker = new Worker(new URL('app/sicof-simulation-worker.js?v=322', document.baseURI));
    const pending = new Map(), selections = new Map(); let sequence = 0, closed = false, basis = null, expires = 0, original = null, participants = null, fileBasis = null, active = false, queued = null;
    function fail(error) { for (const item of pending.values()) { clearTimeout(item.timer); item.reject(error); } pending.clear(); }
    worker.onerror = () => fail(Error('SICOF_SIMULATION_WORKER_FAILED'));
    worker.onmessage = event => {
      const message = event.data, item = pending.get(message?.id); if (!item) return;
      pending.delete(message.id); clearTimeout(item.timer);
      if (message.error) item.reject(Error(message.error)); else item.resolve(message.data);
    };
    function request(type, values) {
      if (closed) return Promise.reject(Error('SICOF_SIMULATION_CLOSED'));
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(Error('SICOF_SIMULATION_TIMEOUT')); }, 10000);
        pending.set(id, { resolve, reject, timer });
        try { worker.postMessage({ id, type, ...values }); } catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
      });
    }
    return {
      async initialize(seed, workspace, initialInput) {
        // The worker needs calculation inputs only. Keep historical report
        // layouts and repeated detail arrays in the UI, without cloning them.
        const calculationWorkspace = { loans: workspace.loans, payments: workspace.payments, paymentMetrics: workspace.paymentMetrics, funds: workspace.funds, source: workspace.source };
        await request('INIT', { seed, workspace: calculationWorkspace, initialInput }); basis = seed.basis; expires = Date.parse(seed.expires_at); original = workspace; participants = seed.context.participants; fileBasis = seed.mode === 'FILE' ? seed.file_basis : null;
      },
      supports(settings) {
        const funds = settings.src === 'todos' ? null : ['Caja de Ahorro', ...(settings.src === 'sel' ? settings.selFunds : [])];
        return !!basis && (fileBasis || Date.now() < expires) && settings.periodIni === basis.from && settings.periodFin <= basis.to &&
          (basis.as_of === basis.today ? settings.periodFin >= basis.today : settings.periodFin === basis.to) &&
          (!Array.isArray(fileBasis?.funds) || funds && funds.every(fund => fileBasis.funds.includes(fund)));
      },
      async calculate(input) {
        const response = await schedule(input), selection = response.selection;
        if (closed || !original) throw Error('SICOF_SIMULATION_CLOSED');
        if (!Array.isArray(selection?.payments) || !Array.isArray(selection?.loan_changes) || typeof selection.range_key !== 'string') throw Error('SICOF_SIMULATION_INPUT_INVALID');
        let projection = selections.get(selection.range_key);
        if (!projection) {
        const payments = selection.payments.map(index => {
          if (!Number.isInteger(index) || index < 0 || index >= original.payments.length) throw Error('SICOF_SIMULATION_INPUT_INVALID');
          return original.payments[index];
        });
        const loans = original.loans.slice(), seen = new Set();
        for (const entry of selection.loan_changes) {
          if (!Array.isArray(entry) || entry.length !== 2) throw Error('SICOF_SIMULATION_INPUT_INVALID');
          const [index, changes] = entry;
          if (!Number.isInteger(index) || index < 0 || index >= loans.length || seen.has(index) || !Array.isArray(changes)) throw Error('SICOF_SIMULATION_INPUT_INVALID');
          seen.add(index); const loan = original.loans[index], schedule = loan.schedule.slice(), changed = new Set();
          for (const pair of changes) {
            if (!Array.isArray(pair) || pair.length !== 2) throw Error('SICOF_SIMULATION_INPUT_INVALID');
            const [paymentIndex, flag] = pair;
            if (!Number.isInteger(paymentIndex) || paymentIndex < 0 || paymentIndex >= schedule.length || changed.has(paymentIndex) || typeof flag !== 'boolean') throw Error('SICOF_SIMULATION_INPUT_INVALID');
            changed.add(paymentIndex); schedule[paymentIndex] = { ...loan.schedule[paymentIndex], in_period: flag };
          }
          loans[index] = { ...loan, schedule };
        }
        projection = { payments, loans }; if (selections.size >= 16) selections.delete(selections.keys().next().value); selections.set(selection.range_key, projection);
        }
        const { payments, loans } = projection;
        if (!Array.isArray(response.result?.rows)) throw Error('SICOF_SIMULATION_INPUT_INVALID');
        const result = { ...response.result, rows: response.result.rows.map(({ loan_indexes, participant_index, ...row }) => {
          if (!Array.isArray(loan_indexes)) throw Error('SICOF_SIMULATION_INPUT_INVALID');
          if (!Number.isInteger(participant_index) || participant_index < 0 || participant_index >= participants.length) throw Error('SICOF_SIMULATION_INPUT_INVALID');
          const person = participants[participant_index];
          return { ...row, movements: person.composition?.movements || person.transactions || [], periods: person.composition?.periods || [], loans: loan_indexes.map(index => {
            if (!Number.isInteger(index) || index < 0 || index >= loans.length) throw Error('SICOF_SIMULATION_INPUT_INVALID');
            return loans[index];
          }) };
        }) };
        return { result, workspace: { loans, payments, funds: response.funds, paymentMetrics: response.paymentMetrics }, basis: response.basis, elapsed_ms: response.elapsed_ms };
      },
      close() { if (closed) return; closed = true; basis = null; original = null; participants = null; fileBasis = null; selections.clear(); if (queued) queued.reject(Error('SICOF_SIMULATION_CLOSED')); queued = null; worker.terminate(); fail(Error('SICOF_SIMULATION_CLOSED')); }
    };
    function schedule(input) {
      if (closed) return Promise.reject(Error('SICOF_SIMULATION_CLOSED'));
      return new Promise((resolve, reject) => {
        if (queued) queued.reject(Error('SICOF_SIMULATION_SUPERSEDED'));
        queued = { input, resolve, reject }; pump();
      });
    }
    function pump() {
      if (closed || active || !queued) return;
      const next = queued; queued = null; active = true;
      request('CALCULATE', { input: next.input }).then(next.resolve, next.reject).finally(() => { active = false; pump(); });
    }
  }
  window.SicofSimulationClient = Object.freeze({ create });
})();
