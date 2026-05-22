# Architecture

## Backend App Structure

```
backend/
├── cockpit/               # Django project
│   ├── settings.py        # All config (Channels, Celery, JWT, CORS, AGENT_BACKEND)
│   ├── asgi.py            # Channels routing: HTTP + WebSocket
│   ├── celery.py          # Celery app
│   └── urls.py            # Root URL conf (includes all app urls)
├── apps/
│   ├── accounts/          # User model (email auth, encrypted API keys, approval prefs)
│   ├── projects/          # Project model (owner FK, workspace_path, target_platforms)
│   ├── agents/
│   │   ├── models.py      # Agent (role, status, current_task), AgentRun, AgentEvent
│   │   ├── registry.py    # 12 role system prompts + tool allowlists
│   │   ├── runtime_sdk.py # Agent loop via claude-agent-sdk (PRIMARY runtime)
│   │   ├── runtime.py     # Agent loop via direct Anthropic API (fallback)
│   │   ├── tools.py       # fs_write, fs_read, shell_exec, git_*, web_fetch tool definitions
│   │   ├── broadcast.py   # push(project_id, payload) → Redis channel layer → WS
│   │   ├── tasks.py       # run_agent_task, run_pipeline_step_task, run_ticket_task
│   │   └── views.py       # Agent list, agent run, agent dashboard, team dashboard
│   ├── pipelines/
│   │   ├── models.py      # Pipeline, PipelineRun, PipelineStep (DAG), Approval
│   │   ├── orchestrator.py # State machine: _advance(), complete_step(), reject_step(); DEFAULT_IDEA_TO_MVP template
│   │   ├── planner.py     # CEO-driven pipeline plan generation
│   │   ├── serializers.py
│   │   └── views.py       # start_pipeline, list/get runs, approve/reject/edit step, cancel run
│   ├── tickets/
│   │   ├── models.py      # Ticket (state machine: created→triaged→in_progress→in_review→done/rejected), TicketEvent
│   │   └── views.py       # list, create, get, approve, reject, feedback
│   ├── artifacts/
│   │   ├── models.py      # Artifact (project FK, agent FK, path, kind); PreviewVersion (version int, html_content, summary)
│   │   ├── tasks.py       # summarize_preview_version — one-shot Claude call comparing HTML versions
│   │   └── views.py       # list_artifacts, artifact_content, artifact_raw, list_preview_versions, preview_version_content
│   └── chat/
│       ├── models.py      # ChatThread, ChatMessage
│       └── consumers.py   # Django Channels WS consumer
```

## Agent Roles (12 total)

| Role | Status | Key output |
|------|--------|-----------|
| `product` | Full | `docs/PRD.md` |
| `designer` | Full | `design/mockup.html`, `design/notes.md` |
| `engineer` | Full (Eng Lead) | `engineering/plan.md` |
| `frontend_eng` | Full | `apps/web/**` |
| `backend_eng` | Full | `apps/api/**` |
| `qa_eng` | Full | `preview/index.html`, `qa/report.md` |
| `marketer` | Full | `marketing/launch_plan.md` |
| `engagement` | Full | `engagement/lifecycle_emails.md` |
| `analyst` | Full | `analytics/events_spec.md` |
| `release` | Full | `release/checklist.md` |
| `buddy` | Full | Streaming chat advisor |
| `ceo` | Orchestrator | Pipeline planning |

## Pipeline DAG (DEFAULT_IDEA_TO_MVP)

```
product → designer → engineer → [frontend_eng ∥ backend_eng] → qa_eng → [marketer, engagement, analyst, release]
```

`PipelineStep.depends_on` is ManyToMany. `_advance()` dispatches all steps whose deps are all `done`.

## WebSocket Events (type field)

| type | Payload fields |
|------|---------------|
| `agent_status` | agent_id, status, current_task |
| `agent_event` | agent_id, role, kind, summary, payload, created_at |
| `chat_token` | delta |
| `chat_complete` | message_id |
| `pipeline_step` | step_id, status, revision, artifact_path, feedback, role |
| `pipeline_run` | run_id, status |
| `ticket` | ticket_id, title, assignee_role, status, priority, revision, artifact_path, parent_ticket_id |
| `ticket_event` | ticket_id, event details |
| `preview_version` | version, author_role, summary, created_at |

## Approval Flow

1. Agent run completes → `complete_step(step_id)` called in orchestrator
2. Checks `_needs_approval(run, role)` based on `run.initiator.default_approval_mode` and `per_role_approval`
3. If approval needed → step status → `awaiting_approval`, WS broadcast
4. Founder sees Approval Drawer → approves/rejects
5. Approve → `_advance(run)` dispatches next steps
6. Reject → new step created at `revision+1` with feedback, same role dispatched again

## Preview Versioning

When `preview/index.html` is written by any agent:
1. `_snapshot_preview_version()` in `runtime_sdk.py` creates a `PreviewVersion` row
2. Deduplication: skips if HTML content == previous version
3. Triggers `artifacts.summarize_preview_version` Celery task (Claude one-shot diff summary)
4. Broadcasts `preview_version` WS event → frontend shows toast + updates version strip

## Workspace Layout (per project)

```
workspaces/{user_id}/{project_id}/
├── docs/PRD.md
├── design/
│   ├── mockup.html
│   └── notes.md
├── engineering/plan.md
├── apps/
│   ├── web/           (frontend_eng output)
│   └── api/           (backend_eng output)
├── preview/index.html (QA's assembled preview — triggers PreviewVersion)
├── qa/report.md
├── marketing/launch_plan.md
├── engagement/lifecycle_emails.md
├── analytics/events_spec.md
└── release/checklist.md
```
