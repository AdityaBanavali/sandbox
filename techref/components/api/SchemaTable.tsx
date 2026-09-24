"use client";

import React, { useState } from "react";
import { SchemaNode } from "@/types/techref-spec";

export interface SchemaTableProps {
  schema: SchemaNode;
  name?: string;
  depth?: number;
}

export const SchemaTable: React.FC<SchemaTableProps> = ({ schema, depth = 0 }) => {
  const [expandedProps, setExpandedProps] = useState<Record<string, boolean>>({});

  const toggleExpand = (propKey: string) => {
    setExpandedProps((prev) => ({ ...prev, [propKey]: !prev[propKey] }));
  };

  if (!schema.properties && !schema.items) {
    return (
      <div className="text-xs font-mono text-slate-400 py-1">
        <span className="text-cyan-400 font-semibold">{schema.type}</span>
        {schema.description && <span className="ml-2 text-slate-300">— {schema.description}</span>}
      </div>
    );
  }

  const properties = schema.properties || {};

  return (
    <div className={`space-y-2 text-xs font-mono ${depth > 0 ? "ml-4 border-l border-cyan-500/20 pl-3 mt-2" : ""}`}>
      {Object.entries(properties).map(([propKey, propNode]) => {
        const isObjectOrArray = propNode.type === "object" || propNode.type === "array";
        const isRequired = schema.required?.includes(propKey);
        const isExpanded = Boolean(expandedProps[propKey]);

        return (
          <div key={propKey} className="border-b border-white/5 pb-2.5 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-100 font-mono">{propKey}</span>
              <span className="text-cyan-400 text-[11px] font-mono px-1.5 py-0.2 rounded bg-cyan-950/40 border border-cyan-500/30">
                {propNode.type}
              </span>
              {isRequired ? (
                <span className="text-rose-400 text-[10px] font-bold uppercase tracking-wider">required</span>
              ) : (
                <span className="text-slate-500 text-[10px]">optional</span>
              )}
              {propNode.format && (
                <span className="text-amber-400 text-[10px] font-mono">format: {propNode.format}</span>
              )}
              {propNode.example !== undefined && (
                <span className="text-slate-500 text-[10px] font-mono">
                  eg: {JSON.stringify(propNode.example)}
                </span>
              )}
              {isObjectOrArray && (
                <button
                  onClick={() => toggleExpand(propKey)}
                  className="ml-auto text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold px-2 py-0.5 rounded bg-white/5 border border-white/10"
                >
                  {isExpanded ? "Collapse ▲" : "Inspect Nested ▼"}
                </button>
              )}
            </div>

            {propNode.description && (
              <p className="text-slate-400 text-[11px] mt-1 leading-relaxed">{propNode.description}</p>
            )}

            {isObjectOrArray && isExpanded && (
              <div className="mt-2 bg-black/30 p-2.5 rounded-lg border border-white/5">
                <SchemaTable
                  schema={propNode.items ? propNode.items : propNode}
                  name={propKey}
                  depth={depth + 1}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
