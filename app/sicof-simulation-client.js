/* SICOF-only disposable, context-bound simulation. No storage or data requests. */
(function () {
  'use strict';
  function create() {
    const worker = new Worker(new URL('app/sicof-simulation-worker.js?v=321', document.baseURI));
    const pending = new Map(); let sequence = 0, closed = false, basis = null, expires = 0, original = null;
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
      async initialize(seed, workspace) {
        await request('INIT', { seed, workspace }); basis = seed.basis; expires = Date.parse(seed.expires_at); original = workspace;
      },
      supports(settings) {
        return !!basis && Date.now() < expires && settings.periodIni === basis.from && settings.periodFin <= basis.to &&
          (basis.as_of === basis.today ? settings.periodFin >= basis.today : settings.periodFin === basis.to);
      },
      async calculate(input) {
        const response = await request('CALCULATE', { input }), selection = response.selection;
        if (closed || !original) throw Error('SICOF_SIMULATION_CLOSED');
        if (!Array.isArray(selection?.payments) || !Array.isArray(selection?.loanPeriods) || selection.loanPeriods.length !== original.loans.length) throw Error('SICOF_SIMULATION_INPUT_INVALID');
        const payments = selection.payments.map(index => {
          if (!Number.isInteger(index) || index < 0 || index >= original.payments.length) throw Error('SICOF_SIMULATION_INPUT_INVALID');
          return original.payments[index];
        });
        const loans = original.loans.map((loan, index) => {
          const flags = selection.loanPeriods[index];
          if (!Array.isArray(flags) || flags.length !== loan.schedule.length || flags.some(flag => typeof flag !== 'boolean')) throw Error('SICOF_SIMULATION_INPUT_INVALID');
          const schedule = loan.schedule.map((payment, paymentIndex) => payment.in_period === flags[paymentIndex] ? payment : { ...payment, in_period: flags[paymentIndex] });
          return schedule.every((payment, paymentIndex) => payment === loan.schedule[paymentIndex]) ? loan : { ...loan, schedule };
        });
        if (!Array.isArray(response.result?.rows)) throw Error('SICOF_SIMULATION_INPUT_INVALID');
        const result = { ...response.result, rows: response.result.rows.map(({ loan_indexes, ...row }) => {
          if (!Array.isArray(loan_indexes)) throw Error('SICOF_SIMULATION_INPUT_INVALID');
          return { ...row, loans: loan_indexes.map(index => {
            if (!Number.isInteger(index) || index < 0 || index >= loans.length) throw Error('SICOF_SIMULATION_INPUT_INVALID');
            return loans[index];
          }) };
        }) };
        return { result, workspace: { loans, payments, funds: response.funds, paymentMetrics: response.paymentMetrics }, basis: response.basis, elapsed_ms: response.elapsed_ms };
      },
      close() { if (closed) return; closed = true; basis = null; original = null; worker.terminate(); fail(Error('SICOF_SIMULATION_CLOSED')); }
    };
  }
  window.SicofSimulationClient = Object.freeze({ create });
})();
