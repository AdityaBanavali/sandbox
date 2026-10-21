import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Layers } from 'lucide-react';

const ServiceNode = ({ data, selected }) => {
  return (
    <div
      className={`relative min-w-[240px] max-w-[300px] rounded-xl bg-card/90 backdrop-blur-md border transition-all duration-200 p-3 shadow-xl ${
        selected
          ? 'border-purple-400 ring-2 ring-purple-400/30 shadow-glow-indigo'
          : 'border-border-subtle hover:border-slate-500'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-purple-400" />
      <Handle type="target" position={Position.Left} id="left" className="!bg-purple-400" />

      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5 text-purple-400 text-xs font-semibold">
          <Layers className="w-3.5 h-3.5" />
          <span>SERVICE / MODULE</span>
        </div>
        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded border bg-purple-500/20 text-purple-300 border-purple-500/30">
          {data.badge || 'SERVICE'}
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

      {data.tags && data.tags.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-wrap gap-1">
          {data.tags.slice(0, 3).map((tag, i) => (
            <span key={i} className="text-[9px] font-mono bg-purple-950/60 text-purple-300 border border-purple-800/40 px-1.5 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-purple-400" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-purple-400" />
    </div>
  );
};

export default memo(ServiceNode);
