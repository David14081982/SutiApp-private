/* Shared, responsive image viewer. Content assets remain owned by their domain
   repositories; this component only presents already-authorized URLs. */
(function () {
  'use strict';
  const { useEffect, useRef, useState } = React;
  const I = window.Icon;

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function normaliseSources(sources) {
    return (Array.isArray(sources) ? sources : [sources]).filter((src) => typeof src === 'string' && src.trim());
  }
  function openSafeContentUrl(raw) {
    try {
      const target = new URL(String(raw || '').trim(), window.location.href);
      if (target.protocol !== 'http:' && target.protocol !== 'https:') return false;
      window.open(target.href, '_blank', 'noopener,noreferrer');
      return true;
    } catch (_) { return false; }
  }

  function ImageViewer({ sources, startIndex = 0, alt = '', onClose }) {
    const items = normaliseSources(sources);
    const [index, setIndex] = useState(clamp(Number(startIndex) || 0, 0, Math.max(0, items.length - 1)));
    const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
    const points = useRef(new Map());
    const gesture = useRef(null);
    const reset = () => setView({ scale: 1, x: 0, y: 0 });
    const select = (next) => { setIndex((current) => clamp(typeof next === 'function' ? next(current) : next, 0, items.length - 1)); reset(); };
    const zoomTo = (scale) => setView((old) => ({ scale: clamp(scale, 1, 5), x: scale <= 1 ? 0 : old.x, y: scale <= 1 ? 0 : old.y }));

    useEffect(() => {
      const key = (event) => {
        if (event.key === 'Escape') onClose();
        else if (event.key === 'ArrowLeft' && index > 0) select(index - 1);
        else if (event.key === 'ArrowRight' && index < items.length - 1) select(index + 1);
      };
      window.addEventListener('keydown', key);
      return () => window.removeEventListener('keydown', key);
    }, [index, items.length, onClose]);

    if (!items.length) return null;
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const begin = (event) => {
      event.currentTarget.setPointerCapture && event.currentTarget.setPointerCapture(event.pointerId);
      points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const values = Array.from(points.current.values());
      gesture.current = values.length > 1
        ? { kind: 'pinch', distance: distance(values[0], values[1]), center: midpoint(values[0], values[1]), view }
        : { kind: 'pan', point: values[0], view };
    };
    const move = (event) => {
      if (!points.current.has(event.pointerId)) return;
      points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const values = Array.from(points.current.values()), start = gesture.current;
      if (!start) return;
      if (values.length > 1) {
        if (start.kind !== 'pinch') { gesture.current = { kind: 'pinch', distance: distance(values[0], values[1]), center: midpoint(values[0], values[1]), view }; return; }
        const center = midpoint(values[0], values[1]);
        const scale = clamp(start.view.scale * distance(values[0], values[1]) / Math.max(1, start.distance), 1, 5);
        setView({ scale, x: start.view.x + center.x - start.center.x, y: start.view.y + center.y - start.center.y });
      } else if (start.kind === 'pan' && start.view.scale > 1) {
        setView({ scale: start.view.scale, x: start.view.x + values[0].x - start.point.x, y: start.view.y + values[0].y - start.point.y });
      }
    };
    const end = (event) => {
      points.current.delete(event.pointerId);
      const values = Array.from(points.current.values());
      gesture.current = values.length ? { kind: 'pan', point: values[0], view } : null;
    };
    const iconButton = (name, label, action, disabled) => React.createElement('button', {
      onClick: (event) => { event.stopPropagation(); action(); }, disabled, 'aria-label': label,
      style: { width: 42, height: 42, border: 'none', borderRadius: 13, background: 'rgba(255,255,255,.14)', color: '#fff', display: 'grid', placeItems: 'center', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? .35 : 1 }
    }, name === 'minus'
      ? React.createElement('span', { 'aria-hidden': 'true', style: { fontSize: 24, fontWeight: 700, lineHeight: 1 } }, '−')
      : React.createElement(I, { name, size: 21, stroke: 2.2 }));

    return React.createElement('div', {
      role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Visor de imagen', 'data-image-viewer': 'open', onClick: onClose,
      style: { position: 'absolute', inset: 0, zIndex: 120, background: 'rgba(7,5,6,.96)', display: 'flex', flexDirection: 'column', animation: 'su-fadein .2s ease' }
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', gap: 10, color: '#fff' } },
        React.createElement('div', { style: { fontSize: 12, fontWeight: 800, opacity: .8 } }, items.length > 1 ? `${index + 1} / ${items.length}` : 'Imagen'),
        React.createElement('div', { style: { display: 'flex', gap: 7 } },
          iconButton('minus', 'Alejar', () => zoomTo(view.scale - .5), view.scale <= 1),
          iconButton('search', 'Restablecer zoom', reset, view.scale === 1 && view.x === 0 && view.y === 0),
          iconButton('plus', 'Acercar', () => zoomTo(view.scale + .5), view.scale >= 5),
          iconButton('close', 'Cerrar', onClose))),
      React.createElement('div', {
        onClick: (event) => event.stopPropagation(), onPointerDown: begin, onPointerMove: move, onPointerUp: end, onPointerCancel: end,
        onDoubleClick: () => zoomTo(view.scale > 1 ? 1 : 2.5),
        onWheel: (event) => { event.preventDefault(); zoomTo(view.scale + (event.deltaY < 0 ? .35 : -.35)); },
        style: { flex: 1, minHeight: 0, overflow: 'hidden', display: 'grid', placeItems: 'center', touchAction: 'none', cursor: view.scale > 1 ? 'grab' : 'zoom-in' }
      }, React.createElement('img', {
        src: items[index], alt: alt || 'Imagen ampliada', draggable: false,
        style: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', userSelect: 'none', transform: `translate3d(${view.x}px,${view.y}px,0) scale(${view.scale})`, transition: points.current.size ? 'none' : 'transform .16s ease', willChange: 'transform' }
      })),
      items.length > 1 && React.createElement('div', { style: { display: 'flex', justifyContent: 'center', gap: 12, padding: '10px 14px calc(14px + env(safe-area-inset-bottom))' } },
        iconButton('arrowL', 'Imagen anterior', () => select(index - 1), index === 0),
        iconButton('arrowR', 'Imagen siguiente', () => select(index + 1), index === items.length - 1)));
  }

  Object.assign(window, { ImageViewer, openSafeContentUrl });
})();
