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

`Frontend/` contiene el primer scaffold de la app web interna con React, TypeScript y Vite.

Incluye:

- Login de operador con token Bearer.
- Bandeja de pedidos por estado.
- Detalle basico de pedido.
- Creacion inicial de transferencia.
- Cambio de estado.
- Upload de comprobante.
- Copiado del mensaje de WhatsApp.

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
