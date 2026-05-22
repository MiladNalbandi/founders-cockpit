export type User = {
  id: number;
  email: string;
  full_name: string;
  has_anthropic_key: boolean;
  has_github_pat: boolean;
  default_approval_mode: ApprovalMode;
  per_role_approval: Record<string, ApprovalMode>;
};

export type Tokens = { access: string; refresh: string };

export type Project = {
  id: number;
  name: string;
  idea: string;
  target_platforms: string[];
  workspace_path: string;
  created_at: string;
  updated_at: string;
};

export type AgentStatus =
  | "idle"
  | "thinking"
  | "working"
  | "blocked"
  | "done"
  | "error";

export type AgentRole =
  | "ceo"
  | "product"
  | "designer"
  | "engineer"
  | "frontend_eng"
  | "backend_eng"
  | "qa_eng"
  | "marketer"
  | "engagement"
  | "analyst"
  | "release"
  | "buddy";

export type TicketStatus =
  | "created"
  | "triaged"
  | "in_progress"
  | "in_review"
  | "done"
  | "rejected";

export type TicketPriority = "low" | "medium" | "high" | "urgent";

export type Ticket = {
  id: number;
  project: number;
  title: string;
  description: string;
  assignee_role: AgentRole | "";
  assignee_display: string;
  department: string;
  status: TicketStatus;
  priority: TicketPriority;
  parent_ticket: number | null;
  created_by_role: string;
  created_by_user: number | null;
  artifact_path: string;
  feedback: string;
  revision: number;
  agent_run: number | null;
  created_at: string;
  updated_at: string;
};

export type TicketEvent = {
  id: number;
  ticket: number;
  kind: "created" | "status_changed" | "assigned" | "comment" | "artifact";
  summary: string;
  payload: Record<string, unknown>;
  actor_role: string;
  actor_user: number | null;
  created_at: string;
};

export type FeedbackPayload = {
  title?: string;
  description: string;
  where?: string;
  severity?: TicketPriority;
};

export type Agent = {
  id: number;
  role: AgentRole;
  display_name: string;
  department: string;
  parent_role: AgentRole | null;
  status: AgentStatus;
  current_task: string;
  last_activity_at: string;
  full_implementation: boolean;
};

export type AgentEvent = {
  id: number;
  agent: number;
  role: AgentRole;
  kind: "status" | "thought" | "tool_call" | "tool_result" | "artifact" | "error";
  summary: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type Artifact = {
  id: number;
  kind: "spec" | "design" | "code" | "doc" | "other";
  path: string;
  size_bytes: number;
  content_preview: string;
  agent: number | null;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type ChatThread = {
  id: number;
  kind: "buddy" | "agent";
  agent: number | null;
  title: string;
  messages: ChatMessage[];
};

export type ApprovalMode =
  | "after_run"
  | "milestone"
  | "every_tool_call"
  | "per_role"
  | "skip";

export type PipelineRunStatus =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "done"
  | "failed"
  | "cancelled";

export type PipelineStepStatus =
  | "pending"
  | "ready"
  | "running"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "done"
  | "failed"
  | "skipped";

export type PipelineStep = {
  id: number;
  run: number;
  role: AgentRole;
  display_name: string;
  department: string;
  status: PipelineStepStatus;
  revision: number;
  feedback: string;
  artifact_path: string;
  depends_on: number[];
  previous_revision: number | null;
  agent_run: number | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type PipelineRun = {
  id: number;
  pipeline: number;
  approval_mode: ApprovalMode;
  description: string;
  status: PipelineRunStatus;
  started_at: string;
  finished_at: string | null;
  steps: PipelineStep[];
};

export type WSEvent =
  | { type: "hello"; project_id: number }
  | {
      type: "agent_status";
      agent_id: number;
      role: AgentRole;
      status: AgentStatus;
      current_task: string;
    }
  | {
      type: "agent_event";
      agent_id: number;
      role: AgentRole;
      kind: AgentEvent["kind"];
      summary: string;
      payload: Record<string, unknown>;
      created_at: string;
    }
  | { type: "chat_token"; thread_id: number; delta: string }
  | { type: "chat_complete"; thread_id: number; message_id: number }
  | {
      type: "pipeline_run";
      run_id: number;
      pipeline_id: number;
      status: PipelineRunStatus;
      approval_mode: ApprovalMode;
    }
  | {
      type: "pipeline_step";
      step_id: number;
      run_id: number;
      role: AgentRole;
      status: PipelineStepStatus;
      revision: number;
      artifact_path: string;
      feedback: string;
    }
  | {
      type: "ticket";
      ticket_id: number;
      title: string;
      assignee_role: AgentRole | "";
      status: TicketStatus;
      priority: TicketPriority;
      revision: number;
      artifact_path: string;
      parent_ticket_id: number | null;
    }
  | {
      type: "ticket_event";
      ticket_id: number;
      kind: TicketEvent["kind"];
      summary: string;
      payload: Record<string, unknown>;
      created_at: string;
    }
  | {
      type: "preview_version";
      version: number;
      author_role: AgentRole | "";
      summary: string;
      created_at: string;
    };

export type PreviewVersion = {
  id: number;
  version: number;
  summary: string;
  author_role: AgentRole | "";
  pipeline_run: number | null;
  created_at: string;
};
