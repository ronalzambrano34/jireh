# Jireh

Sistema operativo interno para gestionar pedidos de transferencia, efectivo, saldo movil y divisa.

La regla de negocio viva esta en `Manual de Negocio.txt`. Cada cambio importante del sistema debe quedar reflejado ahi.

## Estructura

```text
Jireh/
  Manual de Negocio.txt
  README.md
  Backend/
    main.py
    database.py
    config.py
    models/
    routes/
    schemas/
    services/
    scripts/
    requirements.txt
  Frontend/
```

## Backend

El backend es FastAPI y ahora se ejecuta como paquete `Backend`.

Comandos recomendados desde la raiz del proyecto:

```bash
Backend/venv/bin/python -m uvicorn Backend.main:app --reload
Backend/venv/bin/python Backend/scripts/smoke_pedidos.py
Backend/venv/bin/python Backend/scripts/smoke_admin.py
```

Nota: el entorno virtual fue movido junto al backend. Si algun ejecutable dentro de `Backend/venv/bin/` falla por rutas viejas, recrear el entorno virtual dentro de `Backend/`:

```bash
cd Backend
python3 -m venv venv
venv/bin/python -m pip install -r requirements.txt
cd ..
```

## Frontend

`Frontend/` contiene la app web interna con React, TypeScript y Vite.

Incluye:

- Login de operador con token Bearer.
- Inicio con tasas operativas, paquetes de saldo y accesos rapidos para crear pedidos.
- Creacion de pedidos de transferencia, efectivo, saldo movil, divisa y otros.
- Bandeja de pedidos por estado con vista lista/cuadricula, alcance por operador y bloqueo operativo.
- Detalle operativo con datos copiables, evidencias, historial, redireccion entre operadores y cambio de estado.
- Mensajes WhatsApp para instrucciones de pago, grupo operativo y grupo de finalizados segun el estado.
- Reportes operativos, perfil del operador, cambio de contraseña, foto de perfil y administracion de catalogos/personas.

Antes de ejecutarlo hay que instalar Node.js/npm. Luego:

```bash
cd Frontend
npm install
npm run dev
```

El frontend consume la API con:

```bash
VITE_API_URL=http://127.0.0.1:8000
```

El backend permite los origenes definidos en `FRONTEND_ORIGINS` dentro de `Backend/.env`; por defecto acepta `http://127.0.0.1:5173` y `http://localhost:5173`.

Variables utiles en `Backend/.env`:

```bash
OPERADOR_ADMIN_NOMBRE="Ronal Zambrano Ferrer"
OPERADOR_ADMIN_TELEFONO="+5548991233191"
OPERADOR_ADMIN_PASSWORD="contraseña-local"
```

Al arrancar el backend se crea o actualiza ese operador como `admin`. La contraseña solo se toma de `.env`; no hay contraseña de admin escrita en el codigo.

## Publicacion en GitHub Pages

GitHub Pages puede publicar el frontend estatico de `Frontend/dist`. El backend FastAPI no corre en GitHub Pages; debe desplegarse en un servicio aparte como Render, Railway, Fly.io, VPS o similar.

El repo incluye el workflow `.github/workflows/frontend-pages.yml`. Para usarlo:

1. Subir el proyecto a un repositorio de GitHub.
2. En GitHub, ir a `Settings > Pages` y seleccionar `GitHub Actions` como fuente.
3. En `Settings > Secrets and variables > Actions > Variables`, crear `VITE_API_URL` con la URL publica del backend, por ejemplo `https://api.tudominio.com`.
4. Hacer push a la rama `main`. GitHub Actions construye `Frontend/` y publica el sitio.

Para probar localmente la misma salida:

```bash
cd Frontend
npm ci
npm run build
npm run preview
```

Nunca subir `Backend/.env`, `Frontend/.env.local`, `credentials.json`, bases locales ni archivos dentro de `storage/`. Ya estan ignorados por `.gitignore`.

## Publicacion del backend en Vercel

El repositorio incluye `api/index.py`, `requirements.txt` y `vercel.json` para
publicar FastAPI como una funcion Python de Vercel.

1. Importar en Vercel el mismo repositorio de GitHub.
2. Dejar `Root Directory` en la raiz del repositorio.
3. No configurar `Build Command`, `Output Directory` ni `Install Command`.
4. Agregar estas variables en `Settings > Environment Variables`:

```text
DATABASE_URL
AUTH_SECRET
OPERADOR_ADMIN_NOMBRE
OPERADOR_ADMIN_TELEFONO
OPERADOR_ADMIN_PASSWORD
FRONTEND_ORIGINS
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET=comprobantes
USE_SUPABASE_STORAGE=true
RUN_DB_BOOTSTRAP=false
RUN_DB_MAINTENANCE=false
OFERTAS_AUTO_SYNC_ENABLED=false
GOOGLE_CREDENTIALS_JSON
GOOGLE_SHEET_ID
```

`SUPABASE_URL` debe ser la URL directa del proyecto, por ejemplo
`https://proyecto.supabase.co`, sin envolverla en `os.getenv(...)`.
`SUPABASE_SERVICE_ROLE_KEY` debe ser la clave secreta real del proyecto
(`service_role` legacy o `sb_secret_...`), no una clave inventada con prefijo
`sb_service_role_`. La clave es privada y solo debe configurarse en el backend.

`GOOGLE_CREDENTIALS_JSON` debe contener el contenido completo del archivo JSON
de la cuenta de servicio de Google, pegado como una sola variable de entorno.
Como alternativa, puede usarse `GOOGLE_CREDENTIALS_BASE64` con ese mismo
contenido codificado en Base64. Después de agregar o cambiar el secreto hay que
volver a desplegar el proyecto en Vercel. El archivo `credentials.json` no debe
subirse al repositorio.

`FRONTEND_ORIGINS` debe contener la URL exacta de GitHub Pages, por ejemplo:

```text
https://ronalzambrano34.github.io
```

Usar para `DATABASE_URL` la URL del pooler de Supabase apta para conexiones
serverless. La base debe tener sus tablas creadas previamente; el despliegue no
ejecuta semillas ni cambios de esquema en cada cold start. Luego de desplegar,
comprobar:

```text
https://TU-PROYECTO.vercel.app/health
https://TU-PROYECTO.vercel.app/docs
```

Finalmente, configurar en GitHub
`Settings > Secrets and variables > Actions > Variables`:

```text
VITE_API_URL=https://TU-PROYECTO.vercel.app
```

y volver a ejecutar el workflow de GitHub Pages.

Vercel no ofrece disco persistente para las funciones. Los endpoints que suben
fotos, comprobantes o promociones a `storage/` requieren migrar esos archivos a
Supabase Storage, Vercel Blob u otro almacenamiento externo antes de usarlos en
produccion.
