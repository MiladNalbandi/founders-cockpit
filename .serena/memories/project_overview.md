# Founder's Cockpit — Project Overview

**Founder's Cockpit** is a Claude Desktop-style Electron desktop app for solo founders. It gives the founder a *hierarchical org of AI agents* (CEO → VPs → ICs) that covers the full startup lifecycle: idea → PRD → design → build → marketing → release → monitor.

## The Core Idea
A solo founder shouldn't need to play every role. The cockpit assigns each role to a specialized Claude-powered agent, lets them run in parallel, and keeps the founder in command via human-in-the-loop approval gates after each step.

## What the Founder Sees
1. **Pipeline tab** — a live DAG of the agent pipeline (Product → Designer → Eng Lead → [Frontend ∥ Backend] → QA → [Marketing, Engagement, Analytics, Release]). History sidebar shows all previous runs.
2. **Preview tab** — versioned HTML preview of the product. Quick-action chips ("Tweak UI", "New feature") dispatch a single agent without running the full pipeline.
3. **Tickets tab** — per-team swimlane kanban. Agents pick up tickets; founder approves/rejects.
4. **Files tab** — all artifacts written to the workspace.
5. **Buddy (right rail)** — always-on chat advisor with full project context.
6. **Team drawer** — org chart + workflow board (collapsible).
7. **Activity drawer** — live event feed of every agent tool call.

## Approval System
After each agent finishes, the step transitions to `awaiting_approval`. The **Approval Drawer** opens with the artifact rendered (markdown / HTML iframe / code). The founder can **Approve**, **Edit & approve**, or **Reject with feedback**. Rejection re-runs the same agent at `revision + 1` with the feedback prepended.

## Version History
- **V1** — 9-agent org, CEO + Product + Designer + Engineer + Buddy fully implemented, 4 stubs.
- **V2** — Human-in-the-loop pipeline, approval drawer, pipeline DAG visualization, revision loops.
- **V3** — Engineering sub-agents (Frontend/Backend/QA), ticket system, Preview tab, approval mode settings.
- **V3.1** — Pipeline run history sidebar, 4-tab cockpit layout, TopStatusBar, PhaseTracker, WelcomeCard, CreateTaskModal, TicketFlow stepper, ProjectPicker dashboard.
- **V3.2** — True parallel execution (Celery concurrency=8), per-team swimlanes, per-agent dashboard.
- **V3.3** — Quick-action chips on Preview, preview version history with side-by-side compare, toast notifications, auto-refresh iframe.
