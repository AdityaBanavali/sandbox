import { useEffect, useState, useCallback } from 'react';
import { Header } from './components/Header';
import { TopThroughputStrip } from './components/TopThroughputStrip';
import { AlertFeed } from './components/AlertFeed';
import { MitreMatrixHeatmap } from './components/MitreMatrixHeatmap';
import { RiskPostureGauge } from './components/RiskPostureGauge';
import { AlertInspectionDrawer } from './components/AlertInspectionDrawer';
import type { ThreatAlert, AlertStatus } from './types/soc';
import { wsClient } from './services/websocket';
import { fetchRecentAlerts, updateAlertTriage } from './services/api';

export function App() {
  const [alerts, setAlerts] = useState<ThreatAlert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<ThreatAlert | null>(null);
  const [selectedTechniqueId, setSelectedTechniqueId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [mode, setMode] = useState<'LIVE_WEBSOCKET' | 'SIMULATED_FEED'>('LIVE_WEBSOCKET');
  const [threatPulseCount, setThreatPulseCount] = useState<number>(0);

  // Load initial alerts from REST API or fallback seed
  useEffect(() => {
    async function loadInitial() {
      const recent = await fetchRecentAlerts(15);
      if (recent && recent.length > 0) {
        const formatted: ThreatAlert[] = recent.map((r: any) => ({
          id: r.id,
          flow_id: r.flow_id,
          severity: r.severity,
          severity_score: r.severity_score,
          confidence: r.confidence,
          behavior_class: r.behavior_class,
          status: r.status,
          model_version: r.model_version,
          timestamp: r.timestamp,
          mitre_attack: r.mitre_mapping ? {
            technique_id: r.mitre_mapping.technique_id,
            technique_name: r.mitre_mapping.technique_name,
            tactic: r.mitre_mapping.tactic_name,
            subtechnique_id: r.mitre_mapping.subtechnique_id,
            description: r.mitre_mapping.description,
            url: r.mitre_mapping.url,
          } : undefined,
          flow: r.flow ? {
            src_ip: r.flow.src_ip,
            dst_ip: r.flow.dst_ip,
            src_port: r.flow.src_port,
            dst_port: r.flow.dst_port,
            protocol: r.flow.protocol,
            payload_entropy: r.flow.payload_entropy,
            packet_count: r.flow.packet_count,
            byte_count: r.flow.byte_count,
          } : undefined,
          isNew: false,
        }));
        setAlerts(formatted);
        if (formatted.length > 0) {
          setSelectedAlert(formatted[0]);
        }
      } else {
        // Seed 3 realistic threats so the dashboard is immediately vivid and populated
        const mock1 = wsClient.triggerManualThreatBurst();
        const mock2 = wsClient.triggerManualThreatBurst();
        const mock3 = wsClient.triggerManualThreatBurst();
        setAlerts([mock1, mock2, mock3]);
        setSelectedAlert(mock1);
      }
    }
    loadInitial();
  }, []);

  // Subscribe to real-time alerts via WebSocket
  useEffect(() => {
    const unsubAlerts = wsClient.subscribeAlerts((newAlert) => {
      setAlerts((prev) => [newAlert, ...prev.slice(0, 49)]); // Keep last 50 alerts
      setThreatPulseCount((c) => c + 1);

      // Flash new card, clear isNew after 2s
      setTimeout(() => {
        setAlerts((curr) =>
          curr.map((a) => (a.id === newAlert.id ? { ...a, isNew: false } : a))
        );
      }, 2000);

      // Auto-select latest threat if none selected or if critical
      setSelectedAlert((curr) => {
        if (!curr || newAlert.severity === 'CRITICAL') {
          return newAlert;
        }
        return curr;
      });
    });

    const unsubStatus = wsClient.subscribeStatus((connected, currentMode) => {
      setIsConnected(connected);
      setMode(currentMode);
    });

    return () => {
      unsubAlerts();
      unsubStatus();
    };
  }, []);

  // Trigger manual threat burst for user testing / presentation
  const handleTriggerThreat = useCallback(() => {
    const alert = wsClient.triggerManualThreatBurst();
    setSelectedAlert(alert);
  }, []);

  // Toggle demo simulation mode
  const handleToggleMode = useCallback(() => {
    wsClient.toggleSimulation();
  }, []);

  // Handle triage status update
  const handleUpdateStatus = useCallback(async (alertId: string, newStatus: AlertStatus) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, status: newStatus } : a))
    );
    if (selectedAlert?.id === alertId) {
      setSelectedAlert((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
    await updateAlertTriage(alertId, newStatus);
  }, [selectedAlert]);

  // Filter alerts by MITRE technique when cell is clicked in heatmap
  const handleSelectTechnique = useCallback((techniqueId: string | null) => {
    setSelectedTechniqueId(techniqueId);
    if (techniqueId) {
      const matchingAlert = alerts.find(
        (a) => a.mitre_attack?.technique_id === techniqueId
      );
      if (matchingAlert) {
        setSelectedAlert(matchingAlert);
      }
    }
  }, [alerts]);

  const displayedAlerts = selectedTechniqueId
    ? alerts.filter((a) => a.mitre_attack?.technique_id === selectedTechniqueId)
    : alerts;

  return (
    <div className="min-h-screen bg-cyber-bg text-cyber-text bg-cyber-grid flex flex-col selection:bg-cyber-cyan selection:text-black">
      {/* 1. Header Banner */}
      <Header
        isConnected={isConnected}
        mode={mode}
        activeThreatsCount={alerts.length}
        totalFlowsCount={12450}
        onTriggerThreat={handleTriggerThreat}
        onToggleMode={handleToggleMode}
      />

      {/* Main Dashboard Canvas */}
      <main className="flex-1 p-4 md:p-6 space-y-4 max-w-[1720px] mx-auto w-full">
        {/* 2. Top Strip: Live Animated Throughput Graph */}
        <TopThroughputStrip threatPulseCount={threatPulseCount} />

        {/* 3. Center Section: Live Alert Feed & MITRE ATT&CK Matrix Heatmap */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Center-Left Panel: Scrolling Live Alert Feed (5 cols) */}
          <div className="lg:col-span-5 h-[580px]">
            <AlertFeed
              alerts={displayedAlerts}
              selectedAlert={selectedAlert}
              onSelectAlert={setSelectedAlert}
            />
          </div>

          {/* Center-Right Panel: Interactive MITRE Matrix Heatmap (7 cols) */}
          <div className="lg:col-span-7 h-[580px]">
            <MitreMatrixHeatmap
              alerts={alerts}
              selectedTechniqueId={selectedTechniqueId}
              onSelectTechnique={handleSelectTechnique}
            />
          </div>
        </div>

        {/* 4. Bottom Section: Risk Posture Gauge & Alert Inspection Drawer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Bottom-Left Panel: Severity/Risk Gauge & Donut Chart (5 cols) */}
          <div className="lg:col-span-5 min-h-[380px]">
            <RiskPostureGauge alerts={alerts} />
          </div>

          {/* Bottom-Right Panel / Drawer: Raw Features, SHAP Chart, MITRE Card (7 cols) */}
          <div className="lg:col-span-7 min-h-[380px]">
            <AlertInspectionDrawer
              alert={selectedAlert}
              onUpdateStatus={handleUpdateStatus}
            />
          </div>
        </div>
      </main>

      {/* Footer Status Bar */}
      <footer className="border-t border-cyber-border/80 bg-cyber-surface/90 px-5 py-2.5 text-xs font-mono text-cyber-muted flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-cyber-green">
            <span className="w-2 h-2 rounded-full bg-cyber-green"></span>
            DEFENSE ENCLAVE // NOMINAL SECURE
          </span>
          <span>•</span>
          <span>UNIDIRECTIONAL TAP INTERFACE: rx0@diode</span>
          <span>•</span>
          <span>AI ENSEMBLE: ISOLATION FOREST + RANDOM FOREST</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-white">AI-DRIVEN UNIDIRECTIONAL THREAT ANALYSIS SYSTEM</span>
          <span className="text-cyber-cyan">BUILD 2026.09.11-PROD</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
