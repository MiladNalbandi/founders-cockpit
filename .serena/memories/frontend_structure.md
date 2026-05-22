# Frontend Structure

## Key Files

```
desktop/src/
├── App.tsx                        # Router: /login, /projects, /cockpit/:id, /cockpit/:id/agent/:role, /settings
├── api/
│   ├── client.ts                  # axios instance, JWT interceptor, base URL=127.0.0.1:8010
│   ├── endpoints.ts               # All REST calls (getProject, listAgents, startPipeline, approvePipelineStep, createTicket, listPreviewVersions, …)
│   ├── types.ts                   # TypeScript interfaces for all API shapes
│   └── ws.ts                      # ProjectSocket — reconnecting WebSocket wrapper
├── store/
│   ├── auth.ts                    # tokens, user, login/logout
│   ├── project.ts                 # current project
│   ├── agents.ts                  # hydrate, upsertStatus, appendEvent, setEvents
│   ├── chat.ts                    # appendDelta, commitDraftAsAssistant, setThread
│   ├── pipeline.ts                # currentRun, runs, runsLoaded, steps, setRun, setRuns, upsertStep, clear
│   ├── tickets.ts                 # byId, hydrate, upsert, clear
│   └── toasts.ts                  # push({tone, title, body, action}), dismiss, auto-dismiss 8s, max 3
├── views/
│   ├── Login.tsx
│   ├── ProjectPicker.tsx          # Project dashboard: cards with live pipeline status + ticket counts
│   ├── Settings.tsx               # Approval mode, per-role overrides, GitHub PAT, Anthropic API key
│   ├── AgentDashboard.tsx         # Per-agent page: active ticket, queue, completed, live events
│   └── Cockpit/
│       ├── index.tsx              # Shell: 4 tabs (Pipeline/Preview/Tickets/Files), Team drawer, Activity drawer, WS handler, TopStatusBar, PhaseTracker, WelcomeCard
│       ├── PipelineFlow.tsx       # Run history sidebar + live DAG (reactflow) + Cancel/Restart buttons + NewRunModal
│       ├── ApprovalDrawer.tsx     # Right-side drawer: artifact preview + edit + Approve/Edit & Approve/Reject buttons
│       ├── PreviewPanel.tsx       # QuickActionRow + PreviewVersionStrip + versioned iframe + compare mode + MockupIframe + ReportBugDialog
│       ├── QuickActionRow.tsx     # 4 chips: Tweak UI→frontend_eng, Change design→designer, Adjust data→backend_eng, New feature→product
│       ├── QuickActionModal.tsx   # Single-textarea modal for chip actions → createTicket endpoint
│       ├── PreviewVersionStrip.tsx # Version chips (v1, v2…) + summary card + compare toggle
│       ├── TeamSwimlanes.tsx      # Per-team kanban rows (one row per department) on Tickets tab
│       ├── TicketDrawer.tsx       # Ticket detail: TicketFlow stepper + approve/reject controls
│       ├── TicketFlow.tsx         # Read→Plan→Edit→Test→Done stepper based on agent events
│       ├── BuddyPanel.tsx         # Right rail chat (streaming tokens via WS)
│       ├── ActivityFeed.tsx       # Bottom drawer: live agent event stream
│       ├── TeamPanel.tsx          # Org chart (reactflow) shown in Team drawer
│       ├── ArtifactsPanel.tsx     # Files tab: artifact list + content viewer
│       ├── PhaseTracker.tsx       # Horizontal stepper: Idea→Planning→Designing→Building→Testing→Iterating
│       ├── TopStatusBar.tsx       # Persistent strip: "N steps waiting for review · M tickets in review"
│       ├── WelcomeCard.tsx        # First-time onboarding card (shown when runsLoaded && runs.length === 0)
│       ├── NewRunModal.tsx        # Start pipeline modal: optional description + conflict detection (409 handling)
│       ├── CreateTaskModal.tsx    # "+ New task" modal: title, description, assignee role, priority
│       ├── PrettyLabel.tsx        # Human-readable status labels (e.g. "awaiting_approval" → "Needs your review")
│       └── TicketsBoard.tsx       # Wraps TeamSwimlanes + "+ New task" button
└── components/
    ├── Toast.tsx                  # Fixed bottom-right toast stack (reads useToastStore)
    └── AgentBadge.tsx             # Avatar + status dot
```

## Stores — Key State Shapes

### pipeline.ts
```ts
{ currentRun: PipelineRun | null, runs: PipelineRun[], runsLoaded: boolean, steps: Record<number, PipelineStep>, selectedStepId: number | null }
```
- `runsLoaded` starts false, becomes true after first `setRuns()` call
- `showWelcome` in index.tsx = `!welcomeDismissed && runsLoaded && runs.length === 0`

### toasts.ts
```ts
{ list: Toast[], push(t), dismiss(id) }
// Toast: { id, tone: "info"|"success"|"warning"|"review", title, body?, action?: {label, onClick} }
```

## WS Handler (Cockpit/index.tsx)
The single `sock.on()` handler in Cockpit index routes all WS events:
- `agent_status` → `upsertStatus`
- `agent_event` → `appendEvent`, refetchArtifacts on kind=artifact
- `chat_token` → `appendDelta`
- `chat_complete` → `commitDraft`
- `pipeline_step` → `upsertPipelineStep`, opens ApprovalDrawer + toast on `awaiting_approval`
- `pipeline_run` → `getPipelineRun` → `setRun`
- `ticket` → `upsertTicket`, toast on `in_review`
- `preview_version` → toast + invalidate `preview-versions` query
