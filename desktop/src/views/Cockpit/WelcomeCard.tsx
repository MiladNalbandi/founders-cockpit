import { useMutation } from "@tanstack/react-query";

import { startPipeline } from "@/api/endpoints";
import { usePipelineStore } from "@/store/pipeline";

export default function WelcomeCard({
  projectId,
  onDismiss,
}: {
  projectId: number;
  onDismiss: () => void;
}) {
  const setRun = usePipelineStore((s) => s.setRun);
  const start = useMutation({
    mutationFn: () => startPipeline(projectId, {}),
    onSuccess: (run) => {
      setRun(run);
      onDismiss();
    },
  });

  return (
    <div className="card p-8">
      <div className="text-xs uppercase tracking-widest text-accent">
        First time here?
      </div>
      <h2 className="mt-1 text-2xl font-semibold">Welcome to the cockpit</h2>
      <p className="mt-2 text-sm text-ink-600">
        You are the founder. The team of AI agents below works for you. Here's how it goes:
      </p>
      <ol className="mt-4 space-y-2 text-sm">
        <Step n={1}>
          Click <strong>Run Idea → MVP</strong> below to kick off the pipeline.
        </Step>
        <Step n={2}>
          The <strong>Product Strategist</strong> writes a PRD. You review it.
        </Step>
        <Step n={3}>
          The <strong>Designer</strong> makes a mockup. You review it.
        </Step>
        <Step n={4}>
          The <strong>Engineering team</strong> turns it into a working preview.
        </Step>
        <Step n={5}>
          You test it in the <strong>Preview</strong> tab. Click "Report bug" to send
          a ticket back to the team. They iterate.
        </Step>
      </ol>
      <p className="mt-4 text-xs text-ink-500">
        Throughout, the <strong>Buddy</strong> in the right rail can answer anything.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          className="btn"
          disabled={start.isPending}
          onClick={() => start.mutate()}
        >
          {start.isPending ? "Starting…" : "Run Idea → MVP pipeline"}
        </button>
        <button className="btn-ghost" onClick={onDismiss}>
          Maybe later
        </button>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-ink-900 text-[10px] font-medium text-white">
        {n}
      </span>
      <span className="text-ink-700">{children}</span>
    </li>
  );
}
