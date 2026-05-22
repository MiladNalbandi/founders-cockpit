import { api } from "./client";
import type {
  Agent,
  AgentEvent,
  Artifact,
  ChatThread,
  FeedbackPayload,
  PipelineRun,
  Project,
  Ticket,
  TicketEvent,
  Tokens,
  User,
} from "./types";

export async function register(email: string, password: string, fullName: string) {
  const { data } = await api.post<{ user: User; tokens: Tokens }>("/api/auth/register/", {
    email,
    password,
    full_name: fullName,
  });
  return data;
}

export async function login(email: string, password: string) {
  const { data } = await api.post<{ user: User; tokens: Tokens }>("/api/auth/login/", {
    email,
    password,
  });
  return data;
}

export async function me() {
  const { data } = await api.get<User>("/api/auth/me/");
  return data;
}

export async function setSecrets(payload: { anthropic_api_key?: string; github_pat?: string }) {
  const { data } = await api.post<User>("/api/auth/secrets/", payload);
  return data;
}

export async function setPreferences(payload: {
  default_approval_mode?: string;
  per_role_approval?: Record<string, string>;
}) {
  const { data } = await api.post<User>("/api/auth/preferences/", payload);
  return data;
}

export async function listProjects(): Promise<Project[]> {
  const { data } = await api.get<{ results: Project[] } | Project[]>("/api/projects/");
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

export async function createProject(payload: { name: string; idea: string; target_platforms: string[] }) {
  const { data } = await api.post<Project>("/api/projects/", payload);
  return data;
}

export async function getProject(id: number) {
  const { data } = await api.get<Project>(`/api/projects/${id}/`);
  return data;
}

export async function listAgents(projectId: number) {
  const { data } = await api.get<Agent[]>(`/api/projects/${projectId}/agents/`);
  return data;
}

export async function runAgent(projectId: number, role: string, input?: string) {
  const { data } = await api.post(`/api/projects/${projectId}/agents/${role}/run/`, { input });
  return data;
}

export async function listEvents(projectId: number, limit = 200) {
  const { data } = await api.get<AgentEvent[]>(`/api/projects/${projectId}/events/`, {
    params: { limit },
  });
  return data;
}

export async function listArtifacts(projectId: number) {
  const { data } = await api.get<Artifact[]>(`/api/projects/${projectId}/artifacts/`);
  return data;
}

export async function getArtifactContent(projectId: number, artifactId: number) {
  const { data } = await api.get<string>(
    `/api/projects/${projectId}/artifacts/${artifactId}/content/`,
    { responseType: "text", transformResponse: (r) => r }
  );
  return data;
}

export function artifactRawUrl(projectId: number, artifactId: number) {
  return `${api.defaults.baseURL}/api/projects/${projectId}/artifacts/${artifactId}/raw/`;
}

export async function buddyThread(projectId: number) {
  const { data } = await api.get<ChatThread>(`/api/projects/${projectId}/buddy/`);
  return data;
}

export async function sendBuddyMessage(projectId: number, content: string) {
  const { data } = await api.post(`/api/projects/${projectId}/buddy/messages/`, { content });
  return data;
}

// ---------------- Pipelines ----------------

export async function startPipeline(
  projectId: number,
  payload: {
    template?: unknown;
    approval_mode?: string;
    description?: string;
    cancel_running?: boolean;
  } = {}
) {
  const { data } = await api.post<PipelineRun>(
    `/api/projects/${projectId}/pipelines/start/`,
    payload
  );
  return data;
}

export async function listPipelineRuns(projectId: number) {
  const { data } = await api.get<PipelineRun[]>(`/api/projects/${projectId}/pipeline-runs/`);
  return data;
}

export async function getPipelineRun(projectId: number, runId: number) {
  const { data } = await api.get<PipelineRun>(
    `/api/projects/${projectId}/pipeline-runs/${runId}/`
  );
  return data;
}

export async function approvePipelineStep(stepId: number) {
  const { data } = await api.post(`/api/pipeline-steps/${stepId}/approve/`);
  return data;
}

export async function rejectPipelineStep(stepId: number, feedback: string) {
  const { data } = await api.post(`/api/pipeline-steps/${stepId}/reject/`, { feedback });
  return data;
}

export async function editPipelineStep(stepId: number, content: string) {
  const { data } = await api.post(`/api/pipeline-steps/${stepId}/edit/`, { content });
  return data;
}

export async function retryPipelineStep(stepId: number) {
  const { data } = await api.post(`/api/pipeline-steps/${stepId}/retry/`);
  return data;
}

export async function cancelPipelineRun(runId: number) {
  const { data } = await api.post<PipelineRun>(
    `/api/pipeline-runs/${runId}/cancel/`
  );
  return data;
}

export type DashboardRow = {
  project: Project;
  latest_run: {
    id: number;
    status: string;
    started_at: string;
    awaiting_steps: number;
  } | null;
  tickets: { in_review: number; in_progress: number; done: number; total: number };
  last_activity_at: string;
};

export async function projectsDashboard() {
  const { data } = await api.get<DashboardRow[]>("/api/projects/dashboard/");
  return data;
}

// ---------------- Team + Agent dashboards (V3.2) ----------------

export type TeamSummary = {
  department: string;
  agents: Agent[];
  tickets_by_status: Record<string, number>;
  active_step_count: number;
};

export async function teamDashboard(projectId: number) {
  const { data } = await api.get<TeamSummary[]>(`/api/projects/${projectId}/teams/`);
  return data;
}

export type AgentDashboardData = {
  agent: Agent;
  active_ticket: Ticket | null;
  active_step: {
    id: number;
    run_id: number;
    status: string;
    artifact_path: string;
    started_at: string | null;
  } | null;
  queue: Ticket[];
  completed: Ticket[];
  recent_steps: {
    id: number;
    run_id: number;
    status: string;
    artifact_path: string;
    finished_at: string | null;
  }[];
  recent_events: AgentEvent[];
};

export async function agentDashboard(projectId: number, role: string) {
  const { data } = await api.get<AgentDashboardData>(
    `/api/projects/${projectId}/agents/${role}/dashboard/`
  );
  return data;
}

// ---------------- Preview versions (V3.3) ----------------

export async function listPreviewVersions(projectId: number) {
  const { data } = await api.get<import("./types").PreviewVersion[]>(
    `/api/projects/${projectId}/preview-versions/`
  );
  return data;
}

export async function getPreviewVersionContent(projectId: number, version: number) {
  const { data } = await api.get<string>(
    `/api/projects/${projectId}/preview-versions/${version}/content/`,
    { responseType: "text", transformResponse: (r) => r }
  );
  return data;
}

// ---------------- Tickets ----------------

export async function listTickets(projectId: number) {
  const { data } = await api.get<Ticket[]>(`/api/projects/${projectId}/tickets/`);
  return data;
}

export async function createTicket(projectId: number, payload: {
  title: string;
  description: string;
  assignee_role: string;
  priority?: string;
}) {
  const { data } = await api.post<Ticket>(
    `/api/projects/${projectId}/tickets/create/`,
    payload
  );
  return data;
}

export async function getTicket(ticketId: number) {
  const { data } = await api.get<Ticket>(`/api/tickets/${ticketId}/`);
  return data;
}

export async function listTicketEvents(ticketId: number) {
  const { data } = await api.get<TicketEvent[]>(`/api/tickets/${ticketId}/events/`);
  return data;
}

export async function approveTicket(ticketId: number) {
  const { data } = await api.post(`/api/tickets/${ticketId}/approve/`);
  return data;
}

export async function rejectTicket(ticketId: number, feedback: string) {
  const { data } = await api.post(`/api/tickets/${ticketId}/reject/`, { feedback });
  return data;
}

export async function submitFeedback(projectId: number, payload: FeedbackPayload) {
  const { data } = await api.post<Ticket>(
    `/api/projects/${projectId}/feedback/`,
    payload
  );
  return data;
}
