import React, { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import ApiNode from './nodes/ApiNode';
import ServiceNode from './nodes/ServiceNode';
import FunctionNode from './nodes/FunctionNode';
import DbNode from './nodes/DbNode';
import DecisionNode from './nodes/DecisionNode';
import {
  Maximize2,
  Minimize2,
  Compass,
  ArrowDownUp,
  ArrowLeftRight,
  Sparkles,
  Info,
  CheckCircle2,
} from 'lucide-react';

export default function Canvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
  onPaneClick,
  layoutDirection,
  onChangeLayoutDirection,
  onAutoLayout,
  summary,
  stats,
  providerUsed,
  isLoading,
  reactFlowWrapperRef,
}) {
  const nodeTypes = useMemo(
    () => ({
      apiNode: ApiNode,
      serviceNode: ServiceNode,
      functionNode: FunctionNode,
      dbNode: DbNode,
      decisionNode: DecisionNode,
    }),
    []
  );

  const nodeColor = useCallback((node) => {
    switch (node.type) {
      case 'apiNode':
        return '#06b6d4';
      case 'serviceNode':
        return '#8b5cf6';
      case 'dbNode':
        return '#f59e0b';
      case 'decisionNode':
        return '#f43f5e';
      case 'functionNode':
      default:
        return '#6366f1';
    }
  }, []);

  return (
    <div ref={reactFlowWrapperRef} className="relative w-full h-full bg-canvas select-none">
      {/* Top Floating Stats & Controls Overlay */}
      <div className="absolute top-3 left-3 right-3 z-10 pointer-events-none flex flex-wrap items-center justify-between gap-2">
        {/* Left: Diagram Summary & Metrics */}
        <div className="pointer-events-auto flex items-center gap-2 bg-panel/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-border-subtle shadow-lg">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-300">
              {stats?.components || nodes.length}
            </span>
            <span className="text-slate-500 text-[11px]">components</span>
            <span className="text-slate-600">•</span>
            <span className="font-semibold text-slate-300">
              {stats?.connections || edges.length}
            </span>
            <span className="text-slate-500 text-[11px]">links</span>
            {stats?.complexity && (
              <>
                <span className="text-slate-600">•</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                    stats.complexity === 'High'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : stats.complexity === 'Medium'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {stats.complexity} Complexity
                </span>
              </>
            )}
            {providerUsed && (
              <span className="hidden sm:inline text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded-full">
                via {providerUsed}
              </span>
            )}
          </div>
        </div>

        {/* Right: Layout Switcher & Rearrange */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-panel/90 backdrop-blur-md p-1 rounded-xl border border-border-subtle shadow-lg">
          <button
            onClick={() => onChangeLayoutDirection(layoutDirection === 'TB' ? 'LR' : 'TB')}
            title={`Switch to ${layoutDirection === 'TB' ? 'Left-to-Right' : 'Top-to-Bottom'} layout`}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition"
          >
            {layoutDirection === 'TB' ? (
              <>
                <ArrowDownUp className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden md:inline text-[11px]">Vertical (TB)</span>
              </>
            ) : (
              <>
                <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden md:inline text-[11px]">Horizontal (LR)</span>
              </>
            )}
          </button>

          <button
            onClick={onAutoLayout}
            title="Auto-arrange diagram layout"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition"
          >
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline text-[11px]">Rearrange</span>
          </button>
        </div>
      </div>

      {/* Summary Banner below toolbar if present */}
      {summary && (
        <div className="absolute top-14 left-3 right-3 z-10 pointer-events-none flex justify-center">
          <div className="pointer-events-auto max-w-2xl bg-panel/85 backdrop-blur-md px-4 py-2 rounded-xl border border-border-subtle shadow-lg flex items-center gap-2 text-xs text-slate-300">
            <Info className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="line-clamp-2">{summary}</span>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-20 bg-canvas/75 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-auto text-center p-6">
          <div className="relative mb-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center animate-pulse">
              <Sparkles className="w-7 h-7 text-cyan-300" />
            </div>
            <div className="absolute -inset-1 rounded-2xl bg-indigo-500/20 blur-lg -z-10 animate-pulse" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">Synthesizing Architecture Graph</h3>
          <p className="text-xs text-slate-400 max-w-xs">
            Tracing control flow, parsing signatures, and building interactive nodes...
          </p>
        </div>
      )}

      {/* React Flow Viewport */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2.5}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#475569', strokeWidth: 2 },
        }}
      >
        <Background color="#1e293b" gap={20} size={1.2} variant={BackgroundVariant.Dots} />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap
          nodeColor={nodeColor}
          nodeStrokeWidth={3}
          zoomable
          pannable
          position="bottom-right"
          className="!m-3"
        />
      </ReactFlow>
    </div>
  );
}
