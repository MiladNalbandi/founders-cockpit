import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  buddyThread,
  getProject,
  listAgents,
  listArtifacts,
  listEvents,
} from "@/api/endpoints";
import { ProjectSocket } from "@/api/ws";
import type { WSEvent } from "@/api/types";

import { useAgentsStore } from "@/store/agents";
import { useAuthStore } from "@/store/auth";
import { useChatStore } from "@/store/chat";
import { useProjectStore } from "@/store/project";

import ActivityFeed from "./ActivityFeed";
import BuddyPanel from "./BuddyPanel";
import ArtifactsPanel from "./ArtifactsPanel";
import PipelineFlow from "./PipelineFlow";
import ApprovalDrawer from "./ApprovalDrawer";
import TicketsBoard from "./TicketsBoard";
import TeamSwimlanes from "./TeamSwimlanes";
import TicketDrawer from "./TicketDrawer";
import PreviewPanel from "./PreviewPanel";
import PhaseTracker from "./PhaseTracker";
import TopStatusBar from "./TopStatusBar";
import WelcomeCard from "./WelcomeCard";
import TeamPanel from "./TeamPanel";
import ToastStack from "@/components/Toast";

import { usePipelineStore } from "@/store/pipeline";
import { useTicketsStore } from "@/store/tickets";
import { useToastStore } from "@/store/toasts";
import { getPipelineRun, listTickets } from "@/api/endpoints";

type Tab = "pipeline" | "preview" | "tickets" | "files";

