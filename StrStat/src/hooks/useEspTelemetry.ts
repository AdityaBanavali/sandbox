import { useState, useEffect, useRef, useCallback } from 'react';
import {
  EspTelemetryPayload,
  AccelSample,
  FrequencySample,
  IncidentFlightSnapshot,
  ConnectionStatus,
  SimulationProfile,
  TareOffset
} from '../types';
import {
  calculatePGA,
  calculateTotalAcceleration,
  mapPgaToMmi,
  calculateResonantFrequencyDrift,
  NOMINAL_BASELINE_FREQ_HZ,
  getStoredTareOffset,
  saveTareOffset,
  clearTareOffset,
  applyTareOffset,
  ZERO_TARE_OFFSET
} from '../utils/structuralMath';

export interface UseEspTelemetryOptions {
  endpoint: string;
  simProfile?: SimulationProfile;
  pollIntervalMs?: number;
  timeoutMs?: number;
  nominalFreqHz?: number;
  watchdogTimeoutMs?: number;
  incidentDurationMs?: number;
}

export interface UseEspTelemetryResult {
  telemetry: EspTelemetryPayload | null;
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  latencyMs: number | null;
  history: AccelSample[];
  accelBuffer: AccelSample[];
  frequencyBuffer: FrequencySample[];
  packetCount: number;
  dropCount: number;
  incidentFlightRecorder: IncidentFlightSnapshot[];
  isRecordingIncident: boolean;
  simProfile: SimulationProfile;
  setSimProfile: (profile: SimulationProfile) => void;
  tareOffset: TareOffset;
  calibrateTare: () => TareOffset;
  resetTare: () => void;
  isTared: boolean;
  exportIncidentCSV: (overrideBuffer?: IncidentFlightSnapshot[]) => boolean;
  sendActuatorOverride: (override: boolean) => boolean;
  sendCommand: (path: string, body?: Record<string, unknown>) => Promise<boolean>;
  // Replay functionality
  isReplayActive: boolean;
  replayFrameIndex: number;
  replayBuffer: IncidentFlightSnapshot[];
  openReplay: (buffer?: IncidentFlightSnapshot[]) => void;
  closeReplay: () => void;
  setReplayFrameIndex: (idx: number) => void;
  isReplayPlaying: boolean;
  setIsReplayPlaying: (playing: boolean | ((p: boolean) => boolean)) => void;
  replaySpeed: 1 | 2;
  setReplaySpeed: (speed: 1 | 2) => void;
  stepReplay: (delta: number) => void;
}

const ROLLING_BUFFER_MAX_SAMPLES = 60;
const WATCHDOG_THRESHOLD_MS = 1500;
const INCIDENT_DURATION_MS = 15000;

/**
 * Normalizes an HTTP/IP or WebSocket address into a valid ESP32 WebSocket URI: ws://<IP>/ws
 */
export function normalizeWsEndpoint(raw: string): string {
  let cleaned = raw.trim().replace(/\/+$/, '');
  if (!cleaned) return '';

  if (cleaned.startsWith('http://')) {
    cleaned = 'ws://' + cleaned.slice(7);
  } else if (cleaned.startsWith('https://')) {
    cleaned = 'wss://' + cleaned.slice(8);
  } else if (!cleaned.startsWith('ws://') && !cleaned.startsWith('wss://')) {
    cleaned = 'ws://' + cleaned;
  }

  if (!cleaned.endsWith('/ws')) {
    cleaned = `${cleaned}/ws`;
  }
  return cleaned;
}

/**
 * Generates a synthetic 15-second 50Hz (750 samples) incident flight recorder dataset
 * modeled after the El Centro 1940 earthquake shock packet for instant replay demos.
 */
