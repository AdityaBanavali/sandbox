import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Globe, ArrowRight } from 'lucide-react';

const ApiNode = ({ data, selected }) => {
  const badge = (data.badge || 'API').toUpperCase();
  const methodColors = {
    GET: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    POST: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    PUT: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    DELETE: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    PATCH: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  };

  const badgeStyle = methodColors[badge] || 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';

  return (
    <div
      className={`relative min-w-[240px] max-w-[300px] rounded-xl bg-card/90 backdrop-blur-md border transition-all duration-200 p-3 shadow-xl ${
        selected
          ? 'border-cyan-400 ring-2 ring-cyan-400/30 shadow-glow-cyan'
          : 'border-border-subtle hover:border-slate-500'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-cyan-400" />
      <Handle type="target" position={Position.Left} id="left" className="!bg-cyan-400" />

      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5 text-cyan-400 text-xs font-semibold">
          <Globe className="w-3.5 h-3.5" />
          <span>API ENDPOINT</span>
        </div>
        <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${badgeStyle}`}>
          {badge}
        </span>
      </div>

      <div className="text-sm font-mono font-semibold text-slate-100 truncate mb-1">
        {data.label}
      </div>

      {data.description && (
        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
          {data.description}
        </p>
      )}

      {data.params && data.params.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-wrap gap-1">
          {data.params.slice(0, 3).map((p, i) => (
            <span key={i} className="text-[9px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
              {p}
            </span>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-cyan-400" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-cyan-400" />
    </div>
  );
};

export default memo(ApiNode);
