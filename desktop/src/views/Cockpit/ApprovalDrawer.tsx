import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  approvePipelineStep,
  editPipelineStep,
  getArtifactContent,
  listArtifacts,
  rejectPipelineStep,
} from "@/api/endpoints";
import type { Artifact, PipelineStep } from "@/api/types";
import { STEP_TONE, usePipelineStore } from "@/store/pipeline";

export default function ApprovalDrawer({ projectId }: { projectId: number }) {
  const selectedStepId = usePipelineStore((s) => s.selectedStepId);
  const selectStep = usePipelineStore((s) => s.selectStep);
  const steps = usePipelineStore((s) => s.steps);
  const step = selectedStepId !== null ? steps[selectedStepId] : null;

  if (!step) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-[560px] flex-col border-l border-ink-200 bg-white shadow-xl">
      <header className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-ink-500">
            Pipeline step · revision {step.revision}
          </div>
          <h2 className="text-base font-semibold">{step.display_name}</h2>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs ${STEP_TONE[step.status]}`}>
          {step.status.replace("_", " ")}
        </span>
        <button onClick={() => selectStep(null)} className="btn-ghost ml-2">
          ✕
        </button>
      </header>

      {step.status === "awaiting_approval" ? (
        <ApprovalBody projectId={projectId} step={step} />
      ) : (
        <ReadOnlyBody projectId={projectId} step={step} />
      )}
    </div>
  );
}

function ReadOnlyBody({ projectId, step }: { projectId: number; step: PipelineStep }) {
  return (
    <div className="flex-1 overflow-auto p-4">
      <p className="text-sm text-ink-500">
        {step.status === "running"
          ? "The agent is still working. The Approval Drawer will activate when it finishes."
          : step.status === "rejected"
            ? "You rejected this version. A new revision is running."
            : `This step is ${step.status.replace("_", " ")}. Nothing to approve.`}
      </p>
      {step.feedback && (
        <div className="mt-3 rounded-md bg-rose-50 p-3 text-sm">
          <div className="text-xs font-medium uppercase tracking-wider text-rose-600">
            Your feedback
          </div>
          <div className="mt-1 whitespace-pre-wrap text-rose-900">{step.feedback}</div>
        </div>
      )}
      <ArtifactPreview projectId={projectId} artifactPath={step.artifact_path} />
    </div>
  );
}

function ApprovalBody({ projectId, step }: { projectId: number; step: PipelineStep }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"view" | "edit" | "reject">("view");
  const [editText, setEditText] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const selectStep = usePipelineStore((s) => s.selectStep);

  const { data: content = "", isLoading: loadingContent } = useArtifactContent(
    projectId,
    step.artifact_path
  );

  useEffect(() => {
    if (content && !editText) setEditText(content);
  }, [content, editText]);

  const onAfter = () => {
    qc.invalidateQueries({ queryKey: ["pipeline-runs", projectId] });
    qc.invalidateQueries({ queryKey: ["artifacts", projectId] });
    selectStep(null);
  };

  const approve = useMutation({
    mutationFn: () => approvePipelineStep(step.id),
    onSuccess: onAfter,
  });
  const reject = useMutation({
    mutationFn: () => rejectPipelineStep(step.id, feedback),
    onSuccess: onAfter,
  });
  const edit = useMutation({
    mutationFn: () => editPipelineStep(step.id, editText),
    onSuccess: onAfter,
  });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        {step.artifact_path ? (
          <>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-xs text-ink-500">{step.artifact_path}</span>
              <div className="flex gap-1 text-xs">
                <button
                  className={tabBtnClass(mode === "view")}
                  onClick={() => setMode("view")}
                >
                  Preview
                </button>
                <button
                  className={tabBtnClass(mode === "edit")}
                  onClick={() => setMode("edit")}
                >
                  Edit
                </button>
                <button
                  className={tabBtnClass(mode === "reject")}
                  onClick={() => setMode("reject")}
                >
                  Reject
                </button>
              </div>
            </div>

            {loadingContent ? (
              <div className="text-sm text-ink-500">Loading artifact…</div>
            ) : mode === "view" ? (
              <ArtifactBody path={step.artifact_path} content={content} />
            ) : mode === "edit" ? (
              <textarea
                className="input min-h-[400px] font-mono text-xs"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
              />
            ) : (
              <textarea
                className="input min-h-[160px]"
                placeholder="Tell the agent what to fix. The next revision will get this verbatim."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            )}
          </>
        ) : (
          <p className="text-sm text-ink-500">
            This step finished without an artifact path. You can still approve to continue.
          </p>
        )}
      </div>

      <footer className="flex gap-2 border-t border-ink-200 p-4">
        {mode === "view" && (
          <>
            <button
              className="btn flex-1"
              disabled={approve.isPending}
              onClick={() => approve.mutate()}
            >
              {approve.isPending ? "Approving…" : "Approve & continue"}
            </button>
            <button
              className="btn-ghost border border-ink-200"
              onClick={() => setMode("edit")}
            >
              Edit…
            </button>
            <button
              className="btn-ghost border border-rose-200 text-rose-700"
              onClick={() => setMode("reject")}
            >
              Reject…
            </button>
          </>
        )}
        {mode === "edit" && (
          <>
            <button
              className="btn flex-1"
              disabled={edit.isPending || !editText.trim()}
              onClick={() => edit.mutate()}
            >
              {edit.isPending ? "Saving…" : "Save edits & approve"}
            </button>
            <button className="btn-ghost" onClick={() => setMode("view")}>
              Cancel
            </button>
          </>
        )}
        {mode === "reject" && (
          <>
            <button
              className="btn flex-1 bg-rose-600 hover:bg-rose-700"
              disabled={reject.isPending || !feedback.trim()}
              onClick={() => reject.mutate()}
            >
              {reject.isPending ? "Rejecting…" : "Reject & request revision"}
            </button>
            <button className="btn-ghost" onClick={() => setMode("view")}>
              Cancel
            </button>
          </>
        )}
      </footer>
    </div>
  );
}

function tabBtnClass(active: boolean) {
  return (
    "rounded-md px-2 py-1 transition " +
    (active ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100")
  );
}

function ArtifactBody({ path, content }: { path: string; content: string }) {
  const isHtml = path.toLowerCase().endsWith(".html");
  if (isHtml) {
    return (
      <iframe
        className="h-[480px] w-full rounded-md border border-ink-200 bg-white"
        srcDoc={content}
        sandbox="allow-scripts"
        title={path}
      />
    );
  }
  return (
    <pre className="whitespace-pre-wrap rounded-md bg-ink-50 p-3 font-mono text-xs leading-relaxed">
      {content}
    </pre>
  );
}

function ArtifactPreview({ projectId, artifactPath }: { projectId: number; artifactPath: string }) {
  const { data: content = "" } = useArtifactContent(projectId, artifactPath);
  if (!artifactPath) return null;
  return (
    <div className="mt-4">
      <div className="font-mono text-xs text-ink-500">{artifactPath}</div>
      <pre className="mt-1 max-h-[300px] overflow-auto rounded-md bg-ink-50 p-3 font-mono text-xs leading-relaxed">
        {content.slice(0, 3000)}
        {content.length > 3000 && "…"}
      </pre>
    </div>
  );
}

function useArtifactContent(projectId: number, artifactPath: string) {
  // We need to map path → artifact id first, since the content endpoint takes id.
  const { data: artifacts = [] } = useQuery({
    queryKey: ["artifacts", projectId],
    queryFn: () => listArtifacts(projectId),
    enabled: !!projectId,
  });
  const artifact = useMemo<Artifact | undefined>(
    () => artifacts.find((a) => a.path === artifactPath),
    [artifacts, artifactPath]
  );
  return useQuery({
    queryKey: ["artifact-content", projectId, artifact?.id],
    queryFn: () => getArtifactContent(projectId, artifact!.id),
    enabled: !!artifact?.id,
  });
}
