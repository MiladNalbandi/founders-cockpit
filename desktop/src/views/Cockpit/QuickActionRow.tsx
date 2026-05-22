import { useState } from "react";
import clsx from "clsx";

import QuickActionModal, { QuickAction } from "./QuickActionModal";

const ACTIONS: QuickAction[] = [
  {
    id: "ui",
    label: "Tweak the UI",
    icon: "✎",
    role: "frontend_eng",
    description: "Direct to the Frontend Engineer — fast lane.",
    placeholder:
      "What should the Frontend Engineer change? e.g. 'Make the hero text bigger and italic.'",
    priority: "high",
  },
  {
    id: "design",
    label: "Change the design",
    icon: "🎨",
    role: "designer",
    description: "Direct to the UI/UX Designer.",
    placeholder:
      "What should the designer rework? e.g. 'Less blue, more orange. Use rounded cards.'",
    priority: "medium",
  },
  {
    id: "data",
    label: "Adjust data / API",
    icon: "⚙",
    role: "backend_eng",
    description: "Direct to the Backend Engineer.",
    placeholder:
      "What should the backend change? e.g. 'Add a /recipes/favorites endpoint.'",
    priority: "high",
  },
  {
    id: "feature",
    label: "New feature",
    icon: "✨",
    role: "product",
    description: "Direct to the Product Strategist for a new spec.",
    placeholder:
      "Describe the new feature in a few sentences. The Product Strategist will write the spec.",
    priority: "medium",
  },
];

export default function QuickActionRow({ projectId }: { projectId: number }) {
  const [active, setActive] = useState<QuickAction | null>(null);
  return (
    <div className="card flex flex-col gap-2 p-3">
      <div className="text-xs font-medium uppercase tracking-wider text-ink-500">
        Quick changes — fast lane to one agent, no pipeline
      </div>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.id}
            onClick={() => setActive(a)}
            className={clsx(
              "flex items-center gap-2 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-sm transition",
              "hover:border-accent hover:bg-accent/5"
            )}
          >
            <span className="text-base leading-none">{a.icon}</span>
            <span className="font-medium">{a.label}</span>
          </button>
        ))}
      </div>
      {active && (
        <QuickActionModal
          projectId={projectId}
          action={active}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}
