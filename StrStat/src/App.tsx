import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useEspTelemetry } from './hooks/useEspTelemetry';
import { TelemetryGraph } from './components/TelemetryGraph';
import { ResonanceSpectrum } from './components/ResonanceSpectrum';
import { DigitalTwinViewer } from './components/DigitalTwinViewer';
import { InferenceCard } from './components/InferenceCard';
import { ActuatorStatus } from './components/ActuatorStatus';
import { EventLog } from './components/EventLog';
import { IncidentReplayModal } from './components/IncidentReplayModal';
import { EventLogItem, InferenceState, SimulationProfile } from './types';
import {
  Wifi,
  WifiOff,
  Server,
  Power,
  Play,
  RotateCcw,
  Sliders,
  Crosshair,
  FileSpreadsheet,
  Download,
  ChevronDown,
  Activity,
  Layers,
  Radio,
  Sparkles
} from 'lucide-react';

const SIM_PROFILES: { id: SimulationProfile; label: string; desc: string; badge: string }[] = [
  {
    id: 'LIVE',
    label: 'LIVE ESP32 FEED',
    desc: 'Hardware telemetry link over WebSocket (ws://<ip>/ws)',
    badge: 'HARDWARE'
  },
  {
    id: 'RESONANCE_SWEEP',
    label: 'RESONANCE HARMONIC SWEEP',
    desc: '3.2 Hz resonant buildup, inducing dynamic magnification spike',
    badge: 'RESONANCE'
  },
  {
    id: 'EL_CENTRO_1940',
    label: 'EL CENTRO 1940 EARTHQUAKE',
    desc: 'High dynamic PGA waveform with MMI VIII+ trigger & barrier trip',
    badge: 'SEISMIC'
  },
  {
    id: 'STIFFNESS_DRIFT',
    label: 'STRUCTURAL FATIGUE / STIFFNESS DRIFT',
    desc: 'Natural frequency drops from 4.0 Hz down to 2.8 Hz (> 25% drift)',
    badge: 'FATIGUE'
  },
  {
    id: 'FOUNDATION_SETTLEMENT',
    label: 'STATIC FOUNDATION SETTLEMENT',
    desc: 'Permanent 8-degree pitch tilt without vibration',
    badge: 'SETTLEMENT'
  }
];

