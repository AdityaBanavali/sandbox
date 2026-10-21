import React from 'react';
import { Wifi, WifiOff, RefreshCw, Cpu, Server, Activity } from 'lucide-react';
import { ConnectionStatus } from '../types';

interface ConnectionBarProps {
  endpoint: string;
  onEndpointChange: (val: string) => void;
  status: ConnectionStatus;
  latencyMs: number | null;
  inferenceLatencyMs: number | null;
  packetCount: number;
  dropCount: number;
  mockEnabled: boolean;
  onToggleMock: () => void;
  onReconnect: () => void;
}

export const ConnectionBar: React.FC<ConnectionBarProps> = ({
  endpoint,
  onEndpointChange,
  status,
  latencyMs,
  inferenceLatencyMs,
  packetCount,
  dropCount,
  mockEnabled,
  onToggleMock,
  onReconnect
}) => {
  const isConnected = status === 'CONNECTED';
  const isReconnecting = status === 'RECONNECTING';

  return (
    <header className="bg-[#111318] border-b border-[#1F2430] px-4 lg:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-sm">
      {/* System Identification */}
      <div className="flex items-center gap-3">
        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-none transform rotate-45"></div>
        <div>
          <h1 className="text-xs font-semibold tracking-widest text-slate-200 uppercase font-mono flex items-center gap-2">
            STRUCTURAL HEALTH TELEMETRY <span className="text-slate-500">//</span> SEISMIC MONITOR
          </h1>
          <span className="text-[10px] font-mono text-slate-500 tracking-wider">
            ESP32 TINYML EDGE NODE • MPU6050 HARVEST
          </span>
        </div>
      </div>

      {/* Control & Telemetry Network Specs */}
      <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
        {/* Endpoint Input */}
        <div className="flex items-center bg-[#090A0F] border border-[#1F2430] rounded px-2.5 py-1">
          <Server className="w-3.5 h-3.5 text-slate-500 mr-2" />
          <span className="text-[11px] text-slate-500 mr-1.5 select-none">NODE:</span>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => onEndpointChange(e.target.value)}
            disabled={mockEnabled}
            placeholder="http://192.168.4.1"
            className="bg-transparent text-slate-200 focus:outline-none w-36 text-xs font-mono disabled:opacity-40"
          />
        </div>

        {/* Reconnect / Probe Button */}
        <button
          onClick={onReconnect}
          title="Force Reconnect / Probe Node"
          className="bg-[#161922] hover:bg-[#1F2430] border border-[#1F2430] px-2.5 py-1 rounded text-slate-300 transition flex items-center gap-1.5 text-xs font-mono"
        >
          <RefreshCw className={`w-3 h-3 ${isReconnecting ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
          <span>PROBE</span>
        </button>

        {/* Status Badge */}
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded border font-mono text-[11px] uppercase tracking-wider font-medium ${
            isConnected
              ? 'bg-[#10B981]/10 border-[#10B981]/40 text-[#10B981]'
              : isReconnecting
              ? 'bg-[#F59E0B]/10 border-[#F59E0B]/40 text-[#F59E0B]'
              : 'bg-[#EF4444]/10 border-[#EF4444]/40 text-[#EF4444]'
          }`}
        >
          {isConnected ? (
            <Wifi className="w-3.5 h-3.5" />
          ) : isReconnecting ? (
            <Activity className="w-3.5 h-3.5 animate-pulse" />
          ) : (
            <WifiOff className="w-3.5 h-3.5" />
          )}
          <span>{isConnected ? 'ESP32 CONNECTED' : isReconnecting ? 'RECONNECTING' : 'DEVICE OFFLINE / DISCONNECTED'}</span>
        </div>

        {/* Telemetry Latency Counters */}
        <div className="hidden sm:flex items-center gap-3 bg-[#090A0F] border border-[#1F2430] rounded px-3 py-1 text-slate-400 text-[11px] tabular-nums">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600">RTT:</span>
            <span className={latencyMs !== null ? 'text-slate-200' : 'text-slate-600'}>
              {latencyMs !== null ? `${latencyMs}ms` : '--'}
            </span>
          </div>
          <div className="h-3 w-px bg-[#1F2430]"></div>
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3 h-3 text-slate-600" />
            <span className="text-slate-600">TINYML:</span>
            <span className={inferenceLatencyMs !== null ? 'text-slate-200' : 'text-slate-600'}>
              {inferenceLatencyMs !== null ? `${inferenceLatencyMs}ms` : '--'}
            </span>
          </div>
          <div className="h-3 w-px bg-[#1F2430]"></div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600">RX:</span>
            <span className="text-slate-200">{packetCount}</span>
            {dropCount > 0 && <span className="text-rose-400">({dropCount} drops)</span>}
          </div>
        </div>

        {/* Mock Dev Toggle (Strictly off by default) */}
        <label className="flex items-center gap-2 cursor-pointer bg-[#090A0F] border border-[#1F2430] px-2.5 py-1 rounded hover:border-slate-700 transition">
          <input
            type="checkbox"
            checked={mockEnabled}
            onChange={onToggleMock}
            className="sr-only peer"
          />
          <div className="w-6 h-3.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1.5px] after:left-[1.5px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-amber-600 relative"></div>
          <span className="text-[10px] text-slate-400 uppercase select-none">MOCK DEV FEED</span>
        </label>
      </div>
    </header>
  );
};
