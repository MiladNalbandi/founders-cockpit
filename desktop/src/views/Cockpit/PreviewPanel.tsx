/**
 * Preview tab — V3.3
 *
 * Layout:
 *   QuickActionRow (4 fast-lane chips)
 *   PreviewVersionStrip (v1, v2, v3… + summary card + compare toggle)
 *   Iframe (or split iframes when comparing)
 *   ─ Designer's mockup toggle still available below as a secondary view
 *   Floating "Report bug" button bottom-right
 */
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";

import {
  getArtifactContent,
  getPreviewVersionContent,
  listArtifacts,
  listPreviewVersions,
  submitFeedback,
} from "@/api/endpoints";
import type { PreviewVersion } from "@/api/types";

import QuickActionRow from "./QuickActionRow";
import PreviewVersionStrip from "./PreviewVersionStrip";

export default function PreviewPanel({ projectId }: { projectId: number }) {
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [showMockup, setShowMockup] = useState(false);

  const { data: versions = [] } = useQuery({
    queryKey: ["preview-versions", projectId],
    queryFn: () => listPreviewVersions(projectId),
    enabled: !!projectId,
    refetchInterval: 4_000,
  });

  // Default selection: latest version once available.
  useEffect(() => {
    if (selectedVersion == null && versions.length) {
      setSelectedVersion(versions[0].version);
    } else if (
      selectedVersion != null &&
      !versions.find((v) => v.version === selectedVersion) &&
      versions.length
    ) {
      // Selected version was removed/replaced; fall back.
      setSelectedVersion(versions[0].version);
    }
  }, [versions, selectedVersion]);

  const latestVersionNumber = versions.length ? versions[0].version : null;

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-ink-500">Preview</div>
          <div className="text-sm text-ink-600">
            See and test the product. Quick changes go straight to the right agent.
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowMockup((v) => !v)}
            className={clsx(
              "rounded-md px-3 py-1.5 text-sm transition",
              showMockup
                ? "bg-ink-900 text-white"
                : "border border-ink-200 text-ink-600 hover:bg-ink-50"
            )}
          >
            {showMockup ? "← Back to preview" : "Show designer's mockup"}
          </button>
          <button
            className="btn bg-rose-600 hover:bg-rose-700"
            onClick={() => setReportOpen(true)}
          >
            Report bug
          </button>
        </div>
      </header>

      {!showMockup && <QuickActionRow projectId={projectId} />}

      {!showMockup && versions.length > 0 && (
        <PreviewVersionStrip
          versions={versions}
          selectedVersion={selectedVersion}
          onSelect={(v) => {
            setSelectedVersion(v);
            // If switching off latest, compare auto-targets prev.
          }}
          onToggleCompare={() => setCompareOpen((v) => !v)}
          compareOpen={compareOpen}
        />
      )}

      <div className="card relative flex-1 overflow-hidden bg-ink-50">
        {showMockup ? (
          <MockupIframe projectId={projectId} />
        ) : versions.length === 0 ? (
          <PreviewEmpty />
        ) : (
          <PreviewBody
            projectId={projectId}
            versions={versions}
            selectedVersion={selectedVersion ?? latestVersionNumber!}
            compareOpen={compareOpen}
          />
        )}
      </div>

      {reportOpen && (
        <ReportBugDialog
          projectId={projectId}
          where={
            showMockup
              ? "designer's mockup"
              : `preview v${selectedVersion ?? latestVersionNumber ?? "?"}`
          }
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}

function PreviewBody({
  projectId,
  versions,
  selectedVersion,
  compareOpen,
}: {
  projectId: number;
  versions: PreviewVersion[];
  selectedVersion: number;
  compareOpen: boolean;
}) {
  if (!compareOpen) {
    return (
      <SingleVersion projectId={projectId} version={selectedVersion} />
    );
  }
  // Pick the previous version relative to the selected one.
  const ordered = [...versions].sort((a, b) => a.version - b.version);
  const idx = ordered.findIndex((v) => v.version === selectedVersion);
  const prev = idx > 0 ? ordered[idx - 1] : null;
  if (!prev) {
    return <SingleVersion projectId={projectId} version={selectedVersion} />;
  }
  return (
    <div className="grid h-full grid-cols-2 gap-2 p-3">
      <div className="flex flex-col rounded-md border border-ink-200 bg-white">
        <header className="border-b border-ink-200 px-3 py-1.5 text-xs">
          <span className="font-medium">v{prev.version}</span>
          <span className="ml-2 text-ink-500">before</span>
        </header>
        <SingleVersion projectId={projectId} version={prev.version} flush />
      </div>
      <div className="flex flex-col rounded-md border border-accent bg-white">
        <header className="border-b border-accent/30 px-3 py-1.5 text-xs">
          <span className="font-medium text-accent">v{selectedVersion}</span>
          <span className="ml-2 text-ink-500">now</span>
        </header>
        <SingleVersion projectId={projectId} version={selectedVersion} flush />
      </div>
    </div>
  );
}

function SingleVersion({
  projectId,
  version,
  flush,
}: {
  projectId: number;
  version: number;
  flush?: boolean;
}) {
  const { data: content = "", isLoading } = useQuery({
    queryKey: ["preview-version-content", projectId, version],
    queryFn: () => getPreviewVersionContent(projectId, version),
    enabled: !!projectId && !!version,
  });
  if (isLoading) {
    return <div className="grid h-full place-items-center text-sm text-ink-500">Loading…</div>;
  }
  return (
    <div className={clsx("h-full w-full", !flush && "p-3")}>
      <div
        className={clsx(
          "h-full w-full overflow-hidden bg-white shadow",
          flush ? "" : "mx-auto max-w-5xl rounded-lg border border-ink-200"
        )}
      >
        <iframe
          key={`v${version}`}
          className="h-full w-full"
          srcDoc={content}
          sandbox="allow-scripts allow-forms"
          title={`preview v${version}`}
        />
      </div>
    </div>
  );
}

function MockupIframe({ projectId }: { projectId: number }) {
  const { data: artifacts = [] } = useQuery({
    queryKey: ["artifacts", projectId],
    queryFn: () => listArtifacts(projectId),
  });
  const mockup = artifacts.find((a) => a.path === "design/mockup.html");
  const { data: content = "", isLoading } = useQuery({
    queryKey: ["artifact-content", projectId, mockup?.id],
    queryFn: () => getArtifactContent(projectId, mockup!.id),
    enabled: !!mockup,
  });
  if (!mockup) {
    return (
      <div className="grid h-full place-items-center p-6 text-sm text-ink-500">
        No mockup yet. Run the Designer in the Pipeline tab.
      </div>
    );
  }
  if (isLoading) {
    return <div className="grid h-full place-items-center text-sm text-ink-500">Loading…</div>;
  }
  return (
    <div className="h-full w-full p-3">
      <div className="mx-auto h-full max-w-5xl overflow-hidden rounded-lg border border-ink-200 bg-white shadow">
        <iframe
          className="h-full w-full"
          srcDoc={content}
          sandbox="allow-scripts allow-forms"
          title="design/mockup.html"
        />
      </div>
    </div>
  );
}

function PreviewEmpty() {
  return (
    <div className="grid h-full place-items-center p-12">
      <div className="max-w-md text-center">
        <h3 className="text-base font-semibold">No preview yet</h3>
        <p className="mt-2 text-sm text-ink-500">
          The QA Engineer writes <code>preview/index.html</code> as part of the
          engineering team's pipeline. Run a pipeline through Engineering — the
          first preview becomes v1 and appears here.
        </p>
      </div>
    </div>
  );
}

function ReportBugDialog({
  projectId,
  where,
  onClose,
}: {
  projectId: number;
  where: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "urgent">("medium");

  const send = useMutation({
    mutationFn: () => submitFeedback(projectId, { title, description, where, severity }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets", projectId] });
      onClose();
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    send.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
      <form onSubmit={submit} className="w-[520px] rounded-lg bg-white p-6 shadow-xl">
        <div className="text-xs uppercase tracking-widest text-ink-500">
          Report on {where}
        </div>
        <h3 className="mt-1 text-lg font-semibold">
          Tell the Eng team what's wrong
        </h3>
        <p className="mt-1 text-sm text-ink-500">
          Your report becomes a ticket. The Engineering Lead triages it into work.
        </p>
        <div className="mt-4 space-y-3">
          <input
            className="input"
            placeholder="One-line summary (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="input min-h-[120px]"
            placeholder="What happened? What did you expect?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            {(["low", "medium", "high", "urgent"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeverity(s)}
                className={clsx(
                  "rounded-full border px-3 py-1 text-xs font-medium capitalize transition",
                  severity === s
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-ink-200 text-ink-600 hover:bg-ink-100"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={send.isPending || !description.trim()}>
            {send.isPending ? "Filing…" : "File ticket"}
          </button>
        </div>
      </form>
    </div>
  );
}
