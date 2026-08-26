# SutiApp

SutiApp es una PWA/frontend estático. La entrada ejecutable es `SutiApp.html`, que carga el bundle precompilado `app/bundle.js`.

## Requisitos

- Un servidor HTTP local (Python 3 es suficiente).
- PowerShell para generar la configuración local de Supabase.
- Opcional: Python con `openpyxl` para utilidades administrativas concretas.

## Configuración local

1. Copia `.env.example` como `supabase.env`.
2. Completa `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` con valores del entorno correspondiente.
3. No coloques `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, tokens, contraseñas ni credenciales administrativas en archivos del frontend.
4. Genera la configuración runtime ignorada por Git:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/generate-supabase-config.ps1
```

`supabase.env` y `app/supabase-config.js` son archivos locales ignorados y nunca deben versionarse.

## Ejecución

Desde la raíz del proyecto:

```powershell
python -m http.server 8080
```

Abre `http://localhost:8080/SutiApp.html`.

## Dependencias opcionales

Solo para scripts administrativos que procesan hojas de cálculo:

```powershell
python -m pip install -r requirements-h004.txt
```

## Seguridad y despliegue

- No se incluyen perfiles de navegador, cargas locales, capturas temporales, exports, backups, Excel/CSV productivos ni documentos con PII.
- Las claves administrativas pertenecen exclusivamente a procesos server-side o secretos del proveedor.
- GitHub Pages publica exclusivamente la lista blanca generada por `scripts/build-pages-site.js`; `supabase.env`, secretos, documentación, exports y datos locales quedan fuera del artefacto.
- La URL pública es <https://david14081982.github.io/SutiApp-private/> y se despliega desde `main` mediante `.github/workflows/deploy-pages.yml`.
- El deployment no modifica dominio, DNS, Supabase Site URL ni Auth redirect URLs.
