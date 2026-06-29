# Repository Guidelines
​"Sé extremadamente conciso y directo."
​"Evita explicaciones detalladas o introducciones; ve directo al grano o al código."
​"No repitas código existente, muestra solo las líneas modificadas."
"Manten el Contexto compactado"
# Repository Guidelines

## Model Behavior & Response Style
- **Rol principal:** Actúa exclusivamente como un motor de corrección de código y refactorización.
- **Explicaciones prohibidas:** No saludes, no des introducciones, no expliques el "por qué" de los errores ni justifiques los cambios a menos que se te solicite explícitamente.
- **Modo de respuesta:** Ve directo al grano. Si el usuario comparte código con errores, tu respuesta debe iniciar inmediatamente con el bloque de código corregido.
- **Eficiencia de tokens:** No repitas código que ya funciona o que no ha sido modificado. Utiliza comentarios como `// ... resto del código sin cambios ...` para mostrar únicamente las líneas corregidas.

## Project Structure & Module Organization

This repository contains an internal operations system for orders, payments, WhatsApp messages, reports, and administration.

- `Backend/`: FastAPI application. Main entry point is `Backend/main.py`.
- `Backend/models/`, `routes/`, `schemas/`, `services/`: SQLAlchemy models, API routes, Pydantic schemas, and business logic.
- `Backend/scripts/`: smoke checks such as `smoke_pedidos.py` and `smoke_admin.py`.
- `Frontend/`: React + TypeScript + Vite PWA.
- `Frontend/src/api/`, `components/`, `hooks/`, `pages/`, `utils/`, `styles/`: client API, shared UI, reusable hooks, page views, utilities, and CSS.
- `Frontend/src/assets/`: brand and payment assets.
- `docs/`: operational documentation, including low-connectivity testing.
- `Manual de Negocio.txt`: living business rules; update it when behavior changes.

## Build, Test, and Development Commands

Run backend commands from the repository root:

```bash
Backend/venv/bin/python -m uvicorn Backend.main.app --reload
Backend/venv/bin/python Backend/scripts/smoke_pedidos.py
Backend/venv/bin/python Backend/scripts/smoke_admin.py
python3 -m py_compile Backend/services/pedido_creator.py

## Project Structure & Module Organization

This repository contains an internal operations system for orders, payments, WhatsApp messages, reports, and administration.

- `Backend/`: FastAPI application. Main entry point is `Backend/main.py`.
- `Backend/models/`, `routes/`, `schemas/`, `services/`: SQLAlchemy models, API routes, Pydantic schemas, and business logic.
- `Backend/scripts/`: smoke checks such as `smoke_pedidos.py` and `smoke_admin.py`.
- `Frontend/`: React + TypeScript + Vite PWA.
- `Frontend/src/api/`, `components/`, `hooks/`, `pages/`, `utils/`, `styles/`: client API, shared UI, reusable hooks, page views, utilities, and CSS.
- `Frontend/src/assets/`: brand and payment assets.
- `docs/`: operational documentation, including low-connectivity testing.
- `Manual de Negocio.txt`: living business rules; update it when behavior changes.

## Build, Test, and Development Commands

Run backend commands from the repository root:

```bash
Backend/venv/bin/python -m uvicorn Backend.main:app --reload
Backend/venv/bin/python Backend/scripts/smoke_pedidos.py
Backend/venv/bin/python Backend/scripts/smoke_admin.py
python3 -m py_compile Backend/services/pedido_creator.py
```

Run frontend commands inside `Frontend/`:

```bash
npm install
npm run dev
npm run build
npm run preview
npm run check:css
```

`npm run build` runs CSS audit, TypeScript build, Vite build, and service worker generation.

## Coding Style & Naming Conventions

Use TypeScript functional React components with PascalCase file names for components/pages and camelCase for variables and functions. Keep shared helpers in `utils/` and API access in `api/client.ts` or `api/dedupedReads.ts`.

Backend code uses Python modules in snake_case. Keep route handlers thin and place business rules in `Backend/services/`. Prefer explicit schemas in `Backend/schemas/`.

CSS is organized by owner/page; follow existing class naming and run `npm run check:css` before submitting frontend layout changes.

## Testing Guidelines

There is no full unit-test suite yet. Use smoke scripts for backend flows and `npm run build` for frontend validation. For focused backend changes, add or run small targeted Python checks and compile edited modules with `py_compile`.

For connectivity/offline behavior, follow `docs/pruebas-conectividad.md`.

## Commit & Pull Request Guidelines

Recent history uses short messages, but new commits should be descriptive and imperative, for example `fix order notification lock handling` or `add payment currency admin CRUD`.

Pull requests should include: summary of behavior changed, commands run, linked issue/task, screenshots for UI changes, and notes for migrations, `.env` variables, storage, or production risks.

## Security & Configuration Tips

Never commit `Backend/.env`, `Frontend/.env.local`, `credentials.json`, database dumps, or files under `storage/`. Production uploads must use external storage such as Supabase Storage. Keep `AUTH_SECRET`, Supabase service keys, Google credentials, and `DATABASE_URL` only in deployment secrets.
