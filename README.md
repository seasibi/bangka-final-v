# Bangka Monitoring System

A full-stack system for fisherfolk and boat registry, GPS tracking with WebSockets, notifications, and reporting.

## Contents
- Overview
- Prerequisites
- Quick Start
- Environment Variables
- WebSocket Setup (Frontend)
- API Overview (Backend)
- Development Commands
- Deployment Notes

---

## Overview
- Frontend: React + Vite + Tailwind
- Backend: Django + DRF + Channels (WebSockets) + MySQL
- Realtime: Redis + Daphne
- Scripts: START-ALL.bat starts Redis, backend, and frontend

## Prerequisites
- Node.js LTS and npm
- Python 3.11+
- MySQL (listening on 3307 per current settings) and a database `db_banka`
- Redis (or Memurai on Windows) for WebSockets and Celery (optional)

## Quick Start
1) Backend
```
python -m venv .venv
.venv\Scripts\activate
pip install -r backend/requirements.txt
copy backend/.env.example backend/.env (or set env vars)
python backend/manage.py migrate
python -m daphne -b 0.0.0.0 -p 8000 backend.asgi:application
```

2) Frontend
```
cd frontend
npm install
npm run dev
```

3) One-click (Windows)
- Double-click `START-ALL.bat`

## Environment Variables
Create `backend/.env` and set (examples):
```
DJANGO_SECRET_KEY=replace-me
DJANGO_DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=mysql://root:password@localhost:3307/db_banka
EMAIL_HOST_USER=...
EMAIL_HOST_PASSWORD=...
REDIS_URL=redis://127.0.0.1:6379/0
TIME_ZONE=Asia/Manila
VONAGE_API_KEY=...
VONAGE_API_SECRET=...
VONAGE_SMS_FROM=BANGKA
```
Notes:
- This project reads explicit DB settings from settings.py; you can switch to DATABASE_URL via dj-database-url if preferred.
- If `REDIS_URL` is unset, Channels falls back to in-memory layer (single-process only).

Frontend `.env` (frontend/.env):
```
VITE_API_URL=http://localhost:8000/api/
VITE_BACKEND_URL=http://localhost:8000
# Optional WebSocket override (defaults to current host:8000)
VITE_WS_HOST=localhost
VITE_WS_PORT=8000
```

## WebSocket Setup (Frontend)
- The hook `src/hooks/useWebSocketNotifications.js` builds the URL as:
  - `ws(s)://{VITE_WS_HOST or window.location.hostname}:{VITE_WS_PORT or 8000}/ws/gps/`
- In dev with Django/Daphne at 8000:
  - `VITE_WS_HOST=localhost`
  - `VITE_WS_PORT=8000`
- If the frontend is served over HTTPS, the hook will automatically use `wss:`.
- Backend ASGI routing is defined in `backend/backend/asgi.py` and `backend/api/routing.py`.

## API Overview (Backend)
Base: `/api/`
- Auth: `login/`, `refresh/`, `logout/`, `protected/`, `change-password/`, `set-new-password/`, `password-reset/`, `password-reset-confirm/<uidb64>/<token>/`
- Core resources (DRF routers):
  - `boats/`, `fisherfolk/`, `fisherfolkboat/`, `activitylog/`, `addresses/`, `households/`, `organizations/`, `contacts/`
  - `boat-measurements/`, `boat-gear-assignment/`, `boat-gear-type-assignment/`, `boat-gear-subtype-assignment/`
  - `gear-types/`, `gear-subtypes/`, `birukbilug/`, `device-tokens/`, `boundaries/`, `land-boundaries/`, `boundary-notifications/`
- GPS Data: `gps/`, `gps/geojson/`
- Device ingest (token header): `ingest/v1/positions` and `ingest/v1/positions/`
- Backup: `backup/create/`, `backup/restore/`, `backup/history/`

## Development Commands
Backend:
```
python backend/manage.py runserver
python -m daphne -b 0.0.0.0 -p 8000 backend.asgi:application
python backend/manage.py check --deploy
```
Frontend:
```
cd frontend
npm run dev
npm run build
npm run preview
npm run lint
```

## Deployment Notes
- Set `DEBUG=False`, configure `ALLOWED_HOSTS`, set secure cookies and CSRF.
- Set `TIME_ZONE=Asia/Manila` (already updated).
- Provide `REDIS_URL` for production WebSockets and background tasks.
- Serve Django with Daphne/Uvicorn behind a reverse proxy (Nginx/Caddy).
- Run `collectstatic` after configuring `STATIC_ROOT` if serving static files from Django.