export function generateSampleIncidentBuffer(): IncidentFlightSnapshot[] {
  const snapshots: IncidentFlightSnapshot[] = [];
  const baseTime = Date.now() - 15000;
  const sampleCount = 150; // 10Hz representation for smooth scrubbing

  for (let i = 0; i < sampleCount; i++) {
    const elapsedSec = (i * 0.1);
    const phase = elapsedSec * 2.5;

    // Seismic shock envelope: ramps up at 2s, peaks around 5-9s, attenuates
    const envelope = Math.exp(-Math.pow((elapsedSec - 6.5) / 3.8, 2));
    const ax = Number(((0.58 * Math.sin(phase * 4.2) + 0.3 * Math.sin(phase * 9.5)) * envelope).toFixed(4));
    const ay = Number(((0.44 * Math.cos(phase * 3.8) + 0.25 * Math.sin(phase * 8.2)) * envelope).toFixed(4));
    const azDyn = Number(((0.38 * Math.sin(phase * 5.4)) * envelope).toFixed(4));
    const az = Number((1.0 + azDyn).toFixed(4));

    const totalAccel = calculateTotalAcceleration(ax, ay, az);
    const pga = calculatePGA(ax, ay, az);
    const mmiEval = mapPgaToMmi(pga);
    const dominantFreq = Number((2.8 + Math.sin(phase * 0.3) * 0.4).toFixed(2));
    const isSeismic = pga > 0.34;
    const isResonance = !isSeismic && pga > 0.12;

    snapshots.push({
      timestamp: baseTime + Math.round(elapsedSec * 1000),
      elapsedSec: Number(elapsedSec.toFixed(2)),
      x: ax,
      y: ay,
      z: az,
      total_g: Number(totalAccel.toFixed(4)),
      pga_g: Number(pga.toFixed(4)),
      mmi_roman: mmiEval.roman,
      hazard_level: mmiEval.hazard,
      dominant_freq_hz: dominantFreq,
      peak_magnitude: Number((0.2 + envelope * 0.95).toFixed(3)),
      drift_percent: Number(calculateResonantFrequencyDrift(dominantFreq, 4.0).toFixed(2)),
      pitch_deg: Number((envelope * 3.8 * Math.sin(phase * 2.2)).toFixed(2)),
      roll_deg: Number((envelope * 2.9 * Math.cos(phase * 1.9)).toFixed(2)),
      inference_state: isSeismic ? 'SEISMIC_EVENT' : isResonance ? 'RESONANCE_WARNING' : 'NOMINAL',
      anomaly_score: Number(Math.min(0.98, 0.08 + envelope * 0.88).toFixed(3)),
      probability: Number(Math.min(0.98, 0.12 + envelope * 0.84).toFixed(3)),
      safety_barrier_deployed: isSeismic,
      buzzer_state: isSeismic
    });
  }

  return snapshots;
}

