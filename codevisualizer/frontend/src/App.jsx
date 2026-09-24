import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNodesState, useEdgesState } from '@xyflow/react';
import Header from './components/Header';
import CodeEditor from './components/CodeEditor';
import Canvas from './components/Canvas';
import NodeInspector from './components/NodeInspector';
import SettingsModal from './components/SettingsModal';
import { DEFAULT_SAMPLES } from './constants/sampleCodes';
import { getLayoutedElements } from './utils/layout';
import { exportCanvasAsPng, exportCanvasAsSvg, generateShareableLink, getSharedDataFromUrl } from './utils/export';
import { fetchVisualizedGraph, fetchSamples, checkBackendHealth } from './utils/api';
import { AlertCircle, X } from 'lucide-react';

export default function App() {
  const [samples, setSamples] = useState(DEFAULT_SAMPLES);
  const [selectedSampleId, setSelectedSampleId] = useState(DEFAULT_SAMPLES[0].id);
  const [code, setCode] = useState(DEFAULT_SAMPLES[0].code);
  const [language, setLanguage] = useState(DEFAULT_SAMPLES[0].language);
  const [mode, setMode] = useState('architecture');

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [layoutDirection, setLayoutDirection] = useState('TB');
  const [selectedNode, setSelectedNode] = useState(null);
  const [summary, setSummary] = useState('');
  const [stats, setStats] = useState(null);
  const [providerUsed, setProviderUsed] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState(false);

  // Load API config from localStorage
  const [config, setConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('codevisualizer_config');
      return saved ? JSON.parse(saved) : { provider: 'gemini', apiKey: '' };
    } catch {
      return { provider: 'gemini', apiKey: '' };
    }
  });

  const reactFlowWrapperRef = useRef(null);

  // Handle URL share parameter on initial mount
  useEffect(() => {
    const sharedData = getSharedDataFromUrl();
    if (sharedData) {
      if (sharedData.code) setCode(sharedData.code);
      if (sharedData.language) setLanguage(sharedData.language);
      if (sharedData.mode) setMode(sharedData.mode);
      setSelectedSampleId(null);
    }
  }, []);

  // Check backend health and fetch live samples
  useEffect(() => {
    let mounted = true;
    async function init() {
      const healthy = await checkBackendHealth();
      if (mounted) setIsBackendConnected(healthy);
      if (healthy) {
        try {
          const apiSamples = await fetchSamples();
          if (mounted && apiSamples && apiSamples.length > 0) {
            setSamples(apiSamples);
          }
        } catch (e) {
          console.warn('Using local default samples:', e);
        }
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, []);

  // Save config to localStorage
  const handleSaveConfig = (newConfig) => {
    setConfig(newConfig);
    try {
      localStorage.setItem('codevisualizer_config', JSON.stringify(newConfig));
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }
  };

  // Perform visualization
  const handleVisualize = useCallback(async () => {
    if (!code || !code.trim()) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await fetchVisualizedGraph({
        code,
        language,
        mode,
        apiKey: config.apiKey,
        provider: config.provider,
      });

      if (!result.nodes || result.nodes.length === 0) {
        throw new Error('No architectural nodes were detected in this code.');
      }

      // Automatically layout nodes using dagre
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        result.nodes,
        result.edges || [],
        layoutDirection
      );

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      setSummary(result.summary || '');
      setStats(result.stats || null);
      setProviderUsed(result.provider_used || 'parser');
    } catch (err) {
      console.error('Visualization error:', err);
      setErrorMessage(err.message || 'Failed to analyze code architecture');
    } finally {
      setIsLoading(false);
    }
  }, [code, language, mode, config, layoutDirection, setNodes, setEdges]);

  // Run initial visualization on load
  useEffect(() => {
    handleVisualize();
  }, []); // Run once on load

  // Re-layout nodes when direction changes
  const handleChangeLayoutDirection = useCallback(
    (newDirection) => {
      setLayoutDirection(newDirection);
      if (nodes.length > 0) {
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
          nodes,
          edges,
          newDirection
        );
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
      }
    },
    [nodes, edges, setNodes, setEdges]
  );

  // Auto layout rearrange
  const handleAutoLayout = useCallback(() => {
    if (nodes.length > 0) {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodes,
        edges,
        layoutDirection
      );
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    }
  }, [nodes, edges, layoutDirection, setNodes, setEdges]);

  // Select sample preset
  const handleSelectSample = (sample) => {
    setSelectedSampleId(sample.id);
    setCode(sample.code);
    setLanguage(sample.language);
    setSelectedNode(null);
  };

  // Reset current code to sample
  const handleResetCode = () => {
    const s = samples.find((x) => x.id === selectedSampleId) || samples[0];
    setCode(s.code);
    setLanguage(s.language);
  };

  // Node selection for inspector
  const handleNodeClick = (_, node) => {
    setSelectedNode(node);
  };

  const handlePaneClick = () => {
    setSelectedNode(null);
  };

  // Export actions
  const handleExportPng = async () => {
    if (!reactFlowWrapperRef.current) return;
    try {
      await exportCanvasAsPng(
        reactFlowWrapperRef.current,
        `${selectedSampleId || 'code'}-architecture.png`
      );
    } catch (e) {
      setErrorMessage('Failed to export canvas as PNG');
    }
  };

  const handleExportSvg = async () => {
    if (!reactFlowWrapperRef.current) return;
    try {
      await exportCanvasAsSvg(
        reactFlowWrapperRef.current,
        `${selectedSampleId || 'code'}-architecture.svg`
      );
    } catch (e) {
      setErrorMessage('Failed to export canvas as SVG');
    }
  };

  // Copy shareable link
  const handleShareLink = () => {
    const url = generateShareableLink(code, language, mode);
    navigator.clipboard.writeText(url);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-canvas text-slate-100">
      {/* Top Application Header */}
      <Header
        samples={samples}
        selectedSampleId={selectedSampleId}
        onSelectSample={handleSelectSample}
        onExportPng={handleExportPng}
        onExportSvg={handleExportSvg}
        onShareLink={handleShareLink}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isBackendConnected={isBackendConnected}
      />

      {/* Error Toast Notification */}
      {errorMessage && (
        <div className="fixed top-16 right-4 z-50 max-w-md bg-rose-950/90 border border-rose-600/50 text-rose-200 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md flex items-start gap-3 animate-in slide-in-from-top duration-200">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <span className="font-bold block mb-0.5">Visualization Notice</span>
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="p-1 rounded-lg text-rose-400 hover:text-white hover:bg-rose-900/50 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Split-Pane Workspace */}
      <div className="flex-1 flex flex-col md:flex-row h-[calc(100vh-3.5rem)] overflow-hidden relative">
        {/* Left Pane: Code Editor */}
        <div className="w-full md:w-[45%] lg:w-[40%] xl:w-[35%] h-1/2 md:h-full shrink-0 flex flex-col">
          <CodeEditor
            code={code}
            setCode={setCode}
            language={language}
            setLanguage={setLanguage}
            mode={mode}
            setMode={setMode}
            onVisualize={handleVisualize}
            isLoading={isLoading}
            onResetCode={handleResetCode}
          />
        </div>

        {/* Right Pane: Interactive Canvas */}
        <div className="flex-1 h-1/2 md:h-full relative overflow-hidden flex">
          <Canvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            layoutDirection={layoutDirection}
            onChangeLayoutDirection={handleChangeLayoutDirection}
            onAutoLayout={handleAutoLayout}
            summary={summary}
            stats={stats}
            providerUsed={providerUsed}
            isLoading={isLoading}
            reactFlowWrapperRef={reactFlowWrapperRef}
          />

          {/* Slide-over Node Inspector */}
          {selectedNode && (
            <NodeInspector
              node={selectedNode}
              edges={edges}
              nodes={nodes}
              onClose={() => setSelectedNode(null)}
              onSelectNode={(n) => setSelectedNode(n)}
            />
          )}
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSaveConfig={handleSaveConfig}
      />
    </div>
  );
}