export default function CockpitView() {
  const { projectId: pidStr } = useParams();
  const projectId = Number(pidStr);
  const tokens = useAuthStore((s) => s.tokens);
  const setCurrent = useProjectStore((s) => s.setCurrent);

  const hydrateAgents = useAgentsStore((s) => s.hydrate);
  const upsertStatus = useAgentsStore((s) => s.upsertStatus);
  const appendEvent = useAgentsStore((s) => s.appendEvent);
  const setEvents = useAgentsStore((s) => s.setEvents);
  const resetAgents = useAgentsStore((s) => s.reset);

  const appendDelta = useChatStore((s) => s.appendDelta);
  const commitDraft = useChatStore((s) => s.commitDraftAsAssistant);
  const setThread = useChatStore((s) => s.setThread);
  const resetChat = useChatStore((s) => s.reset);

  const nav = useNavigate();
  const qc = useQueryClient();

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    enabled: !!projectId,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents", projectId],
    queryFn: () => listAgents(projectId),
    enabled: !!projectId,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events", projectId],
    queryFn: () => listEvents(projectId),
    enabled: !!projectId,
  });

  const { data: artifacts = [], refetch: refetchArtifacts } = useQuery({
    queryKey: ["artifacts", projectId],
    queryFn: () => listArtifacts(projectId),
    enabled: !!projectId,
  });

  const { data: buddy } = useQuery({
    queryKey: ["buddy", projectId],
    queryFn: () => buddyThread(projectId),
    enabled: !!projectId,
  });

  useEffect(() => {
    if (project) setCurrent(project);
  }, [project, setCurrent]);

  useEffect(() => {
    if (agents.length) hydrateAgents(agents);
  }, [agents, hydrateAgents]);

  useEffect(() => {
    if (events.length) setEvents(events);
  }, [events, setEvents]);

  useEffect(() => {
    if (buddy) setThread(buddy.id, buddy.messages);
  }, [buddy, setThread]);

  useEffect(() => {
    return () => {
      resetAgents();
      resetChat();
    };
  }, [resetAgents, resetChat]);

  const upsertPipelineStep = usePipelineStore((s) => s.upsertStep);
  const selectPipelineStep = usePipelineStore((s) => s.selectStep);
  const pipelineSteps = usePipelineStore((s) => s.steps);
  const clearPipeline = usePipelineStore((s) => s.clear);

  const upsertTicket = useTicketsStore((s) => s.upsert);
  const hydrateTickets = useTicketsStore((s) => s.hydrate);
  const ticketsById = useTicketsStore((s) => s.byId);
  const clearTickets = useTicketsStore((s) => s.clear);

  useQuery({
    queryKey: ["tickets-init", projectId],
    queryFn: async () => {
      const t = await listTickets(projectId);
      hydrateTickets(t);
      return t;
    },
    enabled: !!projectId,
  });

  useEffect(() => {
    if (!projectId || !tokens?.access) return;
    const sock = new ProjectSocket(projectId, tokens.access);
    const off = sock.on((ev: WSEvent) => {
      if (ev.type === "agent_status") {
        upsertStatus(ev.agent_id, ev.status, ev.current_task);
      } else if (ev.type === "agent_event") {
        appendEvent({
          id: Math.random(),
          agent: ev.agent_id,
          role: ev.role,
          kind: ev.kind,
          summary: ev.summary,
          payload: ev.payload || {},
          created_at: ev.created_at,
        });
        if (ev.kind === "artifact") refetchArtifacts();
      } else if (ev.type === "chat_token") {
        appendDelta(ev.delta);
      } else if (ev.type === "chat_complete") {
        commitDraft(ev.message_id);
      } else if (ev.type === "pipeline_step") {
        const wasAwaiting =
          pipelineSteps[ev.step_id]?.status === "awaiting_approval";
        upsertPipelineStep({
          id: ev.step_id,
          status: ev.status,
          revision: ev.revision,
          artifact_path: ev.artifact_path,
          feedback: ev.feedback,
        });
        if (ev.status === "awaiting_approval" && !wasAwaiting) {
          // Auto-open the Approval Drawer for the step that needs the founder.
          selectPipelineStep(ev.step_id);
          setTab("pipeline");
          refetchArtifacts();
          useToastStore.getState().push({
            tone: "review",
            title: "A step needs your review",
            body: `${ev.role.replace("_", " ")} just finished — click to review.`,
            action: { label: "Review", onClick: () => setTab("pipeline") },
          });
        } else if (ev.status === "failed") {
          const isTimeout = (ev.feedback || "").includes("timed out") || (ev.feedback || "").includes("TimeoutError");
          useToastStore.getState().push({
            tone: "warning",
            title: `${ev.role.replace(/_/g, " ")} ${isTimeout ? "timed out" : "failed"}`,
            body: isTimeout
              ? "The agent took too long. Click Retry on the step to try again."
              : ev.feedback || "Agent run failed.",
            action: { label: "Go to Pipeline", onClick: () => setTab("pipeline") },
          });
        }
      } else if (ev.type === "pipeline_run") {
        // Refresh the full run to pick up new revision steps.
        getPipelineRun(projectId, ev.run_id).then((run) =>
          usePipelineStore.getState().setRun(run)
        );
      } else if (ev.type === "ticket") {
        const prev = ticketsById[ev.ticket_id];
        upsertTicket({
          id: ev.ticket_id,
          title: ev.title,
          assignee_role: ev.assignee_role as any,
          status: ev.status,
          priority: ev.priority,
          revision: ev.revision,
          artifact_path: ev.artifact_path,
          parent_ticket: ev.parent_ticket_id,
        });
        if (
          ev.status === "in_review" &&
          (!prev || prev.status !== "in_review")
        ) {
          useToastStore.getState().push({
            tone: "review",
            title: "A ticket needs your review",
            body: ev.title,
            action: { label: "Open tickets", onClick: () => setTab("tickets") },
          });
        }
      } else if (ev.type === "ticket_event") {
        // The list-tickets refetch interval picks up the row; nothing to do here.
      } else if (ev.type === "preview_version") {
        useToastStore.getState().push({
          tone: "success",
          title: `✨ New preview shipped (v${ev.version})`,
          body:
            ev.summary ||
            `${(ev.author_role || "an agent").replace("_", " ")} just updated the preview.`,
          action: { label: "Open preview", onClick: () => setTab("preview") },
        });
        // Refetch versions immediately so the strip updates.
        qc.invalidateQueries({
          queryKey: ["preview-versions", projectId],
        });
      }
    });
    return () => {
      off();
      sock.close();
    };
  }, [
    projectId,
    tokens?.access,
    upsertStatus,
    appendEvent,
    appendDelta,
    commitDraft,
    refetchArtifacts,
    upsertPipelineStep,
    selectPipelineStep,
    upsertTicket,
    pipelineSteps,
    ticketsById,
    qc,
  ]);

  useEffect(
    () => () => {
      clearPipeline();
      clearTickets();
    },
    [clearPipeline, clearTickets]
  );

  const [tab, setTab] = useState<Tab>("pipeline");
  const [teamOpen, setTeamOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const awaitingCount = Object.values(pipelineSteps).filter(
    (s) => s.status === "awaiting_approval"
  ).length;
  const reviewTicketCount = Object.values(ticketsById).filter(
    (t) => t.status === "in_review"
  ).length;
  const currentRun = usePipelineStore((s) => s.currentRun);
  const runsLoaded = usePipelineStore((s) => s.runsLoaded);
  const runs = usePipelineStore((s) => s.runs);
  // Only show the welcome card once we've confirmed (from the server) that there are truly no runs.
  const showWelcome = !welcomeDismissed && runsLoaded && runs.length === 0 && tab === "pipeline";

  const tabs = useMemo(
    () =>
      [
        {
          id: "pipeline" as const,
          label: awaitingCount > 0 ? `Pipeline · ${awaitingCount} ●` : "Pipeline",
        },
        { id: "preview" as const, label: "Preview" },
        {
          id: "tickets" as const,
          label: reviewTicketCount > 0 ? `Tickets · ${reviewTicketCount} ●` : "Tickets",
        },
        { id: "files" as const, label: `Files (${artifacts.length})` },
      ],
    [artifacts.length, awaitingCount, reviewTicketCount]
  );

  return (
    <div className="grid h-screen grid-cols-[1fr_380px] grid-rows-[auto_1fr] bg-ink-50">
      <header className="col-span-2 flex items-center gap-4 border-b border-ink-200 bg-white px-6 py-3">
        <button onClick={() => nav("/projects")} className="btn-ghost">
          ←
        </button>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-widest text-ink-500">
            {project?.target_platforms.join(" · ") || "—"}
          </div>
          <div className="truncate text-base font-semibold">
            {project?.name || "Loading…"}
          </div>
        </div>
        <nav className="ml-6 flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-1.5 text-sm transition ${
                tab === t.id
                  ? "bg-ink-900 text-white"
                  : "text-ink-600 hover:bg-ink-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => setTeamOpen((v) => !v)}
            className={`rounded-md px-3 py-1.5 text-sm transition ${
              teamOpen ? "bg-ink-100 text-ink-900" : "text-ink-500 hover:bg-ink-100"
            }`}
            title="Show the agent team"
          >
            Team {teamOpen ? "▴" : "▾"}
          </button>
          <button
            onClick={() => setActivityOpen((v) => !v)}
            className={`rounded-md px-3 py-1.5 text-sm transition ${
              activityOpen ? "bg-ink-100 text-ink-900" : "text-ink-500 hover:bg-ink-100"
            }`}
            title="Show the live activity feed"
          >
            Activity {activityOpen ? "▴" : "▾"}
          </button>
          <Link to="/settings" className="text-sm text-ink-500 hover:text-ink-800">
            Settings
          </Link>
        </div>
      </header>

      <main className="flex flex-col gap-3 overflow-auto px-6 py-4">
        <TopStatusBar onJumpTo={(t) => setTab(t as Tab)} />
        <PhaseTracker projectId={projectId} />
        <div className="flex-1 min-h-0 relative">
          {/* Always mount PipelineFlow on the pipeline tab so it fetches run history.
              The WelcomeCard overlays it when server confirms no runs exist yet. */}
          {tab === "pipeline" && <PipelineFlow projectId={projectId} />}
          {showWelcome && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink-50/90 backdrop-blur-sm">
              <WelcomeCard
                projectId={projectId}
                onDismiss={() => setWelcomeDismissed(true)}
              />
            </div>
          )}
          {tab === "preview" && <PreviewPanel projectId={projectId} />}
          {tab === "tickets" && <TeamSwimlanes projectId={projectId} />}
          {tab === "files" && (
            <ArtifactsPanel projectId={projectId} artifacts={artifacts} />
          )}
        </div>
      </main>

      <aside className="border-l border-ink-200 bg-white">
        <BuddyPanel projectId={projectId} />
      </aside>

      {teamOpen && (
        <>
          <div
            className="fixed inset-0 z-20 bg-black/20"
            onClick={() => setTeamOpen(false)}
          />
          <div className="fixed bottom-0 left-0 top-[60px] z-30 w-[420px] overflow-auto border-r border-ink-200 bg-white shadow-2xl">
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-200 bg-white px-5 py-3">
              <div>
                <div className="text-xs uppercase tracking-widest text-ink-500">
                  Your agent team
                </div>
                <h3 className="text-base font-semibold">12 agents · click to run</h3>
              </div>
              <button onClick={() => setTeamOpen(false)} className="btn-ghost">
                ✕
              </button>
            </header>
            <div className="px-5 py-4">
              <TeamPanel projectId={projectId} />
            </div>
          </div>
        </>
      )}

      {activityOpen && (
        <div className="fixed bottom-0 left-0 right-[380px] z-30 h-[280px] overflow-hidden border-t border-ink-200 bg-white shadow-2xl">
          <header className="flex items-center justify-between border-b border-ink-200 px-4 py-2">
            <div>
              <div className="text-xs uppercase tracking-widest text-ink-500">
                Live activity feed
              </div>
              <h3 className="text-sm font-semibold">Every action every agent takes</h3>
            </div>
            <button onClick={() => setActivityOpen(false)} className="btn-ghost">
              Close ✕
            </button>
          </header>
          <div className="h-[230px] overflow-auto">
            <ActivityFeed />
          </div>
        </div>
      )}

      <ApprovalDrawer projectId={projectId} />
      <TicketDrawer projectId={projectId} />
      <ToastStack />
    </div>
  );
}
