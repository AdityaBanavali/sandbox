import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useEspTelemetry } from './hooks/useEspTelemetry';
import { TelemetryGraph } from './components/TelemetryGraph';
import { ResonanceSpectrum } from './components/ResonanceSpectrum';
import { DigitalTwinViewer } from './components/DigitalTwinViewer';
import { InferenceCard } from './components/InferenceCard';
import { ActuatorStatus } from './components/ActuatorStatus';
import { EventLog } from './components/EventLog';
import { EventLogItem, InferenceState } from './types';
import {
  Wifi,
  WifiOff,
  Radio,
  FileSpreadsheet,
  Download,
  AlertOctagon,
  ShieldAlert,
  ShieldCheck,
  Server,
  Activity,
  Cpu,
  Clock,
  Layers,
  Power
} from 'lucide-react';

export default function App() {
  const [endpoint, setEndpoint] = useState<string>('http://192.168.4.1');
  const [connectionEnabled, setConnectionEnabled] = useState<boolean>(true);
  const [mockEnabled, setMockEnabled] = useState<boolean>(false);

  // Hook connecting to ESP32 WebSocket endpoint & managing flight recorder
  const {
    telemetry,
    isConnected,
    connectionStatus,
    latencyMs,
    history,
    packetCount,
    dropCount,
    incidentFlightRecorder,
    isRecordingIncident,
    exportIncidentCSV,
    sendActuatorOverride,
    sendCommand
  } = useEspTelemetry({
    endpoint: connectionEnabled ? endpoint : '',
    mockEnabled,
    pollIntervalMs: 150
  });

  const [logs, setLogs] = useState<EventLogItem[]>([
    {
      id: 'boot-1',
      timestamp: new Date().toLocaleTimeString(),
      type: 'INFO',
      message: 'AEGIS-SHM Industrial Command Center initialized. Standby on link ws://192.168.4.1/ws'
    }
  ]);

  const prevStateRef = useRef<InferenceState | null>(null);
  const prevBarrierRef = useRef<boolean | null>(null);

  const addLog = useCallback(
    (message: string, type: EventLogItem['type'] = 'INFO') => {
      setLogs((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          timestamp: new Date().toLocaleTimeString(),
          type,
          message
        },
        ...prev.slice(0, 99)
      ]);
    },
    []
  );

  // Automatic logging of state changes & actuator trips
  useEffect(() => {
    if (!telemetry) return;

    const curState = telemetry.inference.state;
    if (prevStateRef.current && prevStateRef.current !== curState) {
      if (curState === 'SEISMIC_EVENT') {
        addLog('CRITICAL: Seismic breach tripped! 15s incident flight recorder engaged.', 'CRITICAL');
      } else if (curState === 'RESONANCE_WARNING') {
        addLog(
          `WARNING: Harmonic resonance match detected near structural natural band (f = ${telemetry.fft.dominant_freq_hz} Hz)`,
          'WARN'
        );
      } else if (curState === 'NOMINAL') {
        addLog('TELEMETRY: Vibration envelope restored to nominal structural baseline.', 'INFO');
      }
    }
    prevStateRef.current = curState;

    const barrier = telemetry.actuator.safety_barrier_deployed;
    if (prevBarrierRef.current !== null && prevBarrierRef.current !== barrier) {
      if (barrier) {
        addLog('ACTUATOR TRIP: Fail-safe solenoid deployed physical barrier.', 'CRITICAL');
      } else {
        addLog('ACTUATOR ACK: Safety barrier retracted to standby position.', 'INFO');
      }
    }
    prevBarrierRef.current = barrier;
  }, [telemetry, addLog]);

  const isSeismicBreach = isConnected && telemetry?.inference.state === 'SEISMIC_EVENT';
  const hasIncidentData = incidentFlightRecorder.length > 0;

  return (
    <div className="min-h-screen bg-[#090A0F] text-slate-100 flex flex-col font-sans select-none antialiased">
      {/* 1. Top Technical Command Header */}
      <header className="bg-[#0B0D13] border-b border-[#1F2430] px-4 lg:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono shadow-md">
        {/* System Title */}
        <div className="flex items-center gap-3">
          <div
            className={`w-2.5 h-2.5 rounded-none transform rotate-45 transition-colors ${
              isConnected ? 'bg-emerald-500 shadow-[0_0_8px_#10B981]' : 'bg-rose-500'
            }`}
          ></div>
          <div>
            <h1 className="text-xs font-bold tracking-widest text-slate-100 uppercase flex items-center gap-2">
              AEGIS-SHM <span className="text-slate-600">//</span> INDUSTRIAL SEISMIC & STRUCTURAL INTEGRITY
            </h1>
            <span className="text-[10px] text-slate-500 tracking-wider block">
              MISSION CONTROL • ESP32 TINYML SENSOR NODE • MPU6050 HARVEST
            </span>
          </div>
        </div>

        {/* IP / WebSocket Input, Live Latency, and Connection Controls */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {/* IP / WebSocket Target Input */}
          <div className="flex items-center bg-[#07090F] border border-[#1F2430] rounded px-2.5 py-1">
            <Server className="w-3.5 h-3.5 text-slate-500 mr-2" />
            <span className="text-[11px] text-slate-500 mr-1.5 select-none">NODE:</span>
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              disabled={mockEnabled || !connectionEnabled}
              placeholder="http://192.168.4.1"
              className="bg-transparent text-slate-200 focus:outline-none w-36 text-xs font-mono disabled:opacity-40"
            />
          </div>

          {/* Connection Toggle */}
          <button
            onClick={() => {
              setConnectionEnabled((v) => {
                const next = !v;
                addLog(`Operator toggled target link: ${next ? 'CONNECTING' : 'DISCONNECTED'}`, 'COMMAND');
                return next;
              });
            }}
            title={connectionEnabled ? 'Sever telemetry connection' : 'Engage telemetry connection'}
            className={`border px-2.5 py-1 rounded text-xs transition flex items-center gap-1.5 ${
              connectionEnabled
                ? 'bg-[#141824] hover:bg-[#1C2234] border-[#1F2430] text-slate-300'
                : 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/50 text-rose-300'
            }`}
          >
            <Power className="w-3 h-3" />
            <span>{connectionEnabled ? 'DISCONNECT' : 'CONNECT'}</span>
          </button>

          {/* Live Latency Display */}
          <div className="flex items-center gap-2 bg-[#07090F] border border-[#1F2430] rounded px-3 py-1 tabular-nums text-[11px]">
            <span className="text-slate-500">RTT:</span>
            <span className={isConnected && latencyMs !== null ? 'text-cyan-300 font-semibold' : 'text-slate-600'}>
              {isConnected && latencyMs !== null ? `${latencyMs}ms` : '--'}
            </span>
          </div>

          {/* Status Badge */}
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded border text-[11px] tracking-wider uppercase font-semibold transition-colors ${
              isConnected
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/40 text-rose-400'
            }`}
          >
            {isConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span>ONLINE // STREAMING</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                <span>DEVICE DISCONNECTED</span>
              </>
            )}
          </div>

          {/* Mock Dev Mode Toggle (Discreet, auto-disabled during live hardware streaming) */}
          <label
            title={
              isConnected && !mockEnabled
                ? 'Mock feed locked while live edge hardware is streaming'
                : 'Toggle synthetic mock feed'
            }
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] transition ${
              isConnected && !mockEnabled
                ? 'border-slate-800 bg-[#07090F] text-slate-600 opacity-40 cursor-not-allowed'
                : mockEnabled
                ? 'border-amber-600/50 bg-amber-500/10 text-amber-300 cursor-pointer'
                : 'border-slate-800/80 bg-[#07090F] text-slate-500 hover:border-slate-700 cursor-pointer'
            }`}
          >
            <input
              type="checkbox"
              checked={mockEnabled}
              disabled={isConnected && !mockEnabled}
              onChange={() => {
                if (isConnected && !mockEnabled) return;
                setMockEnabled((v) => {
                  const next = !v;
                  addLog(`Operator toggled Mock Dev Feed: ${next ? 'ACTIVATED' : 'DEACTIVATED'}`, 'COMMAND');
                  return next;
                });
              }}
              className="sr-only peer"
            />
            <div className="w-5 h-2.5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-slate-400 peer-checked:after:bg-amber-400 after:rounded-full after:h-2 after:w-2 after:transition-all peer-checked:bg-amber-950/60 relative"></div>
            <span className="uppercase select-none">MOCK</span>
          </label>
        </div>
      </header>

      {/* 2. Main Mission Control Grid Layout (2-Column Desktop Grid) */}
      <main className="flex-1 p-4 lg:p-5 max-w-[1780px] w-full mx-auto">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-5 items-start">
          {/* =========================================================
              LEFT COLUMN:
              1. 3D Digital Twin Viewer
              2. Tri-Axial Real-Time Oscilloscope Waveform
              ========================================================= */}
          <section className="space-y-4 lg:space-y-5 flex flex-col">
            {/* 3D Digital Twin Viewer */}
            <DigitalTwinViewer
              pitch={telemetry?.imu.tilt.pitch}
              roll={telemetry?.imu.tilt.roll}
              accelMagnitude={history.length > 0 ? (history[history.length - 1].pga ?? 0) : 0}
              dominantFreqHz={telemetry?.fft.dominant_freq_hz}
              inferenceState={telemetry?.inference.state}
              isConnected={isConnected}
            />

            {/* Tri-Axial Real-Time Waveform */}
            <TelemetryGraph
              history={history}
              isConnected={isConnected}
              currentAccel={telemetry?.imu.accel}
            />
          </section>

          {/* =========================================================
              RIGHT COLUMN:
              1. Resonance Frequency Analyzer (ResonanceSpectrum)
              2. TinyML Edge Inference Card
              3. Fail-Safe Actuator Panel
              4. Incident Flight Recorder Card
              ========================================================= */}
          <section className="space-y-4 lg:space-y-5 flex flex-col">
            {/* Resonance Frequency Analyzer with Unified State Sync */}
            <ResonanceSpectrum
              fft={telemetry?.fft}
              inferenceState={telemetry?.inference.state}
              anomalyScore={telemetry?.inference.anomaly_score}
              isConnected={isConnected}
              nominalBaselineHz={4.0}
              dangerBandMin={1.0}
              dangerBandMax={8.0}
            />

            {/* TinyML Edge Inference Card & Fail-Safe Actuator Panel Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* TinyML Edge Inference Card */}
              <InferenceCard
                inference={telemetry?.inference}
                isConnected={isConnected}
              />

              {/* Fail-Safe Actuator Panel */}
              <ActuatorStatus
                actuator={telemetry?.actuator}
                isConnected={isConnected}
                onSendCommand={sendCommand}
                onLogEvent={addLog}
              />
            </div>

            {/* Incident Flight Recorder Card */}
            <div className="bg-[#0B0D13] border border-[#1F2430] rounded p-4 flex flex-col justify-between shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F2430] pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-mono font-semibold tracking-wider text-slate-200 uppercase">
                    INCIDENT FLIGHT RECORDER // SEISMOGRAM BUFFER
                  </h3>
                </div>

                {/* Trigger Status Badge */}
                <div className="flex items-center gap-2 font-mono text-[10px]">
                  {isRecordingIncident ? (
                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded border border-rose-500/50 bg-rose-500/15 text-rose-300 font-semibold animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                      TRIGGER ACTIVE // RECORDING 15s
                    </span>
                  ) : hasIncidentData ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-300">
                      INCIDENT CAPTURED ({incidentFlightRecorder.length} SAMPLES)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded border border-slate-800 bg-[#07090F] text-slate-500">
                      STANDBY // IDLE
                    </span>
                  )}
                </div>
              </div>

              {/* Flight Recorder Telemetry Metrics */}
              <div className="grid grid-cols-3 gap-2 py-1 font-mono text-xs border-b border-[#1F2430]/70 pb-3 mb-3 tabular-nums">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">BUFFER DURATION:</span>
                  <div className="text-sm font-semibold text-slate-200 mt-0.5">15.00 SECONDS</div>
                </div>

                <div className="text-center border-x border-[#1F2430]/60 px-2">
                  <span className="text-[10px] text-slate-500 block uppercase">LOGGED SAMPLES:</span>
                  <div className="text-sm font-semibold text-cyan-300 mt-0.5">
                    {incidentFlightRecorder.length}
                    <span className="text-[10px] text-slate-500 font-normal ml-1">/ 750 max</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block uppercase">TRIGGER RULE:</span>
                  <div className="text-sm font-semibold text-rose-400 mt-0.5">SEISMIC_EVENT</div>
                </div>
              </div>

              {/* Export Seismogram (.CSV) Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="text-[11px] font-mono text-slate-500 max-w-md">
                  Downloads high-precision 50Hz tri-axial acceleration, PGA, MMI, and FFT spectra snapshot as an earthquake seismogram.
                </p>

                <button
                  onClick={() => {
                    const ok = exportIncidentCSV();
                    if (ok) {
                      addLog('SEISMOGRAM: Earthquake incident flight package downloaded (.csv)', 'INFO');
                    } else {
                      addLog('SEISMOGRAM: No data logged in buffer to export.', 'WARN');
                    }
                  }}
                  disabled={!hasIncidentData && history.length === 0}
                  className={`px-3.5 py-1.5 rounded border text-xs font-mono font-semibold transition flex items-center gap-2 ${
                    hasIncidentData
                      ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/50 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                      : history.length > 0
                      ? 'bg-[#141824] hover:bg-[#1E2436] border-[#1F2430] text-slate-300'
                      : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>EXPORT SEISMOGRAM (.CSV)</span>
                </button>
              </div>
            </div>

            {/* Incident & Event Audit Log */}
            <EventLog
              logs={logs}
              onClear={() => setLogs([])}
              onExportCSV={exportIncidentCSV}
              isRecordingIncident={isRecordingIncident}
              incidentCount={incidentFlightRecorder.length}
            />
          </section>
        </div>
      </main>

      {/* 3. Technical SCADA Sub-Footer */}
      <footer className="border-t border-[#1F2430] bg-[#07090F] px-4 lg:px-6 py-2 text-[11px] font-mono text-slate-500 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-none transform rotate-45 ${
              isConnected ? 'bg-emerald-500' : 'bg-slate-700'
            }`}
          ></span>
          <span>
            {isConnected
              ? 'ESP32 TELEMETRY STREAM ACTIVE // REAL RAW HARVEST (50 Hz)'
              : 'OFFLINE // DISCONNECTED FROM EDGE HARDWARE'}
          </span>
        </div>
        <div className="flex items-center gap-4 text-[10px] tabular-nums">
          <span>PACKETS RX: {packetCount}</span>
          {dropCount > 0 && <span className="text-rose-400">DROPS: {dropCount}</span>}
          <span>TINYML RUNTIME: TFLITE MICRO</span>
          <span>SENSOR: MPU6050 (±2g)</span>
        </div>
      </footer>
    </div>
  );
}
