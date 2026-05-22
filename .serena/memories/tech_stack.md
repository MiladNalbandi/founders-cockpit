# Tech Stack

## Backend (backend/)
- **Python 3.11+** managed with `uv`
- **Django 5** + **Django REST Framework** (DRF)
- **Django Channels 4** + **Daphne** — WebSocket / ASGI server
- **Celery 5** + **Redis** — background agent tasks, concurrency=8
- **PostgreSQL** via `psycopg[binary]`
- **JWT auth** via `djangorestframework-simplejwt`
- **Fernet encryption** via `cryptography` — for stored API keys
- **Anthropic Python SDK** — `anthropic` package
- **claude-agent-sdk** — local Claude Max subscription backend (AGENT_BACKEND=claude_sdk)
- **python-dotenv** — env var loading

## Frontend (desktop/)
- **Electron** (main process: `desktop/electron/main.ts`)
- **Vite 5** + **React 18** + **TypeScript**
- **Tailwind CSS** — utility classes; custom color tokens (`ink-*`, `accent`)
- **zustand** — 6 stores: `auth`, `project`, `agents`, `chat`, `pipeline`, `tickets`, `toasts`
- **TanStack Query** — REST data fetching with caching
- **reactflow** — pipeline DAG visualization + org chart
- **clsx** — conditional class names
- **axios** — HTTP client with JWT interceptor

## Infrastructure
- **Docker Compose** (`docker-compose.dev.yml`): Postgres on port 5442, Redis on port 6389
- **Daphne**: 127.0.0.1:8010 (HTTP + WebSocket)
- **Vite dev server**: 127.0.0.1:5183
- **Celery**: concurrency=8 workers
- **Workspace dirs**: `backend/workspaces/{user_id}/{project_id}/` — per-project filesystem sandbox

## Environment
Key env vars in `backend/.env`:
- `AGENT_BACKEND` — `claude_sdk` (local Max) or `anthropic_api` (API key)
- `DATABASE_URL`, `REDIS_URL`
- `ANTHROPIC_API_KEY` (fallback when AGENT_BACKEND=anthropic_api)
- `FERNET_KEY` — encryption key for stored secrets
- `SECRET_KEY`, `DEBUG`
