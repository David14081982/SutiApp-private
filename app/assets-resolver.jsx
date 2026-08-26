/* assets-resolver.jsx — F1.3
   Único punto de resolución de un recurso visual. SIN CONSUMIDORES en F1.3.

   Cadena de precedencia (primera que gane):
     1. override del admin (assetsStore)         source: 'override'
     2. imagen subida por el usuario (ImageSlotAPI por entry.slot)  'slot'
     3. src por defecto del registro             'registry-src'
     4. icono del registro                       'registry-icon'
     5. fallback de ICON_CATALOG                 'fallback'

   Nunca devuelve null: un resKey desconocido resuelve al icono fallback, igual
   que Icon desde F1.1. Un resKey vacío sí devuelve null (nada que pintar).
*/
(function () {
  function fallbackIcon() {
    const cat = window.ICON_CATALOG;
    return (cat && cat.fallback) || 'grid';
  }

  function resolve(resKey) {
    if (!resKey) return null;
    const reg = window.ASSETS_REGISTRY;
    const entry = reg && reg.get ? reg.get(resKey) : null;
    const ov = window.assetsStore ? window.assetsStore.get(resKey) : null;

    if (ov && ov.url) return { key: resKey, kind: 'image', url: ov.url, icon: (entry && entry.icon) || fallbackIcon(), source: 'override' };
    if (ov && ov.icon) return { key: resKey, kind: 'icon', icon: ov.icon, url: null, source: 'override' };

    if (entry && entry.slot && window.ImageSlotAPI) {
      const u = window.ImageSlotAPI.get(entry.slot);
      if (u) return { key: resKey, kind: 'image', url: u, icon: entry.icon || fallbackIcon(), source: 'slot' };
    }
    if (entry && entry.src) return { key: resKey, kind: 'image', url: entry.src, icon: entry.icon || fallbackIcon(), source: 'registry-src' };
    if (entry && entry.icon) return { key: resKey, kind: 'icon', icon: entry.icon, url: null, source: 'registry-icon' };

    return { key: resKey, kind: 'icon', icon: fallbackIcon(), url: null, source: 'fallback' };
  }

  // Re-render en cambios de override o de slot. Hook, no polling.
  function useAsset(resKey) {
    const [, bump] = React.useState(0);
    React.useEffect(() => {
      if (!window.assetsStore) return;
      return window.assetsStore.subscribe(() => bump((n) => n + 1));
    }, []);
    return resolve(resKey);
  }

  /* <Res resKey size style alt /> — pinta el recurso resuelto:
     imagen → <img>, icono → <Icon>. Props extra pasan al nodo final. */
  function Res({ resKey, size = 24, alt = '', style, radius, fit = 'cover', ...rest }) {
    const r = useAsset(resKey);
    if (!r) return null;
    if (r.kind === 'image') {
      return React.createElement('img', {
        src: r.url, alt,
        width: size, height: size,
        style: Object.assign({ width: size, height: size, objectFit: fit, borderRadius: radius, display: 'block' }, style),
        ...rest,
      });
    }
    return React.createElement(window.Icon, { name: r.icon, size, style, ...rest });
  }

  /* <ResTile resKey ...IconTileProps /> — IconTile alimentado por el registro.
     Con recurso de imagen, la imagen ocupa el tile completo. */
  function ResTile({ resKey, size = 52, radius, ...rest }) {
    const r = useAsset(resKey);
    if (!r) return null;
    const rr = radius != null ? radius : Math.round(size * 0.32);
    if (r.kind === 'image') {
      return React.createElement('div', {
        style: { width: size, height: size, borderRadius: rr, overflow: 'hidden', flexShrink: 0, boxShadow: 'var(--neo-sm)' },
      }, React.createElement('img', { src: r.url, alt: '', style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' } }));
    }
    return React.createElement(window.IconTile, Object.assign({ icon: r.icon, size, radius: rr }, rest));
  }

  /* <ResSlot resKey ...imageSlotAttrs /> — recurso de imagen que el USUARIO
     llena arrastrando: mantiene el <image-slot> real (misma UX, mismo nodo).
     Solo cuando el admin fija un override se pinta un <img> en su lugar. */
  function ResSlot({ resKey, style, fit = 'cover', shape = 'rect', placeholder = '', ...rest }) {
    const r = useAsset(resKey);
    const reg = window.ASSETS_REGISTRY;
    const entry = reg && reg.get ? reg.get(resKey) : null;
    if (r && r.source === 'override' && r.url) {
      return React.createElement('img', { src: r.url, alt: '', style: Object.assign({ width: '100%', height: '100%', objectFit: fit, display: 'block' }, style), ...rest });
    }
    const slot = entry && entry.slot;
    if (!slot) return null;
    return React.createElement('image-slot', Object.assign({ id: slot, shape, fit, placeholder, style }, rest));
  }

  window.AssetsResolver = Object.freeze({ resolve });
  Object.assign(window, { Res, ResTile, ResSlot, useAsset });
})();
