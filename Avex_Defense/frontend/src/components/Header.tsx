import React from 'react';
import { Shield, Radio, Flame, CheckCircle2, Lock, RefreshCw } from 'lucide-react';

interface HeaderProps {
  isConnected: boolean;
  mode: 'LIVE_WEBSOCKET' | 'SIMULATED_FEED';
  activeThreatsCount: number;
  totalFlowsCount: number;
  onTriggerThreat: () => void;
  onToggleMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isConnected,
  mode,
  activeThreatsCount,
  totalFlowsCount,
  onTriggerThreat,
  onToggleMode,
}) => {
  const [time, setTime] = React.useState(new Date().toUTCString());

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toUTCString()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="border-b border-cyber-border bg-cyber-surface/95 backdrop-blur px-5 py-3 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-40">
      {/* Brand & Project Identity */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-lg bg-cyber-elevated border border-cyber-cyan/40 flex items-center justify-center text-cyber-cyan glow-cyan">
            <Shield className="w-6 h-6 animate-pulse" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-cyan opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyber-cyan"></span>
          </span>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-wider font-mono text-white flex items-center gap-2">
              AVEX <span className="text-cyber-cyan">//</span> CYBER DEFENSE ENCLAVE
            </h1>
            <span className="text-xs px-2 py-0.5 rounded bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan font-mono font-medium">
              DATA DIODE v1.0
            </span>
          </div>
          <p className="text-xs text-cyber-muted font-mono flex items-center gap-3">
            <span>AI UNIDIRECTIONAL IP TRAFFIC INSPECTION</span>
            <span>•</span>
            <span className="text-gray-400">{time}</span>
          </p>
        </div>
      </div>

      {/* Center Status Indicators */}
      <div className="hidden lg:flex items-center gap-4 bg-cyber-elevated/80 border border-cyber-border rounded-lg px-4 py-1.5 font-mono text-xs">
        {/* Active Threats Counter */}
        <div className="flex items-center gap-2 border-r border-cyber-border pr-4">
          <Flame className="w-4 h-4 text-cyber-red animate-pulse" />
          <div>
            <div className="text-[10px] text-cyber-muted">ACTIVE THREATS</div>
            <div className="text-cyber-red font-bold">
              {activeThreatsCount} DETECTED
            </div>
          </div>
        </div>

        {/* Total Flows Processed */}
        <div className="flex items-center gap-2 border-r border-cyber-border pr-4">
          <div>
            <div className="text-[10px] text-cyber-muted">INGESTED FLOWS</div>
            <div className="text-white font-semibold">
              {totalFlowsCount.toLocaleString()}
            </div>
          </div>
        </div>
        {/* Diode Physical Integrity */}
        <div className="flex items-center gap-2 border-r border-cyber-border pr-4">
          <Lock className="w-4 h-4 text-cyber-green" />
          <div>
            <div className="text-[10px] text-cyber-muted">DIODE RX BOUNDARY</div>
            <div className="text-cyber-green font-semibold flex items-center gap-1">
              PHYSICALLY ENFORCED <CheckCircle2 className="w-3 h-3" />
            </div>
          </div>
        </div>

        {/* Cryptographic Ledger */}
        <div className="flex items-center gap-2 border-r border-cyber-border pr-4">
          <CheckCircle2 className="w-4 h-4 text-cyber-cyan" />
          <div>
            <div className="text-[10px] text-cyber-muted">TAMPER-EVIDENT LEDGER</div>
            <div className="text-cyber-cyan font-semibold">SHA-256 CHAINED</div>
          </div>
        </div>

        {/* WebSocket Connection Status */}
        <div className="flex items-center gap-2">
          <Radio className={`w-4 h-4 ${isConnected ? 'text-cyber-green animate-pulse' : 'text-cyber-amber'}`} />
          <div>
            <div className="text-[10px] text-cyber-muted">GATEWAY STREAM</div>
            <div className={`font-semibold flex items-center gap-1.5 ${isConnected ? 'text-cyber-green' : 'text-cyber-amber'}`}>
              <span className={`inline-block w-2 h-2 rounded-full ${isConnected ? 'bg-cyber-green glow-green' : 'bg-cyber-amber'}`}></span>
              {isConnected ? 'PORT 8000 LIVE' : mode === 'SIMULATED_FEED' ? 'DEMO SIMULATOR' : 'CONNECTING...'}
            </div>
          </div>
        </div>
      </div>

      {/* Right Controls & Quick Simulator */}
      <div className="flex items-center gap-3">
        {/* Simulator Toggle */}
        <button
          onClick={onToggleMode}
          className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-medium flex items-center gap-1.5 transition-all ${
            mode === 'SIMULATED_FEED'
              ? 'bg-cyber-amber/15 border-cyber-amber text-cyber-amber glow-amber'
              : 'bg-cyber-elevated border-cyber-border text-cyber-muted hover:text-white'
          }`}
          title="Toggle synthetic traffic stream for testing/presentations"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${mode === 'SIMULATED_FEED' ? 'animate-spin' : ''}`} />
          {mode === 'SIMULATED_FEED' ? 'DEMO MODE: ACTIVE' : 'ENABLE DEMO STREAM'}
        </button>

        {/* Trigger Threat Burst Button */}
        <button
          onClick={onTriggerThreat}
          className="px-3.5 py-1.5 rounded-lg bg-cyber-red/20 border border-cyber-red text-cyber-red hover:bg-cyber-red/30 hover:text-white font-mono text-xs font-semibold flex items-center gap-1.5 transition-all glow-red active:scale-95"
          title="Inject an immediate threat alert to test animations, throughput graph, and MITRE heatmap"
        >
          <Flame className="w-4 h-4 animate-bounce" />
          <span>SIMULATE ATTACK</span>
        </button>
      </div>
    </header>
  );
};
