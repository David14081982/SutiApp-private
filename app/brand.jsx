/* Brand primitives. Institutional seal authority is Supabase H-007.2 assets. */
(function () {
  'use strict';

  function FistMark({ color = '#910022', size = 48 }) {
    return React.createElement('svg', { width: size, height: size, viewBox: '0 0 100 100', fill: 'none', 'aria-hidden': 'true' },
      React.createElement('g', { fill: color, stroke: color, strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' },
        React.createElement('path', { d: 'M34 92 L34 70 Q34 60 42 56 L58 56 Q66 60 66 70 L66 92 Z' }),
        React.createElement('path', { d: 'M34 70 L66 70 L66 75 L34 75 Z', fill: '#fff', stroke: color, strokeWidth: 1.5 }),
        React.createElement('path', { d: 'M37 58 Q35 44 40 40 L62 40 Q65 46 64 58 Z' }),
        React.createElement('path', { d: 'M40 41 L40 30 Q40 26 43.5 26 Q47 26 47 30 L47 41 Z' }),
        React.createElement('path', { d: 'M47 41 L47 27 Q47 23 50.5 23 Q54 23 54 27 L54 41 Z' }),
        React.createElement('path', { d: 'M54 41 L54 28 Q54 24 57 24 Q60 24 60 28 L60 41 Z' }),
        React.createElement('path', { d: 'M40 44 Q33 44 32 50 Q31 55 37 56 L40 52 Z' })));
  }

  function SutiSeal({ size = 96, mono = false }) {
    const visual = window.useVisualBranding ? window.useVisualBranding() : { phase: 'loading', branding: null };
    const url = visual.phase === 'loaded' && visual.branding ? visual.branding.institutional_seal_url : null;
    return React.createElement('div', {
      'data-branding-seal-state': visual.phase,
      style: { width: size, height: size, position: 'relative', display: 'inline-block', verticalAlign: 'top' },
    }, url && React.createElement('img', {
      src: url, alt: 'Sello institucional SUTISSSTESON',
      style: { width: '100%', height: '100%', objectFit: 'contain', display: 'block', filter: mono ? 'grayscale(1)' : 'none' },
    }));
  }

  window.FistMark = FistMark;
  window.SutiSeal = SutiSeal;
})();
