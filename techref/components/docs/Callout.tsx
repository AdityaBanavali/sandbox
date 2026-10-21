import React from "react";

export type CalloutType = "note" | "warning" | "tip" | "danger";

export interface CalloutProps {
  type?: CalloutType;
  title?: string;
  children: React.ReactNode;
}

const STYLES: Record<CalloutType, { border: string; bg: string; text: string; icon: string }> = {
  note: {
    border: "border-cyan-500/40",
    bg: "bg-cyan-950/20",
    text: "text-cyan-400",
    icon: "ℹ",
  },
  warning: {
    border: "border-amber-500/40",
    bg: "bg-amber-950/20",
    text: "text-amber-400",
    icon: "⚠",
  },
  tip: {
    border: "border-emerald-500/40",
    bg: "bg-emerald-950/20",
    text: "text-emerald-400",
    icon: "✦",
  },
  danger: {
    border: "border-rose-500/40",
    bg: "bg-rose-950/20",
    text: "text-rose-400",
    icon: "✖",
  },
};

export const Callout: React.FC<CalloutProps> = ({ type = "note", title, children }) => {
  const current = STYLES[type];

  return (
    <div className={`my-4 p-4 rounded-xl border ${current.border} ${current.bg} text-xs font-mono shadow-lg`}>
      <div className={`flex items-center gap-2 font-bold mb-1.5 ${current.text}`}>
        <span className="text-sm">{current.icon}</span>
        <span className="uppercase tracking-wider">{title || type}</span>
      </div>
      <div className="text-slate-300 leading-relaxed space-y-1">{children}</div>
    </div>
  );
};
