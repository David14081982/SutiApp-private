/* Shared, responsive image viewer. Content assets remain owned by their domain
   repositories; this component only presents already-authorized URLs. */
(function () {
  'use strict';
  const { useEffect, useRef, useState } = React;
  const I = window.Icon;
  const MEDIA_VIEWER_LAYER = 10000;
  const VIEWER_CSS = `.su-media-viewer button:focus-visible{outline:3px solid #fff;outline-offset:2px}`;
  const viewerHeaderStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'max(12px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) 12px max(14px, env(safe-area-inset-left))', gap: 10, color: '#fff', flexShrink: 0 };

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

  function useMediaViewerDialog(open, onClose) {
    const dialogRef = useRef(null), closeButtonRef = useRef(null), openerRef = useRef(null), closeRef = useRef(onClose);
    closeRef.current = onClose;
    useEffect(() => {
      if (!open) return undefined;
      const body = document.body, html = document.documentElement;
      const previous = { bodyOverflow: body.style.overflow, htmlOverflow: html.style.overflow };
      openerRef.current = document.activeElement;
      body.style.overflow = 'hidden';
      html.style.overflow = 'hidden';
      const key = (event) => { if (event.key === 'Escape') { event.preventDefault(); closeRef.current && closeRef.current(); } };
      window.addEventListener('keydown', key);
      const frame = window.requestAnimationFrame(() => { if (closeButtonRef.current) closeButtonRef.current.focus(); else if (dialogRef.current) dialogRef.current.focus(); });
      return () => {
        window.cancelAnimationFrame(frame);
        window.removeEventListener('keydown', key);
        body.style.overflow = previous.bodyOverflow;
        html.style.overflow = previous.htmlOverflow;
        const opener = openerRef.current;
        if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
      };
    }, [open]);
    const close = () => { if (closeRef.current) closeRef.current(); };
    const backdropClick = (event) => { if (event.target === event.currentTarget) close(); };
    return { dialogRef, closeButtonRef, close, backdropClick };
  }

  function ImageViewer({ sources, startIndex = 0, alt = '', onClose }) {
    const items = normaliseSources(sources);
    const [index, setIndex] = useState(clamp(Number(startIndex) || 0, 0, Math.max(0, items.length - 1)));
    const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
    const points = useRef(new Map()), moved = useRef(false), startedOnBackdrop = useRef(false);
    const gesture = useRef(null);
    const dialog = useMediaViewerDialog(items.length > 0, onClose);
    const reset = () => setView({ scale: 1, x: 0, y: 0 });
    const select = (next) => { setIndex((current) => clamp(typeof next === 'function' ? next(current) : next, 0, items.length - 1)); reset(); };
    const zoomTo = (scale) => setView((old) => ({ scale: clamp(scale, 1, 5), x: scale <= 1 ? 0 : old.x, y: scale <= 1 ? 0 : old.y }));

    useEffect(() => {
      const key = (event) => {
        if (event.key === 'ArrowLeft' && index > 0) select(index - 1);
        else if (event.key === 'ArrowRight' && index < items.length - 1) select(index + 1);
      };
      window.addEventListener('keydown', key);
      return () => window.removeEventListener('keydown', key);
    }, [index, items.length, onClose]);

    if (!items.length) return null;
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const begin = (event) => {
      if (points.current.size === 0) { moved.current = false; startedOnBackdrop.current = event.target === event.currentTarget; }
      event.currentTarget.setPointerCapture && event.currentTarget.setPointerCapture(event.pointerId);
      points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const values = Array.from(points.current.values());
      if (values.length > 1) moved.current = true;
      gesture.current = values.length > 1
        ? { kind: 'pinch', distance: distance(values[0], values[1]), center: midpoint(values[0], values[1]), view }
        : { kind: 'pan', point: values[0], view };
    };
    const move = (event) => {
      if (!points.current.has(event.pointerId)) return;
      points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const values = Array.from(points.current.values()), start = gesture.current;
      if (!start) return;
      if (start.kind === 'pan' && values[0] && Math.hypot(values[0].x - start.point.x, values[0].y - start.point.y) > 6) moved.current = true;
      if (values.length > 1) {
        moved.current = true;
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
    const closeFromCanvas = (event) => { const shouldClose = startedOnBackdrop.current && event.target === event.currentTarget && !moved.current; startedOnBackdrop.current = false; moved.current = false; if (shouldClose) dialog.close(); };
    const iconButton = (name, label, action, disabled, buttonRef) => React.createElement('button', {
      ref: buttonRef, type: 'button', onClick: (event) => { event.stopPropagation(); action(); }, disabled, 'aria-label': label,
      style: { width: 48, height: 48, border: 'none', borderRadius: 14, background: 'rgba(255,255,255,.14)', color: '#fff', display: 'grid', placeItems: 'center', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? .35 : 1, flexShrink: 0 }
    }, name === 'minus'
      ? React.createElement('span', { 'aria-hidden': 'true', style: { fontSize: 24, fontWeight: 700, lineHeight: 1 } }, '−')
      : React.createElement(I, { name, size: 21, stroke: 2.2 }));

    return React.createElement('div', {
      ref: dialog.dialogRef, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Visor de imagen', tabIndex: -1, className: 'su-media-viewer', 'data-image-viewer': 'open', onClick: dialog.backdropClick,
      style: { position: 'fixed', inset: 0, zIndex: MEDIA_VIEWER_LAYER, background: 'rgba(7,5,6,.96)', display: 'flex', flexDirection: 'column', animation: 'su-fadein .2s ease', overscrollBehavior: 'contain' }
    },
      React.createElement('style', null, VIEWER_CSS),
      React.createElement('div', { style: viewerHeaderStyle },
        React.createElement('div', { style: { fontSize: 12, fontWeight: 800, opacity: .8 } }, items.length > 1 ? `${index + 1} / ${items.length}` : 'Imagen'),
        React.createElement('div', { style: { display: 'flex', gap: 7 } },
          iconButton('minus', 'Alejar', () => zoomTo(view.scale - .5), view.scale <= 1),
          iconButton('search', 'Restablecer zoom', reset, view.scale === 1 && view.x === 0 && view.y === 0),
          iconButton('plus', 'Acercar', () => zoomTo(view.scale + .5), view.scale >= 5),
          iconButton('close', 'Cerrar', dialog.close, false, dialog.closeButtonRef))),
      React.createElement('div', {
        onClick: closeFromCanvas, onPointerDown: begin, onPointerMove: move, onPointerUp: end, onPointerCancel: end,
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

  function DocumentViewer({ source, mimeType = '', title = 'Documento', onClose }) {
    const [loaded, setLoaded] = useState(false);
    const mime = String(mimeType || '').toLowerCase();
    const isImage = mime.startsWith('image/');
    const isPdf = mime === 'application/pdf';
    const dialog = useMediaViewerDialog(!!source && !isImage, onClose);

    if (!source) return null;
    if (isImage) return React.createElement(ImageViewer, { sources: [source], alt: title, onClose });

    return React.createElement('div', {
      ref: dialog.dialogRef, role: 'dialog', 'aria-modal': 'true', 'aria-label': `Visor de ${title}`, tabIndex: -1, className: 'su-media-viewer', onClick: dialog.backdropClick,
      'data-document-viewer': isPdf ? 'pdf' : 'unsupported',
      style: { position: 'fixed', inset: 0, zIndex: MEDIA_VIEWER_LAYER, background: 'rgba(7,5,6,.96)', display: 'flex', flexDirection: 'column', animation: 'su-fadein .2s ease', overscrollBehavior: 'contain' }
    },
      React.createElement('style', null, VIEWER_CSS),
      React.createElement('div', { style: viewerHeaderStyle },
        React.createElement('div', { style: { minWidth: 0, fontSize: 13, fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, title),
        React.createElement('button', {
          ref: dialog.closeButtonRef, type: 'button', onClick: dialog.close, 'aria-label': 'Cerrar visor',
          style: { width: 48, height: 48, border: 'none', borderRadius: 14, background: 'rgba(255,255,255,.14)', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }
        }, React.createElement(I, { name: 'close', size: 21, stroke: 2.2 }))),
      isPdf
        ? React.createElement('div', { onClick: dialog.backdropClick, style: { position: 'relative', flex: 1, minHeight: 0, padding: '0 max(10px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left))' } },
          !loaded && React.createElement('div', { role: 'status', style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 12, fontWeight: 800 } }, 'Cargando documento…'),
          React.createElement('iframe', {
            src: source, title, onLoad: () => setLoaded(true),
            style: { position: 'relative', width: '100%', height: '100%', border: 0, borderRadius: 14, background: '#fff', opacity: loaded ? 1 : 0 }
          }))
        : React.createElement('div', { onClick: dialog.backdropClick, style: { flex: 1, display: 'grid', placeItems: 'center', padding: '24px max(24px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left))', color: '#fff', textAlign: 'center' } },
          React.createElement('div', null,
            React.createElement('div', { style: { width: 68, height: 68, margin: '0 auto 14px', borderRadius: 20, background: 'rgba(255,255,255,.12)', display: 'grid', placeItems: 'center' } }, React.createElement(I, { name: 'doc', size: 32, stroke: 1.8 })),
            React.createElement('div', { style: { fontSize: 15, fontWeight: 850 } }, title),
            React.createElement('div', { style: { maxWidth: 300, marginTop: 7, fontSize: 12, lineHeight: 1.5, opacity: .75 } }, 'Este formato no tiene una vista previa integrada. El documento permanece disponible en tu expediente.'))));
  }

  Object.assign(window, { ImageViewer, DocumentViewer, openSafeContentUrl, useMediaViewerDialog, MEDIA_VIEWER_LAYER });
})();
