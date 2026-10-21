import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Database } from 'lucide-react';

const DbNode = ({ data, selected }) => {
  return (
    <div
      className={`relative min-w-[240px] max-w-[300px] rounded-xl bg-card/90 backdrop-blur-md border transition-all duration-200 p-3 shadow-xl ${
        selected
          ? 'border-amber-400 ring-2 ring-amber-400/30 shadow-glow-amber'
          : 'border-border-subtle hover:border-slate-500'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-amber-400" />
      <Handle type="target" position={Position.Left} id="left" className="!bg-amber-400" />

      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold">
          <Database className="w-3.5 h-3.5" />
          <span>DATA / STORAGE</span>
        </div>
        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded border bg-amber-500/20 text-amber-300 border-amber-500/30">
          {data.badge || 'DATABASE'}
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
            <span key={i} className="text-[9px] font-mono bg-amber-950/50 text-amber-300 border border-amber-800/30 px-1.5 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-amber-400" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-amber-400" />
    </div>
  );
};

export default memo(DbNode);