export default function App() {
  const [endpoint, setEndpoint] = useState<string>('http://192.168.4.1');
  const [connectionEnabled, setConnectionEnabled] = useState<boolean>(true);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState<boolean>(false);
  const [isReplayModalOpen, setIsReplayModalOpen] = useState<boolean>(false);

  // Hook connecting to ESP32 WebSocket, simulation engine & incident flight recorder
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
    simProfile,
    setSimProfile,
    tareOffset,
    calibrateTare,
    resetTare,
    isTared,
    exportIncidentCSV,
    sendActuatorOverride,
    sendCommand,
    isReplayActive,
    replayFrameIndex,
    replayBuffer,
    openReplay,
    closeReplay,
    setReplayFrameIndex,
    isReplayPlaying,
    setIsReplayPlaying,
    replaySpeed,
    setReplaySpeed,
    stepReplay
  } = useEspTelemetry({
    endpoint: connectionEnabled ? endpoint : '',
    simProfile: 'LIVE',
    pollIntervalMs: 140
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

  const hasIncidentData = incidentFlightRecorder.length > 0;
  const currentProfileObj = SIM_PROFILES.find((p) => p.id === simProfile) || SIM_PROFILES[0];

  return (
    <div className="h-screen max-h-screen bg-[#090A0F] text-slate-100 flex flex-col font-sans select-none antialiased overflow-hidden">
      {/* 1. Top Technical Command Header */}
      <header className="bg-[#0B0D13] border-b border-[#1F2430] px-3 lg:px-5 py-2 flex flex-wrap items-center justify-between gap-2.5 text-xs font-mono shadow-md flex-shrink-0 z-30">
        {/* System Title */}
        <div className="flex items-center gap-2.5">
          <div
            className={`w-2.5 h-2.5 rounded-none transform rotate-45 transition-colors ${
              isConnected ? 'bg-emerald-500 shadow-[0_0_8px_#10B981]' : 'bg-rose-500'
            }`}
          ></div>
          <div>
            <h1 className="text-xs font-bold tracking-widest text-slate-100 uppercase flex items-center gap-1.5">
              AEGIS-SHM <span className="text-slate-600">//</span> INDUSTRIAL SEISMIC & STRUCTURAL INTEGRITY
            </h1>
            <span className="text-[9px] text-slate-500 tracking-wider block">
              MISSION CONTROL • ESP32 TINYML SENSOR NODE • MPU6050 HARVEST
            </span>
          </div>
        </div>

        {/* Header Controls: Node IP, Connect, Tare, Simulation Profiles, Latency */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* IP / WebSocket Target Input */}
          <div className="flex items-center bg-[#07090F] border border-[#1F2430] rounded px-2 py-0.5">
            <Server className="w-3.5 h-3.5 text-slate-500 mr-1.5" />
            <span className="text-[10px] text-slate-500 mr-1 select-none">NODE:</span>
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              disabled={simProfile !== 'LIVE' || !connectionEnabled}
              placeholder="http://192.168.4.1"
              className="bg-transparent text-slate-200 focus:outline-none w-32 text-xs font-mono disabled:opacity-40"
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
            className={`border px-2 py-0.5 rounded text-xs transition flex items-center gap-1.5 ${
              connectionEnabled
                ? 'bg-[#141824] hover:bg-[#1C2234] border-[#1F2430] text-slate-300'
                : 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/50 text-rose-300'
            }`}
          >
            <Power className="w-3 h-3" />
            <span>{connectionEnabled ? 'DISCONNECT' : 'CONNECT'}</span>
          </button>

          {/* Tare / Sensor Zeroing Calibration Button */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const offset = calibrateTare();
                addLog(
                  `CALIBRATION: IMU tare offset captured: ax=${offset.ax.toFixed(3)}, ay=${offset.ay.toFixed(3)}, az_bias=${offset.az.toFixed(3)}, pitch=${offset.pitch.toFixed(1)}°, roll=${offset.roll.toFixed(1)}°`,
                  'COMMAND'
                );
              }}
              title="Collect baseline offset vector and zero sensor reading in localStorage"
              className={`px-2 py-0.5 rounded border text-xs transition flex items-center gap-1.5 ${
                isTared
                  ? 'bg-cyan-500/20 hover:bg-cyan-500/30 border-cyan-500/50 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                  : 'bg-[#141824] hover:bg-[#1C2234] border-[#1F2430] text-slate-300'
              }`}
            >
              <Crosshair className="w-3 h-3 text-cyan-400" />
              <span>{isTared ? 'TARED [ZERO]' : 'TARE / ZERO'}</span>
            </button>
            {isTared && (
              <button
                onClick={() => {
                  resetTare();
                  addLog('CALIBRATION: IMU tare zero offsets cleared.', 'INFO');
                }}
                title="Clear Tare baseline calibration"
                className="px-1.5 py-0.5 rounded bg-slate-900 border border-[#1F2430] text-[10px] text-slate-500 hover:text-slate-200 transition"
              >
                <RotateCcw className="w-2.5 h-2.5" />
              </button>
            )}
          </div>

          {/* Explicit MOCK DATA Toggle Button */}
          <button
            onClick={() => {
              if (simProfile === 'LIVE') {
                setSimProfile('RESONANCE_SWEEP');
                addLog('SIMULATION: Mock Data stream ENGAGED (Harmonic Resonance)', 'COMMAND');
              } else {
                setSimProfile('LIVE');
                addLog('SIMULATION: Switched back to Live Hardware stream', 'COMMAND');
              }
            }}
            title={simProfile !== 'LIVE' ? 'Disable mock feed and return to live hardware' : 'Engage synthetic mock demonstration feed'}
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded border text-xs font-mono font-semibold transition ${
              simProfile !== 'LIVE'
                ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/60 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                : 'bg-[#141824] hover:bg-[#1C2234] border-[#1F2430] text-slate-400 hover:text-slate-200'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full transition-colors ${
                simProfile !== 'LIVE' ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'
              }`}
            ></div>
            <span>MOCK DATA: {simProfile !== 'LIVE' ? 'ON' : 'OFF'}</span>
          </button>

          {/* Interactive Simulation Vector Generator Dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileDropdownOpen((o) => !o)}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded border text-xs transition ${
                simProfile === 'LIVE'
                  ? 'border-[#1F2430] bg-[#07090F] text-slate-300 hover:border-slate-600'
                  : 'border-amber-500/50 bg-amber-500/15 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
              }`}
            >
              <Sliders className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] text-slate-500 uppercase">VECTOR:</span>
              <span className="font-semibold">{currentProfileObj.badge}</span>
              <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
            </button>

            {profileDropdownOpen && (
              <div className="absolute top-full mt-1.5 right-0 w-80 bg-[#0B0D13] border border-[#2D374D] rounded shadow-2xl p-1.5 z-50 flex flex-col gap-1 backdrop-blur-md">
                <div className="text-[10px] font-bold text-slate-500 uppercase px-2 py-1 border-b border-[#1F2430]">
                  SELECT EXCITATION PROFILE // VIVA DEMO
                </div>
                {SIM_PROFILES.map((p) => {
                  const isSelected = simProfile === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSimProfile(p.id);
                        setProfileDropdownOpen(false);
                        addLog(`SIMULATION VECTOR: Switched to profile ${p.label}`, 'COMMAND');
                      }}
                      className={`text-left p-2 rounded transition flex flex-col gap-0.5 ${
                        isSelected
                          ? 'bg-amber-500/20 border border-amber-500/40 text-amber-200'
                          : 'hover:bg-[#141926] text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-slate-100">{p.label}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-black/40 text-amber-400 border border-amber-500/30">
                          {p.badge}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 leading-tight">{p.desc}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live Latency Display */}
          <div className="flex items-center gap-1.5 bg-[#07090F] border border-[#1F2430] rounded px-2 py-0.5 tabular-nums text-[11px]">
            <span className="text-slate-500">RTT:</span>
            <span className={isConnected && latencyMs !== null ? 'text-cyan-300 font-semibold' : 'text-slate-600'}>
              {isConnected && latencyMs !== null ? `${latencyMs}ms` : '--'}
            </span>
          </div>

          {/* Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded border text-[10px] tracking-wider uppercase font-semibold transition-colors ${
              isConnected
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/40 text-rose-400'
            }`}
          >
            {isConnected ? (
              <>
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span>ONLINE // {simProfile === 'LIVE' ? 'LIVE' : 'SIM'}</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-rose-400" />
                <span>OFFLINE</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Replay Active Global Status Banner */}
      {isReplayActive && (
        <div className="bg-cyan-950/80 border-b border-cyan-500/50 px-4 py-1 flex items-center justify-between text-xs font-mono text-cyan-200 z-20 flex-shrink-0 shadow-md">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            <span className="font-bold tracking-wider">
              INCIDENT REPLAY ACTIVE // STREAMING SEISMOGRAM BUFFER TO TWIN & OSCILLOSCOPE
            </span>
            <span className="text-cyan-400 text-[11px] tabular-nums">
              • FRAME {replayFrameIndex + 1}/{replayBuffer.length} ({replayBuffer[replayFrameIndex]?.elapsedSec.toFixed(2)}s)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsReplayModalOpen(true)}
              className="px-2 py-0.5 rounded bg-cyan-800 hover:bg-cyan-700 text-cyan-100 text-[10px] font-semibold"
            >
              EXPAND SCRUBBER
            </button>
            <button
              onClick={closeReplay}
              className="px-2.5 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/50 text-rose-300 text-[10px] font-semibold"
            >
              EXIT REPLAY
            </button>
          </div>
        </div>
      )}

      {/* 2. Main Mission Control Grid Layout (Optimized for 1080p Single-Page Viewport) */}
      <main className="flex-1 p-2.5 lg:p-3.5 max-w-[1880px] w-full mx-auto overflow-y-auto lg:overflow-hidden">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5 lg:gap-3.5 items-start h-full">
          {/* =========================================================
              LEFT COLUMN:
              1. 3D Digital Twin Viewer with Inter-story Drift & Shading
              2. Tri-Axial Real-Time Oscilloscope Waveform with 0.0g Datum
              ========================================================= */}
          <section className="space-y-2.5 lg:space-y-3 flex flex-col h-full">
            {/* 3D Digital Twin Viewer */}
            <DigitalTwinViewer
              pitch={telemetry?.imu.tilt.pitch}
              roll={telemetry?.imu.tilt.roll}
              accelMagnitude={history.length > 0 ? (history[history.length - 1].pga ?? 0) : 0}
              dominantFreqHz={telemetry?.fft.dominant_freq_hz}
              inferenceState={telemetry?.inference.state}
              anomalyScore={telemetry?.inference.anomaly_score}
              isConnected={isConnected}
            />

            {/* Tri-Axial Real-Time SCADA Waveform */}
            <TelemetryGraph
              history={history}
              isConnected={isConnected}
              currentAccel={telemetry?.imu.accel}
            />
          </section>

          {/* =========================================================
              RIGHT COLUMN:
              1. Resonance Frequency Analyzer (ResonanceSpectrum)
              2. TinyML Edge Inference Card & Fail-Safe Actuator Row
              3. Incident Flight Recorder & Seismogram Replay
              4. Incident Audit Log
              ========================================================= */}
          <section className="space-y-2.5 lg:space-y-3 flex flex-col h-full">
            {/* Resonance Frequency Analyzer with Hazard Hatch & Peak Pin */}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <InferenceCard
                inference={telemetry?.inference}
                isConnected={isConnected}
              />

              <ActuatorStatus
                actuator={telemetry?.actuator}
                isConnected={isConnected}
                onSendCommand={sendCommand}
                onLogEvent={addLog}
              />
            </div>

            {/* Incident Flight Recorder & Seismogram Buffer Card */}
            <div className="bg-[#0B0D13] border border-[#1F2430] rounded p-3 flex flex-col justify-between shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F2430] pb-2 mb-2">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-mono font-semibold tracking-wider text-slate-200 uppercase">
                    INCIDENT FLIGHT RECORDER // SEISMOGRAM BUFFER
                  </h3>
                </div>

                {/* Trigger Status Badge */}
                <div className="flex items-center gap-2 font-mono text-[10px]">
                  {isRecordingIncident ? (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-rose-500/50 bg-rose-500/15 text-rose-300 font-semibold animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
                      TRIGGER ACTIVE // 15s
                    </span>
                  ) : hasIncidentData ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-300">
                      INCIDENT LOGGED ({incidentFlightRecorder.length} SAMPLES)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded border border-slate-800 bg-[#07090F] text-slate-500">
                      STANDBY // IDLE
                    </span>
                  )}
                </div>
              </div>

              {/* Flight Recorder Telemetry Metrics */}
              <div className="grid grid-cols-3 gap-2 py-0.5 font-mono text-xs border-b border-[#1F2430]/70 pb-2 mb-2 tabular-nums">
                <div>
                  <span className="text-[9px] text-slate-500 block uppercase">BUFFER DURATION:</span>
                  <div className="text-xs font-semibold text-slate-200">15.00 SECONDS</div>
                </div>

                <div className="text-center border-x border-[#1F2430]/60 px-2">
                  <span className="text-[9px] text-slate-500 block uppercase">LOGGED SAMPLES:</span>
                  <div className="text-xs font-semibold text-cyan-300">
                    {incidentFlightRecorder.length}
                    <span className="text-[9px] text-slate-500 font-normal ml-1">/ 750 max</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[9px] text-slate-500 block uppercase">TRIGGER RULE:</span>
                  <div className="text-xs font-semibold text-rose-400">SEISMIC_EVENT</div>
                </div>
              </div>

              {/* Action Bar: Export CSV & Open Replay */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <p className="text-[10px] font-mono text-slate-500 max-w-md hidden sm:block">
                  High-precision 50Hz tri-axial acceleration, PGA, MMI, and FFT spectra snapshot.
                </p>

                <div className="flex items-center gap-2">
                  {/* [OPEN REPLAY] Button */}
                  <button
                    onClick={() => {
                      openReplay();
                      setIsReplayModalOpen(true);
                      addLog('REPLAY: Incident flight timeline viewer initialized.', 'INFO');
                    }}
                    className="px-3 py-1 rounded border text-xs font-mono font-semibold transition flex items-center gap-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 border-cyan-500/50 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                  >
                    <Play className="w-3.5 h-3.5 fill-cyan-300" />
                    <span>OPEN REPLAY</span>
                  </button>

                  {/* Export CSV Button */}
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
                    className={`px-3 py-1 rounded border text-xs font-mono font-semibold transition flex items-center gap-1.5 ${
                      hasIncidentData
                        ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/50 text-emerald-300'
                        : history.length > 0
                        ? 'bg-[#141824] hover:bg-[#1E2436] border-[#1F2430] text-slate-300'
                        : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>EXPORT CSV</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Compact Incident & Event Audit Log */}
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
      <footer className="border-t border-[#1F2430] bg-[#07090F] px-3 lg:px-5 py-1.5 text-[10px] font-mono text-slate-500 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span
            className={`w-1.5 h-1.5 rounded-none transform rotate-45 ${
              isConnected ? 'bg-emerald-500' : 'bg-slate-700'
            }`}
          ></span>
          <span>
            {isConnected
              ? `TELEMETRY STREAM ACTIVE // MODE: ${currentProfileObj.label} (50 Hz)`
              : 'OFFLINE // DISCONNECTED FROM EDGE HARDWARE'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] tabular-nums">
          <span>PACKETS RX: {packetCount}</span>
          {dropCount > 0 && <span className="text-rose-400">DROPS: {dropCount}</span>}
          <span>TINYML: TFLITE MICRO</span>
          <span>SENSOR: MPU6050 (±2g)</span>
          {isTared && <span className="text-cyan-400">CALIBRATED: TARED</span>}
        </div>
      </footer>

      {/* 4. Incident Flight Replay Timeline Modal */}
      <IncidentReplayModal
        isOpen={isReplayModalOpen}
        onClose={() => setIsReplayModalOpen(false)}
        replayBuffer={replayBuffer}
        currentIndex={replayFrameIndex}
        onSeek={setReplayFrameIndex}
        isPlaying={isReplayPlaying}
        onTogglePlay={() => setIsReplayPlaying((p) => !p)}
        speed={replaySpeed}
        onChangeSpeed={setReplaySpeed}
        onStep={stepReplay}
        onExportCSV={() => exportIncidentCSV(replayBuffer)}
      />
    </div>
  );
}
