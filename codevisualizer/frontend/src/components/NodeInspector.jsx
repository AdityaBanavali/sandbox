import React, { useState } from 'react';
import { X, Copy, Check, Code, ExternalLink, ArrowRight, ArrowLeft, Tag, Layers } from 'lucide-react';

export default function NodeInspector({ node, edges, nodes, onClose, onSelectNode }) {
  const [copied, setCopied] = useState(false);

  if (!node) return null;

  const { data } = node;

  const handleCopySnippet = () => {
    if (data.snippet) {
      navigator.clipboard.writeText(data.snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Find incoming and outgoing edges for this node
  const incomingEdges = edges.filter((e) => e.target === node.id);
  const outgoingEdges = edges.filter((e) => e.source === node.id);

  const findNode = (id) => nodes.find((n) => n.id === id);

  return (
    <div className="w-80 md:w-96 h-full bg-panel/95 backdrop-blur-xl border-l border-border-subtle flex flex-col shadow-2xl z-20 text-slate-200 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-panel-header/80">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
            <Layers className="w-4 h-4" />
          </span>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Component Inspector
            </span>
            <h3 className="text-sm font-bold text-white truncate max-w-[200px]">
              {data.label}
            </h3>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Badges & Meta */}
        <div className="flex items-center gap-2 flex-wrap">
          {data.badge && (
            <span className="px-2 py-0.5 text-xs font-mono font-bold rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {data.badge}
            </span>
          )}
          <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-slate-800 text-slate-300 capitalize">
            {data.category || 'Module'}
          </span>
          {data.returns && (
            <span className="px-2 py-0.5 text-xs font-mono rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
              returns: {data.returns}
            </span>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Purpose & Role
          </label>
          <p className="text-xs text-slate-300 leading-relaxed bg-card/60 p-3 rounded-xl border border-border-subtle">
            {data.description || 'No detailed description available for this component.'}
          </p>
        </div>

        {/* Parameters */}
        {data.params && data.params.length > 0 && (
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Parameters / Inputs
            </label>
            <div className="flex flex-wrap gap-1.5">
              {data.params.map((p, idx) => (
                <span
                  key={idx}
                  className="text-xs font-mono bg-card px-2.5 py-1 rounded-lg border border-border-subtle text-slate-300"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {data.tags && data.tags.length > 0 && (
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Tags
            </label>
            <div className="flex flex-wrap gap-1.5">
              {data.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="flex items-center gap-1 text-[11px] bg-slate-800/80 text-slate-400 px-2 py-0.5 rounded-full"
                >
                  <Tag className="w-3 h-3 text-slate-500" />
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Code Snippet */}
        {data.snippet && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <Code className="w-3.5 h-3.5 text-cyan-400" />
                <span>Code Extract</span>
              </label>
              <button
                onClick={handleCopySnippet}
                className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-card border border-border-subtle hover:border-slate-600 transition"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 rounded-xl bg-canvas border border-border-subtle font-mono text-xs text-cyan-300 overflow-x-auto leading-relaxed max-h-48 whitespace-pre">
              {data.snippet}
            </pre>
          </div>
        )}

        {/* Connections */}
        <div className="space-y-3 pt-2 border-t border-border-subtle">
          <div>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              <ArrowLeft className="w-3.5 h-3.5 text-indigo-400" />
              <span>Invoked By ({incomingEdges.length})</span>
            </span>
            {incomingEdges.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No incoming calls (Root / Entrypoint)</p>
            ) : (
              <div className="space-y-1.5">
                {incomingEdges.map((e) => {
                  const src = findNode(e.source);
                  return (
                    <button
                      key={e.id}
                      onClick={() => onSelectNode(src)}
                      className="w-full text-left p-2 rounded-lg bg-card/80 hover:bg-card-hover border border-border-subtle flex items-center justify-between text-xs transition"
                    >
                      <span className="font-mono text-slate-200 truncate">{src?.data?.label || e.source}</span>
                      <span className="text-[10px] text-slate-400 font-mono italic shrink-0 ml-2">
                        {e.label || 'calls'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
              <span>Outgoing Calls ({outgoingEdges.length})</span>
            </span>
            {outgoingEdges.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No outgoing dependencies (Terminal / Leaf)</p>
            ) : (
              <div className="space-y-1.5">
                {outgoingEdges.map((e) => {
                  const tgt = findNode(e.target);
                  return (
                    <button
                      key={e.id}
                      onClick={() => onSelectNode(tgt)}
                      className="w-full text-left p-2 rounded-lg bg-card/80 hover:bg-card-hover border border-border-subtle flex items-center justify-between text-xs transition"
                    >
                      <span className="font-mono text-slate-200 truncate">{tgt?.data?.label || e.target}</span>
                      <span className="text-[10px] text-slate-400 font-mono italic shrink-0 ml-2">
                        {e.label || 'flows to'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
