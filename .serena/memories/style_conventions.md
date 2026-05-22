# Style Conventions

## Python (Backend)

- **Formatter**: not strictly enforced, but `ruff format` compatible
- **Imports**: stdlib → third-party → Django → local apps, separated by blank lines
- **`from __future__ import annotations`** at top of every module
- **Type hints** on all function signatures
- **Django views**: `@api_view(["GET"])` + `@permission_classes([IsAuthenticated])` decorators
- **Celery tasks**: `@shared_task(name="app.task_name")` with explicit `name=`
- **Model FK fields**: always `on_delete=models.CASCADE` or `on_delete=models.SET_NULL` with `null=True`
- **Status enums**: defined as `TextChoices` on the model class
- **Workspace paths**: always resolved via `Path(workspace).resolve()` and asserted `is_relative_to(workspace)` before any I/O

## TypeScript / React (Frontend)

- **File naming**: PascalCase for components (`BuddyPanel.tsx`), camelCase for utilities (`phase.ts`)
- **Component exports**: always `export default function ComponentName`
- **Hooks first**: all hooks declared at top of component before any logic
- **clsx**: used for all conditional className expressions
- **Tailwind**: utility-first; custom tokens are `ink-50…ink-900` (grays) and `accent` (violet)
- **zustand stores**: each store in `src/store/{name}.ts`, exported as `use{Name}Store`
- **TanStack Query**: `queryKey` arrays follow `["resource", id]` convention
- **No inline styles**: all styling via Tailwind classes
- **PrettyLabel component**: use `<PrettyLabel kind="step-status" value={s.status} />` for all status displays — never render raw enum strings to the user

## Tailwind Custom Tokens

```
ink-50  / ink-100 / ink-200 / ink-300 / ink-400 / ink-500 / ink-600 / ink-700 / ink-800 / ink-900
accent  (violet — primary action color)
```

## Common UI Patterns

- **Cards**: `className="card"` (defined in global CSS as `rounded-lg border border-ink-200 bg-white shadow-sm`)
- **Ghost buttons**: `className="btn-ghost"`
- **Primary buttons**: `className="btn"`
- **Drawers/overlays**: fixed positioning, `z-30`, with a backdrop `div` at `z-20 bg-black/20`
- **Status pulses on running agents**: amber ring animation
- **Toast tones**: `info` | `success` | `warning` | `review`

## API Conventions

- Paginated list responses return `{ count, next, previous, results }` (projects list)
- Non-paginated lists return plain arrays (pipeline runs, agents, artifacts, tickets)
- Approval actions: `POST /api/pipeline-steps/{id}/approve/` with `{ comment?: string }`
- Reject: `POST /api/pipeline-steps/{id}/reject/` with `{ feedback: string }`
- All authenticated endpoints require `Authorization: Bearer <access_token>` header
