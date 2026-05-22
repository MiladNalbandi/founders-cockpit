import clsx from "clsx";

import { useToastStore } from "@/store/toasts";

const TONE_BORDER: Record<string, string> = {
  info: "border-ink-300",
  success: "border-emerald-300",
  warning: "border-amber-300",
  review: "border-violet-300",
};

const TONE_BG: Record<string, string> = {
  info: "bg-white",
  success: "bg-emerald-50",
  warning: "bg-amber-50",
  review: "bg-violet-50",
};

const TONE_ICON: Record<string, string> = {
  info: "ℹ",
  success: "✓",
  warning: "⚠",
  review: "👀",
};

export default function ToastStack() {
  const list = useToastStore((s) => s.list);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {list.map((t) => (
        <div
          key={t.id}
          className={clsx(
            "pointer-events-auto w-[320px] rounded-md border px-3 py-2 shadow-lg",
            TONE_BORDER[t.tone || "info"],
            TONE_BG[t.tone || "info"]
          )}
        >
          <div className="flex items-start gap-2">
            <span className="text-base leading-none">{TONE_ICON[t.tone || "info"]}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{t.title}</div>
              {t.body && (
                <div className="mt-0.5 line-clamp-2 text-xs text-ink-600">{t.body}</div>
              )}
              {t.action && (
                <button
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                  className="mt-1 text-xs font-medium text-accent hover:underline"
                >
                  {t.action.label} →
                </button>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="text-ink-400 hover:text-ink-700"
              aria-label="dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