export function useEspTelemetry({
  endpoint,
  simProfile: initialProfile = 'LIVE',
  pollIntervalMs = 150,
  nominalFreqHz = NOMINAL_BASELINE_FREQ_HZ,
  watchdogTimeoutMs = WATCHDOG_THRESHOLD_MS,
  incidentDurationMs = INCIDENT_DURATION_MS
}: UseEspTelemetryOptions): UseEspTelemetryResult {
  const [simProfile, setSimProfile] = useState<SimulationProfile>(initialProfile);
  const [telemetry, setTelemetry] = useState<EspTelemetryPayload | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  // Calibration Tare Offset
  const [tareOffset, setTareOffset] = useState<TareOffset>(getStoredTareOffset);
  const tareOffsetRef = useRef<TareOffset>(tareOffset);
  tareOffsetRef.current = tareOffset;

  // Rolling buffers: strictly last 60 samples
  const [accelBuffer, setAccelBuffer] = useState<AccelSample[]>([]);
  const [frequencyBuffer, setFrequencyBuffer] = useState<FrequencySample[]>([]);

  const [packetCount, setPacketCount] = useState<number>(0);
  const [dropCount, setDropCount] = useState<number>(0);

  // Incident Flight Recorder (15s raw snapshots upon SEISMIC_EVENT)
  const [incidentFlightRecorder, setIncidentFlightRecorder] = useState<IncidentFlightSnapshot[]>([]);
  const [isRecordingIncident, setIsRecordingIncident] = useState<boolean>(false);

  // Replay System
  const [isReplayActive, setIsReplayActive] = useState<boolean>(false);
  const [replayBuffer, setReplayBuffer] = useState<IncidentFlightSnapshot[]>([]);
  const [replayFrameIndex, setReplayFrameIndex] = useState<number>(0);
  const [isReplayPlaying, setIsReplayPlaying] = useState<boolean>(false);
  const [replaySpeed, setReplaySpeed] = useState<1 | 2>(1);

  // Internal references
  const wsRef = useRef<WebSocket | null>(null);
  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const incidentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRecordingIncidentRef = useRef<boolean>(false);
  const incidentStartTimeRef = useRef<number>(0);
  const incidentFlightRecorderRef = useRef<IncidentFlightSnapshot[]>([]);
  const accelBufferRef = useRef<AccelSample[]>([]);
  const rawTelemetryRef = useRef<EspTelemetryPayload | null>(null);
  const simPhaseRef = useRef<number>(0);

  // Keep ref copies in sync
  useEffect(() => {
    accelBufferRef.current = accelBuffer;
  }, [accelBuffer]);

  useEffect(() => {
    incidentFlightRecorderRef.current = incidentFlightRecorder;
  }, [incidentFlightRecorder]);

  // Strict Zero-Fake-Data Watchdog
  const resetWatchdog = useCallback(() => {
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
    }

    watchdogTimerRef.current = setTimeout(() => {
      setIsConnected(false);
      setConnectionStatus('DISCONNECTED');
      setLatencyMs(null);
    }, watchdogTimeoutMs);
  }, [watchdogTimeoutMs]);

  // Tare Calibration Functions
  const calibrateTare = useCallback((): TareOffset => {
    const raw = rawTelemetryRef.current;
    if (!raw) return ZERO_TARE_OFFSET;

    const newOffset: TareOffset = {
      ax: raw.imu.accel.x,
      ay: raw.imu.accel.y,
      az: Number((raw.imu.accel.z - 1.0).toFixed(4)),
      pitch: raw.imu.tilt.pitch,
      roll: raw.imu.tilt.roll
    };

    saveTareOffset(newOffset);
    setTareOffset(newOffset);
    return newOffset;
  }, []);

  const resetTare = useCallback((): void => {
    clearTareOffset();
    setTareOffset(ZERO_TARE_OFFSET);
  }, []);

  const isTared =
    tareOffset.ax !== 0 ||
    tareOffset.ay !== 0 ||
    tareOffset.az !== 0 ||
    tareOffset.pitch !== 0 ||
    tareOffset.roll !== 0;

  // Send actuator override over WebSocket
  const sendActuatorOverride = useCallback(
    (override: boolean): boolean => {
      if (simProfile !== 'LIVE') {
        setTelemetry((prev) =>
          prev
            ? {
                ...prev,
                actuator: {
                  ...prev.actuator,
                  safety_barrier_deployed: override,
                  buzzer_state: override
                }
              }
            : null
        );
        return true;
      }

      const socket = wsRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return false;
      }

      try {
        const payload = JSON.stringify({ toggle_actuator: override });
        socket.send(payload);
        return true;
      } catch {
        return false;
      }
    },
    [simProfile]
  );

  // General command sender
  const sendCommand = useCallback(
    async (path: string, body?: Record<string, unknown>): Promise<boolean> => {
      if (path.includes('barrier') || path.includes('actuator') || path.includes('buzzer')) {
        const target = Boolean(body?.deployed ?? body?.state ?? true);
        return sendActuatorOverride(target);
      }

      if (simProfile !== 'LIVE') {
        return true;
      }

      const baseUrl = endpoint.replace(/\/+$/, '');
      const fullUrl = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

      try {
        const res = await fetch(fullUrl, {
          method: body ? 'POST' : 'GET',
          headers: body ? { 'Content-Type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined,
          mode: 'cors'
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [endpoint, simProfile, sendActuatorOverride]
  );

  // Ingest incoming raw payload and apply calibration offset
  const handleIncomingPayload = useCallback(
    (rawPayload: EspTelemetryPayload, rtt: number | null) => {
      rawTelemetryRef.current = rawPayload;

      // If replay mode is active, suppress live stream updates to the main display
      if (isReplayActive) {
        return;
      }

      // Pet watchdog
      resetWatchdog();

      setIsConnected(true);
      setConnectionStatus('CONNECTED');
      if (rtt !== null) setLatencyMs(rtt);
      setPacketCount((c) => c + 1);

      // Apply Tare calibration offset
      const calibrated = applyTareOffset(
        rawPayload.imu.accel,
        rawPayload.imu.tilt,
        tareOffsetRef.current
      );

      const payload: EspTelemetryPayload = {
        ...rawPayload,
        imu: {
          accel: calibrated.accel,
          tilt: calibrated.tilt
        }
      };

      setTelemetry(payload);

      const ax = payload.imu.accel.x;
      const ay = payload.imu.accel.y;
      const az = payload.imu.accel.z;
      const totalAccel = calculateTotalAcceleration(ax, ay, az);
      const pga = calculatePGA(ax, ay, az);
      const timestamp = payload.timestamp || Date.now();

      // 1. Maintain rolling buffer for last 60 accelerometer samples
      const nextAccelSample: AccelSample = {
        timestamp,
        x: ax,
        y: ay,
        z: az,
        total: totalAccel,
        pga
      };

      setAccelBuffer((prev) => {
        const updated = [...prev, nextAccelSample];
        return updated.length > ROLLING_BUFFER_MAX_SAMPLES
          ? updated.slice(updated.length - ROLLING_BUFFER_MAX_SAMPLES)
          : updated;
      });

      // 2. Maintain rolling buffer for last 60 frequency samples
      const dominantFreq = payload.fft.dominant_freq_hz;
      const driftPercent = calculateResonantFrequencyDrift(dominantFreq, nominalFreqHz);
      const nextFreqSample: FrequencySample = {
        timestamp,
        dominant_freq_hz: dominantFreq,
        peak_magnitude: payload.fft.peak_magnitude,
        drift_percent: Number(driftPercent.toFixed(2))
      };

      setFrequencyBuffer((prev) => {
        const updated = [...prev, nextFreqSample];
        return updated.length > ROLLING_BUFFER_MAX_SAMPLES
          ? updated.slice(updated.length - ROLLING_BUFFER_MAX_SAMPLES)
          : updated;
      });

      // 3. Incident Trigger Buffer Management:
      const isSeismicEvent = payload.inference.state === 'SEISMIC_EVENT';

      if (isSeismicEvent && !isRecordingIncidentRef.current) {
        isRecordingIncidentRef.current = true;
        incidentStartTimeRef.current = Date.now();
        setIsRecordingIncident(true);
        setIncidentFlightRecorder([]);

        if (incidentTimerRef.current) clearTimeout(incidentTimerRef.current);
        incidentTimerRef.current = setTimeout(() => {
          isRecordingIncidentRef.current = false;
          setIsRecordingIncident(false);
        }, incidentDurationMs);
      }

      if (isRecordingIncidentRef.current) {
        const elapsedSec = (Date.now() - incidentStartTimeRef.current) / 1000;
        const mmiEval = mapPgaToMmi(pga);

        const snapshot: IncidentFlightSnapshot = {
          timestamp,
          elapsedSec: Number(elapsedSec.toFixed(3)),
          x: ax,
          y: ay,
          z: az,
          total_g: Number(totalAccel.toFixed(4)),
          pga_g: Number(pga.toFixed(4)),
          mmi_roman: mmiEval.roman,
          hazard_level: mmiEval.hazard,
          dominant_freq_hz: dominantFreq,
          peak_magnitude: payload.fft.peak_magnitude,
          drift_percent: Number(driftPercent.toFixed(2)),
          pitch_deg: payload.imu.tilt.pitch,
          roll_deg: payload.imu.tilt.roll,
          inference_state: payload.inference.state,
          anomaly_score: payload.inference.anomaly_score,
          probability: payload.inference.probability,
          safety_barrier_deployed: payload.actuator.safety_barrier_deployed,
          buzzer_state: payload.actuator.buzzer_state
        };

        setIncidentFlightRecorder((prev) => [...prev, snapshot]);
      }
    },
    [incidentDurationMs, isReplayActive, nominalFreqHz, resetWatchdog]
  );

  // CSV Export utility
  const exportIncidentCSV = useCallback(
    (overrideBuffer?: IncidentFlightSnapshot[]): boolean => {
      const snapshots = overrideBuffer || incidentFlightRecorderRef.current;
      const accelHistory = accelBufferRef.current;

      if (snapshots.length === 0 && accelHistory.length === 0) {
        return false;
      }

      const rows: string[] = [];
      rows.push('# AEGIS-SHM SEISMOGRAM FLIGHT RECORDER EXPORT');
      rows.push(`# Export Timestamp: ${new Date().toISOString()}`);
      rows.push(`# Baseline Frequency f0: ${nominalFreqHz} Hz`);
      rows.push(`# Trigger State: ${snapshots.length > 0 ? 'SEISMIC_EVENT' : 'MANUAL_TRACE'}`);
      rows.push(`# Recorded Samples: ${snapshots.length > 0 ? snapshots.length : accelHistory.length}`);
      rows.push(
        'Timestamp_ms,Elapsed_s,Accel_X_g,Accel_Y_g,Accel_Z_g,Total_g,PGA_g,MMI_Scale,Hazard_Level,Dominant_Freq_Hz,Freq_Drift_Pct,Pitch_deg,Roll_deg,Inference_State,Anomaly_Score,Safety_Barrier_Deployed,Buzzer_Active'
      );

      if (snapshots.length > 0) {
        for (const s of snapshots) {
          rows.push(
            [
              s.timestamp,
              s.elapsedSec,
              s.x.toFixed(4),
              s.y.toFixed(4),
              s.z.toFixed(4),
              s.total_g.toFixed(4),
              s.pga_g.toFixed(4),
              s.mmi_roman,
              s.hazard_level,
              s.dominant_freq_hz.toFixed(2),
              s.drift_percent.toFixed(2),
              s.pitch_deg.toFixed(2),
              s.roll_deg.toFixed(2),
              s.inference_state,
              s.anomaly_score.toFixed(3),
              s.safety_barrier_deployed ? 1 : 0,
              s.buzzer_state ? 1 : 0
            ].join(',')
          );
        }
      } else {
        const baseTime = accelHistory[0]?.timestamp || Date.now();
        for (const a of accelHistory) {
          const elapsed = ((a.timestamp - baseTime) / 1000).toFixed(3);
          const pgaVal = a.pga ?? calculatePGA(a.x, a.y, a.z);
          const mmi = mapPgaToMmi(pgaVal);
          rows.push(
            [
              a.timestamp,
              elapsed,
              a.x.toFixed(4),
              a.y.toFixed(4),
              a.z.toFixed(4),
              a.total.toFixed(4),
              pgaVal.toFixed(4),
              mmi.roman,
              mmi.hazard,
              telemetry?.fft.dominant_freq_hz ?? 0,
              calculateResonantFrequencyDrift(telemetry?.fft.dominant_freq_hz ?? 0, nominalFreqHz).toFixed(2),
              telemetry?.imu.tilt.pitch ?? 0,
              telemetry?.imu.tilt.roll ?? 0,
              telemetry?.inference.state ?? 'NOMINAL',
              telemetry?.inference.anomaly_score ?? 0,
              telemetry?.actuator.safety_barrier_deployed ? 1 : 0,
              telemetry?.actuator.buzzer_state ? 1 : 0
            ].join(',')
          );
        }
      }

      const csvContent = rows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
      link.href = url;
      link.setAttribute('download', `earthquake_seismogram_${timestampStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return true;
    },
    [nominalFreqHz, telemetry]
  );

  // Simulation Vector Profiles Generator
  useEffect(() => {
    let isMounted = true;
    let simIntervalId: ReturnType<typeof setInterval> | null = null;
    let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;

    if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // 1. Simulation Profiles Execution
    if (simProfile !== 'LIVE') {
      setConnectionStatus('CONNECTED');
      setIsConnected(true);

      simIntervalId = setInterval(() => {
        if (!isMounted) return;

        simPhaseRef.current += 0.2;
        const phase = simPhaseRef.current;
        let payload: EspTelemetryPayload;

        if (simProfile === 'RESONANCE_SWEEP') {
          // 2. RESONANCE HARMONIC SWEEP: 3.2 Hz resonant buildup, inducing dynamic magnification spike
          const buildup = 0.25 + 0.65 * (0.5 + 0.5 * Math.sin(phase * 0.12));
          const dominantFreq = 3.20;
          const ax = Number((buildup * Math.sin(phase * 3.2 * 2 * Math.PI)).toFixed(3));
          const ay = Number((buildup * 0.6 * Math.cos(phase * 3.2 * 2 * Math.PI)).toFixed(3));
          const az = Number((1.0 + buildup * 0.45 * Math.sin(phase * 2.8)).toFixed(3));
          const peakMag = Number((buildup * 1.15).toFixed(3));
          const score = Number(Math.min(0.69, 0.42 + buildup * 0.26).toFixed(2));

          payload = {
            connected: true,
            timestamp: Date.now(),
            imu: {
              accel: { x: ax, y: ay, z: az },
              tilt: {
                pitch: Number((buildup * 2.6 * Math.sin(phase * 0.8)).toFixed(1)),
                roll: Number((buildup * 1.8 * Math.cos(phase * 0.8)).toFixed(1))
              }
            },
            fft: { dominant_freq_hz: dominantFreq, peak_magnitude: peakMag },
            inference: {
              anomaly_score: score,
              state: 'RESONANCE_WARNING',
              probability: score,
              inference_latency_ms: 12
            },
            actuator: {
              safety_barrier_deployed: false,
              buzzer_state: false
            }
          };
        } else if (simProfile === 'EL_CENTRO_1940') {
          // 3. EL CENTRO 1940 EARTHQUAKE: High dynamic PGA waveform with MMI VIII+ trigger
          const shock = 0.75 + 0.25 * Math.sin(phase * 0.4);
          const ax = Number(((0.55 * Math.sin(phase * 4.8) + 0.28 * Math.sin(phase * 11.2)) * shock).toFixed(3));
          const ay = Number(((0.45 * Math.cos(phase * 4.1) + 0.22 * Math.sin(phase * 8.7)) * shock).toFixed(3));
          const az = Number((1.0 + (0.42 * Math.sin(phase * 6.3) * shock)).toFixed(3));
          const dominantFreq = 2.45;
          const peakMag = 1.25;
          const score = 0.94;

          payload = {
            connected: true,
            timestamp: Date.now(),
            imu: {
              accel: { x: ax, y: ay, z: az },
              tilt: {
                pitch: Number((4.5 * Math.sin(phase * 2.1) * shock).toFixed(1)),
                roll: Number((3.6 * Math.cos(phase * 1.8) * shock).toFixed(1))
              }
            },
            fft: { dominant_freq_hz: dominantFreq, peak_magnitude: peakMag },
            inference: {
              anomaly_score: score,
              state: 'SEISMIC_EVENT',
              probability: score,
              inference_latency_ms: 15
            },
            actuator: {
              safety_barrier_deployed: true,
              buzzer_state: true
            }
          };
        } else if (simProfile === 'STIFFNESS_DRIFT') {
          // 4. STRUCTURAL FATIGUE / STIFFNESS DRIFT: Natural freq drops from 4.0 Hz down to 2.8 Hz (> 25% negative drift)
          const progress = (Math.sin(phase * 0.08) + 1) / 2; // oscillates 0 to 1
          const dominantFreq = Number((4.0 - 1.2 * progress).toFixed(2)); // 4.0 Hz down to 2.80 Hz (-30% drift)
          const ax = Number((0.24 * Math.sin(phase * dominantFreq * 2 * Math.PI)).toFixed(3));
          const ay = Number((0.18 * Math.cos(phase * dominantFreq * 2 * Math.PI)).toFixed(3));
          const az = Number((1.0 + 0.12 * Math.sin(phase * 2.5)).toFixed(3));
          const score = Number((0.44 + 0.24 * progress).toFixed(2));

          payload = {
            connected: true,
            timestamp: Date.now(),
            imu: {
              accel: { x: ax, y: ay, z: az },
              tilt: {
                pitch: Number((0.8 + 0.6 * Math.sin(phase * 0.4)).toFixed(1)),
                roll: Number((-0.5 + 0.4 * Math.cos(phase * 0.4)).toFixed(1))
              }
            },
            fft: { dominant_freq_hz: dominantFreq, peak_magnitude: 0.58 },
            inference: {
              anomaly_score: score,
              state: 'RESONANCE_WARNING',
              probability: score,
              inference_latency_ms: 13
            },
            actuator: {
              safety_barrier_deployed: false,
              buzzer_state: false
            }
          };
        } else {
          // 5. STATIC FOUNDATION SETTLEMENT: Permanent 8-degree pitch tilt without vibration
          const pitch = 8.2;
          const roll = 2.4;
          // Static gravity component projection on tilted axes
          const ax = Number((Math.sin((pitch * Math.PI) / 180) + (Math.random() - 0.5) * 0.01).toFixed(3));
          const ay = Number((Math.sin((roll * Math.PI) / 180) + (Math.random() - 0.5) * 0.01).toFixed(3));
          const az = Number((Math.cos((pitch * Math.PI) / 180) + (Math.random() - 0.5) * 0.01).toFixed(3));

          payload = {
            connected: true,
            timestamp: Date.now(),
            imu: {
              accel: { x: ax, y: ay, z: az },
              tilt: { pitch, roll }
            },
            fft: { dominant_freq_hz: 4.0, peak_magnitude: 0.04 },
            inference: {
              anomaly_score: 0.15,
              state: 'NOMINAL',
              probability: 0.15,
              inference_latency_ms: 11
            },
            actuator: {
              safety_barrier_deployed: false,
              buzzer_state: false
            }
          };
        }

        handleIncomingPayload(payload, 4);
      }, pollIntervalMs);

      return () => {
        isMounted = false;
        if (simIntervalId) clearInterval(simIntervalId);
        if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
      };
    }

    // 2. LIVE ESP32 FEED Execution
    if (!endpoint) {
      setIsConnected(false);
      setConnectionStatus('DISCONNECTED');
      setTelemetry(null);
      setLatencyMs(null);
      return;
    }

    const wsUrl = normalizeWsEndpoint(endpoint);
    let socket: WebSocket | null = null;

    const connectWs = () => {
      if (!isMounted) return;
      setConnectionStatus('RECONNECTING');

      try {
        socket = new WebSocket(wsUrl);
        wsRef.current = socket;
        let lastMessageTimestamp = performance.now();

        socket.onopen = () => {
          if (!isMounted) return;
          setConnectionStatus('CONNECTED');
          setIsConnected(true);
          resetWatchdog();
        };

        socket.onmessage = (event: MessageEvent) => {
          if (!isMounted) return;
          const now = performance.now();
          const rtt = Math.round(now - lastMessageTimestamp);
          lastMessageTimestamp = now;

          try {
            const parsed = JSON.parse(event.data) as EspTelemetryPayload;
            handleIncomingPayload(parsed, rtt > 0 && rtt < 2000 ? rtt : null);
          } catch {
            setDropCount((c) => c + 1);
          }
        };

        socket.onerror = () => {
          if (!isMounted) return;
          setDropCount((c) => c + 1);
        };

        socket.onclose = () => {
          if (!isMounted) return;
          setIsConnected(false);
          setConnectionStatus('RECONNECTING');
          if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
          reconnectTimeoutId = setTimeout(connectWs, 2000);
        };
      } catch {
        if (!isMounted) return;
        setIsConnected(false);
        setConnectionStatus('DISCONNECTED');
        reconnectTimeoutId = setTimeout(connectWs, 3000);
      }
    };

    connectWs();

    return () => {
      isMounted = false;
      if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
      if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
      if (incidentTimerRef.current) clearTimeout(incidentTimerRef.current);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      wsRef.current = null;
    };
  }, [endpoint, handleIncomingPayload, pollIntervalMs, resetWatchdog, simProfile]);

  // Replay Controller
  const openReplay = useCallback(
    (buffer?: IncidentFlightSnapshot[]) => {
      const activeData =
        buffer && buffer.length > 0
          ? buffer
          : incidentFlightRecorderRef.current.length > 0
          ? incidentFlightRecorderRef.current
          : generateSampleIncidentBuffer();

      setReplayBuffer(activeData);
      setReplayFrameIndex(0);
      setIsReplayPlaying(true);
      setIsReplayActive(true);
    },
    []
  );

  const closeReplay = useCallback(() => {
    setIsReplayActive(false);
    setIsReplayPlaying(false);
  }, []);

  const stepReplay = useCallback(
    (delta: number) => {
      if (replayBuffer.length === 0) return;
      setReplayFrameIndex((prev) => {
        const next = prev + delta;
        return Math.max(0, Math.min(replayBuffer.length - 1, next));
      });
    },
    [replayBuffer.length]
  );

  // Replay playback timer
  useEffect(() => {
    if (!isReplayActive || !isReplayPlaying || replayBuffer.length === 0) return;

    const intervalMs = Math.round(100 / replaySpeed);
    const timer = setInterval(() => {
      setReplayFrameIndex((prev) => {
        if (prev >= replayBuffer.length - 1) {
          setIsReplayPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isReplayActive, isReplayPlaying, replayBuffer.length, replaySpeed]);

  // Push active replay frame into telemetry state and rolling buffer
  useEffect(() => {
    if (!isReplayActive || replayBuffer.length === 0) return;

    const frame = replayBuffer[replayFrameIndex];
    if (!frame) return;

    const replayPayload: EspTelemetryPayload = {
      connected: true,
      timestamp: frame.timestamp,
      imu: {
        accel: { x: frame.x, y: frame.y, z: frame.z },
        tilt: { pitch: frame.pitch_deg, roll: frame.roll_deg }
      },
      fft: {
        dominant_freq_hz: frame.dominant_freq_hz,
        peak_magnitude: frame.peak_magnitude
      },
      inference: {
        anomaly_score: frame.anomaly_score,
        state: frame.inference_state,
        probability: frame.probability,
        inference_latency_ms: 12
      },
      actuator: {
        safety_barrier_deployed: frame.safety_barrier_deployed,
        buzzer_state: frame.buzzer_state
      }
    };

    setTelemetry(replayPayload);
    setIsConnected(true);
    setConnectionStatus('CONNECTED');

    // Feed oscilloscope rolling buffer during replay
    setAccelBuffer((prev) => {
      const next: AccelSample = {
        timestamp: frame.timestamp,
        x: frame.x,
        y: frame.y,
        z: frame.z,
        total: frame.total_g,
        pga: frame.pga_g
      };
      const updated = [...prev, next];
      return updated.length > ROLLING_BUFFER_MAX_SAMPLES
        ? updated.slice(updated.length - ROLLING_BUFFER_MAX_SAMPLES)
        : updated;
    });
  }, [isReplayActive, replayBuffer, replayFrameIndex]);

  return {
    telemetry,
    isConnected,
    connectionStatus,
    latencyMs,
    history: accelBuffer,
    accelBuffer,
    frequencyBuffer,
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
  };
}
