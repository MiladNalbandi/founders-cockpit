# Current State (as of V3.3)

## What's fully working

### Backend
- ✅ Django 5 + DRF + Channels + Celery + Daphne running
- ✅ JWT auth (register, login, refresh)
- ✅ Multi-tenant: users → projects → auto-bootstrapped 12 agents + workspace dirs
- ✅ Agent runtime via `claude-agent-sdk` (AGENT_BACKEND=claude_sdk uses Claude Max subscription)
- ✅ Pipeline orchestrator: DAG state machine, parallel dispatch, approval gates, revision loops
- ✅ 12 agent roles all have full system prompts in `registry.py`
- ✅ Eng Lead writes `engineering/plan.md` (not tickets.json); sub-engineers read it
- ✅ Celery concurrency=8 (supports full parallel: Frontend ∥ Backend + 4 post-QA agents)
- ✅ Ticket system: state machine, direct dispatch, per-ticket events
- ✅ PreviewVersion model: snapshots `preview/index.html` on write, AI summary via Celery task
- ✅ WS broadcasts: all event types implemented in `broadcast.py`
- ✅ Settings: `default_approval_mode`, `per_role_approval` JSONField on User model
- ✅ Cancel pipeline run endpoint
- ✅ Project dashboard endpoint (`GET /api/projects/dashboard/`)

### Frontend
- ✅ Electron + Vite + React app running on 127.0.0.1:5183
- ✅ 4-tab cockpit: Pipeline, Preview, Tickets, Files
- ✅ Pipeline tab: run history sidebar (with `runsLoaded` fix — sidebar shows after first fetch)
- ✅ Approval Drawer: artifact preview + inline edit + Approve/Edit & Approve/Reject
- ✅ Preview tab: QuickActionRow (4 chips) + PreviewVersionStrip + versioned iframe + compare mode
- ✅ Tickets tab: TeamSwimlanes (per-team kanban rows)
- ✅ TicketDrawer: TicketFlow stepper (Read→Plan→Edit→Test→Done)
- ✅ Toast stack: bottom-right, auto-dismiss 8s, max 3, tones: info/success/warning/review
- ✅ WelcomeCard: shown only after server confirms no runs exist (`runsLoaded && runs.length === 0`)
- ✅ TopStatusBar: live "N steps need review · M tickets in review"
- ✅ PhaseTracker: Idea→Planning→Designing→Building→Testing→Iterating
- ✅ ProjectPicker: project dashboard with live status cards
- ✅ AgentDashboard: per-agent page at `/cockpit/:id/agent/:role`
- ✅ Team drawer (collapsible): org chart + workflow board
- ✅ Activity drawer (collapsible): live event feed
- ✅ CreateTaskModal: "+ New task" → dispatched to chosen agent role
- ✅ NewRunModal: optional description + 409 conflict detection (cancel-running checkbox)
- ✅ PrettyLabel: human-readable labels for all status enums

## Known test account
- Email: `founder@cockpit.dev` / Password: `test12345`
- Project ID 1: "One-Pan Recipes" (workspace at `backend/workspaces/1/1/`)
- Project ID 2: "GymApp" (workspace at `backend/workspaces/1/2/`)

## Recent bug fixed (2026-05-15)
**Pipeline run history not showing**: The WelcomeCard was blocking PipelineFlow from mounting (and fetching runs) because `showWelcome` was true whenever `currentRun === null`. Fixed by adding `runsLoaded: boolean` to pipeline store — welcome card now only shows after server confirms `runs.length === 0`.

## Next potential work (V4 ideas)
- GitHub integration: push workspace to connected repo
- Image generation for designer mockups (FAL / Replicate)
- Stripe billing for SaaS
- Deeper stub-agent integrations (Mailchimp, PostHog, App Store Connect)
- Multi-founder / team access per project
- Voice input for Buddy
