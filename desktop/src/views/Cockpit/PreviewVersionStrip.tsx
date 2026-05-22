import clsx from "clsx";

import type { PreviewVersion } from "@/api/types";

export default function PreviewVersionStrip({
  versions,
  selectedVersion,
  onSelect,
  onToggleCompare,
  compareOpen,
}: {
  versions: PreviewVersion[];
  selectedVersion: number | null;
  onSelect: (version: number) => void;
  onToggleCompare: () => void;
  compareOpen: boolean;
}) {
  if (versions.length === 0) {
    return null;
  }
  const selected = versions.find((v) => v.version === selectedVersion) || versions[0];
  const canCompare = versions.length >= 2;

  return (
    <div className="card flex flex-col gap-2 p-3">
      <div className="flex items-center gap-2 overflow-x-auto">
        <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-ink-500">
          Versions:
        </span>
        {versions.map((v) => (
          <button
            key={v.version}
            onClick={() => onSelect(v.version)}
            className={clsx(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition",
              selectedVersion === v.version
                ? "border-accent bg-accent/10 text-accent"
                : "border-ink-200 text-ink-600 hover:bg-ink-50"
            )}
          >
            v{v.version}
            {v.version === Math.max(...versions.map((x) => x.version)) && (
              <span className="ml-1 text-[9px] uppercase opacity-70">latest</span>
            )}
          </button>
        ))}
        <button
          disabled={!canCompare}
          onClick={onToggleCompare}
          className={clsx(
            "ml-auto shrink-0 rounded-md border px-3 py-1 text-xs font-medium transition",
            compareOpen
              ? "border-ink-900 bg-ink-900 text-white"
              : "border-ink-200 text-ink-600 hover:bg-ink-50",
            !canCompare && "opacity-40"
          )}
        >
          {compareOpen ? "Single view" : "Compare with previous"}
        </button>
      </div>

      <div className="rounded-md bg-ink-50 p-3 text-sm">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold">v{selected.version}</span>
          <span className="text-xs text-ink-500">
            · {selected.author_role || "system"} ·{" "}
            {timeAgo(selected.created_at)}
          </span>
        </div>
        {selected.summary ? (
          <p className="mt-1 text-ink-700">{selected.summary}</p>
        ) : (
          <p className="mt-1 text-xs italic text-ink-400">
            Summary being generated…
          </p>
        )}
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
