# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project overview
- Stack: React 19 (RC) + Vite 6 + React Router 7 + Tailwind CSS 4 + ESLint 9
- Maps and data viz: Leaflet (react-leaflet), ApexCharts (react-apexcharts)
- PDF/reporting: @react-pdf/renderer, jspdf, jspdf-autotable
- Geospatial utils: @turf/turf
- Auth/session: Cookie-based JWT with automatic refresh, idle timeout and forced logout

Common commands (pwsh)
- Install deps: npm install
- Start dev server (default http://localhost:5173): npm run dev
- Build production bundle: npm run build
- Preview production build: npm run preview
- Lint entire codebase: npm run lint
- Lint a single file (example): npx eslint src/components/Sidebar.jsx
Notes
- There are no test scripts configured. If adding tests later (e.g., Vitest/Jest/Cypress), document single-test invocation here.

Environments and backend integration
- Runtime API base URL in app code: VITE_API_URL (used by src/services/api_urls.js)
  - Fallback: http://localhost:8000/api/
  - Define in .env files as VITE_API_URL=http://<host>:8000/api/
- Dev proxy for /api in Vite (vite.config.js)
  - Env: VITE_BACKEND_URL (default http://localhost:8000)
  - Requests to /api are proxied to BACKEND_URL; cookies are preserved; multiple allowedHosts including *.ngrok-free.app
  - To use ngrok: set VITE_BACKEND_URL to your ngrok origin (e.g., https://<subdomain>.ngrok-free.app) and ensure it’s in allowedHosts if using a custom domain
- Dynamic vs static API URLs
  - The app’s services default to using VITE_API_URL (static). A dynamic helper exists (src/services/api_urls_dynamic.js) but is not wired by default. Switch only if you intentionally import the dynamic module instead of api_urls.js.

High-level architecture
- Entry and composition
  - src/main.jsx: mounts React, sets axios.defaults.withCredentials=true, wraps App with BrowserRouter, AuthProvider, and TokenProvider
  - src/App.jsx: renders top-level routes via AppRoutes
- Routing (src/routes)
  - AppRoutes.jsx: declares all routes with nested layouts per role:
    - /admin/* → AdminLayout
    - /provincial_agriculturist/* → ProvincialLayout
    - /municipal_agriculturist/* → MunicipalLayout
  - PrivateRoute.jsx: guards elements using useAuth(); while loading, shows Loader; redirects unauthenticated users to /
- Auth/session flow (src/contexts)
  - AuthContext.jsx
    - State: user, error, loading
    - Login posts to `${API_URLS}login/` and stores access token reference; schedules refresh based on JWT exp
    - Interceptors on axios and apiClient add withCredentials and auto-retry once on 401 (except for /login/ and during refresh); on persistent 401/403 triggers logout
    - Periodically validates session via `${API_URLS}protected/`
    - Logout calls `${API_URLS}logout/`, clears cookies, cancels refresh timer, resets state, and forces location.replace('/')
  - TokenContext.jsx
    - Inactivity handling: 5-minute timeout with a 30-second IdleModal warning; user activity resets timers; calls logout when exceeded
- Services (src/services)
  - api_urls.js exports API_URLS and a preconfigured axios instance (apiClient) bound to VITE_API_URL with credentials
  - Domain service files (e.g., boatService.js, fisherfolkService.js, trackerService.js) call endpoints under API_URLS
- UI structure
  - Layouts: src/layouts/* define role-specific shells (AdminLayout, ProvincialLayout, MunicipalLayout)
  - Pages grouped by role in src/pages/admin|provincial|municipal; shared components in src/components
  - Mapping: src/maps/* with GeoJSON data and MapView using react-leaflet
  - Reporting: src/components/reportGeneration/* for PDFs and reports
- Styling and assets
  - Tailwind CSS 4 configured via @tailwindcss/vite plugin; tailwind.config.js scans ./index.html and ./src/**/*.{js,jsx,ts,tsx}
  - Global styles in src/index.css; assets in src/assets
- Build/tooling
  - Vite alias @ → ./src (vite.config.js)
  - ESLint config (eslint.config.js) uses @eslint/js recommended rules, react-hooks, and react-refresh plugin; ignores dist; warns on non-component exports for HMR safety
  - Type hints: a small TypeScript file exists at src/types/models.ts; the project otherwise uses JS with JSX

Conventions and gotchas for agents
- Always send credentials: axios is globally set to withCredentials; rely on cookies, not manual Authorization headers, except for the immediate post-login protected check where the token is temporarily used
- Route protection: wrap protected routes in <PrivateRoute element={<YourPage/>}/>; redirect target for unauthenticated is '/'
- Idle timeout: when building long-running interactions, consider TokenContext’s 5-minute inactivity window; keep user activity events in mind for modals and wizards
- Environment selection
  - For local backend at port 8000: set VITE_API_URL=http://localhost:8000/api/ and ensure VITE_BACKEND_URL=http://localhost:8000 for dev proxy
  - For remote tunnels (ngrok): set VITE_BACKEND_URL to your tunnel origin; if deploying the frontend separately without proxy, set VITE_API_URL directly to the API origin and avoid relying on /api proxy

Quick references
- Dev server URL: http://localhost:5173 (default Vite)
- API endpoints referenced in code: /login/, /protected/, /refresh/, /logout/ under API_URLS
- Important files to inspect first time:
  - vite.config.js (proxy, alias, hosts)
  - src/contexts/AuthContext.jsx (auth/refresh logic)
  - src/routes/AppRoutes.jsx (routing/roles)
  - src/services/*.js (API surface)
  - tailwind.config.js (styling scan)

