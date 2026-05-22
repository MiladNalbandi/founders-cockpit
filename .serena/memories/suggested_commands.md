# Suggested Commands

## Start everything (dev)

```bash
# 1. Infrastructure (Postgres + Redis) — one time
cd /Users/mili/Projects/py/startup-builder
docker compose -f docker-compose.dev.yml up -d

# 2. Django / Daphne
cd backend
source .venv/bin/activate
daphne -b 127.0.0.1 -p 8010 cockpit.asgi:application

# 3. Celery workers (separate terminal)
cd backend && source .venv/bin/activate
celery -A cockpit worker -l info --concurrency=8

# 4. Vite + Electron (separate terminal)
cd desktop
npm run dev -- --host 127.0.0.1
```

## Quick status checks
```bash
lsof -i :8010 -sTCP:LISTEN   # Daphne running?
lsof -i :5183 -sTCP:LISTEN   # Vite running?
docker ps --format "table {{.Names}}\t{{.Status}}"  # Postgres + Redis up?
tail -f /tmp/daphne.log       # Daphne logs
tail -f /tmp/celery.log       # Celery logs
tail -f /tmp/vite.log         # Vite/Electron logs
```

## Database
```bash
cd backend && source .venv/bin/activate
python manage.py migrate           # Run migrations
python manage.py makemigrations    # Generate new migrations
python manage.py createsuperuser   # Create admin user
python manage.py shell             # Django shell
```

## Test account
- Email: founder@cockpit.dev
- Password: test12345

## API smoke tests
```bash
# Login
curl -s -X POST http://127.0.0.1:8010/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"founder@cockpit.dev","password":"test12345"}'

# List projects (paginated)
curl -s http://127.0.0.1:8010/api/projects/ -H "Authorization: Bearer <token>"

# Pipeline runs for project 1
curl -s http://127.0.0.1:8010/api/projects/1/pipeline-runs/ -H "Authorization: Bearer <token>"
```

## Frontend
```bash
cd desktop
npm run dev              # Start Vite + Electron
npx tsc --noEmit         # TypeScript check (no build output)
npm run build            # Production build
```

## Backend
```bash
cd backend && source .venv/bin/activate
python manage.py test    # Django tests
pytest                   # pytest (preferred)
ruff check .             # Lint
ruff format .            # Format
```

## Kill running processes
```bash
pkill -f "daphne"
pkill -f "celery"
pkill -f "vite"
pkill -f "electron"
```
