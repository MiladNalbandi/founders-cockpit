import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { getArtifactContent } from "@/api/endpoints";
import type { Artifact } from "@/api/types";

const KIND_BADGE: Record<Artifact["kind"], string> = {
  spec: "bg-indigo-100 text-indigo-700",
  design: "bg-rose-100 text-rose-700",
  code: "bg-emerald-100 text-emerald-700",
  doc: "bg-amber-100 text-amber-700",
  other: "bg-ink-100 text-ink-600",
};

export default function ArtifactsPanel({
  projectId,
  artifacts,
}: {
  projectId: number;
  artifacts: Artifact[];
}) {
  const [selected, setSelected] = useState<Artifact | null>(null);
  useEffect(() => {
    if (!selected && artifacts.length) setSelected(artifacts[0]);
  }, [artifacts, selected]);

  return (
    <div className="grid h-full grid-cols-[260px_1fr] gap-4">
      <aside className="card flex flex-col">
        <header className="border-b border-ink-200 p-4">
          <h3 className="text-sm font-semibold">Artifacts</h3>
          <p className="text-xs text-ink-500">Everything the agents wrote.</p>
        </header>
        <ul className="flex-1 overflow-auto p-2">
          {artifacts.length === 0 && (
            <li className="px-2 py-3 text-sm text-ink-500">
              Nothing yet. Run the Product Strategist to start.
            </li>
          )}
          {artifacts.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => setSelected(a)}
                className={
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition " +
                  (selected?.id === a.id
                    ? "bg-ink-900 text-white"
                    : "text-ink-700 hover:bg-ink-50")
                }
              >
                <span
                  className={
                    "rounded-full px-1.5 text-[10px] uppercase tracking-wider " +
                    (selected?.id === a.id
                      ? "bg-white/20 text-white"
                      : KIND_BADGE[a.kind])
                  }
                >
                  {a.kind}
                </span>
                <span className="truncate">{a.path}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="card flex flex-col">
        {selected ? (
          <ArtifactDetail projectId={projectId} artifact={selected} />
        ) : (
          <div className="grid h-full place-items-center text-sm text-ink-500">
            Pick an artifact to preview.
          </div>
        )}
      </section>
    </div>
  );
}

function ArtifactDetail({ projectId, artifact }: { projectId: number; artifact: Artifact }) {
  const isHtml = artifact.path.toLowerCase().endsWith(".html");

  const { data: content = "", isLoading } = useQuery({
    queryKey: ["artifact-content", projectId, artifact.id],
    queryFn: () => getArtifactContent(projectId, artifact.id),
  });

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-ink-200 px-4 py-3">
        <span
          className={
            "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider " +
            KIND_BADGE[artifact.kind]
          }
        >
          {artifact.kind}
        </span>
        <div className="min-w-0 flex-1 truncate font-mono text-sm">{artifact.path}</div>
        <span className="text-xs text-ink-500">{artifact.size_bytes} B</span>
      </header>
      <div className="flex-1 overflow-auto bg-ink-50">
        {isLoading ? (
          <div className="p-6 text-sm text-ink-500">Loading…</div>
        ) : isHtml ? (
          <iframe
            title={artifact.path}
            className="h-full w-full bg-white"
            srcDoc={content}
            sandbox="allow-scripts"
          />
        ) : (
          <pre className="whitespace-pre-wrap p-4 text-xs font-mono leading-relaxed text-ink-800">
            {content}
          </pre>
        )}
      </div>
    </div>
  );
}
