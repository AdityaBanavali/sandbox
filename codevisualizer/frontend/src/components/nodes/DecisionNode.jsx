import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { GitBranch } from 'lucide-react';

const DecisionNode = ({ data, selected }) => {
  return (
    <div
      className={`relative min-w-[240px] max-w-[300px] rounded-xl bg-card/90 backdrop-blur-md border transition-all duration-200 p-3 shadow-xl ${
        selected
          ? 'border-rose-400 ring-2 ring-rose-400/30 shadow-glow-rose'
          : 'border-border-subtle hover:border-slate-500'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-rose-400" />
      <Handle type="target" position={Position.Left} id="left" className="!bg-rose-400" />

      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5 text-rose-400 text-xs font-semibold">
          <GitBranch className="w-3.5 h-3.5" />
          <span>DECISION / GATE</span>
        </div>
        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded border bg-rose-500/20 text-rose-300 border-rose-500/30">
          {data.badge || 'BRANCH'}
        </span>
      </div>

      <div className="text-sm font-semibold text-slate-100 truncate mb-1">
        {data.label}
      </div>

      {data.description && (
        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
          {data.description}
        </p>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-rose-400" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-rose-400" />
    </div>
  );
};

export default memo(DecisionNode);
