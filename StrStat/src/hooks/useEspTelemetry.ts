import { useState, useEffect, useRef, useCallback } from 'react';
import {
  EspTelemetryPayload,
  AccelSample,
  FrequencySample,
  IncidentFlightSnapshot,
  ConnectionStatus
} from '../types';
import {
  calculatePGA,
  calculateTotalAcceleration,
  mapPgaToMmi,
  calculateResonantFrequencyDrift,
  NOMINAL_BASELINE_FREQ_HZ
} from '../utils/structuralMath';

export interface UseEspTelemetryOptions {
  endpoint: string;
  mockEnabled?: boolean;
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
  exportIncidentCSV: () => boolean;
  sendActuatorOverride: (override: boolean) => boolean;
  sendCommand: (path: string, body?: Record<string, unknown>) => Promise<boolean>;
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

export function useEspTelemetry({
  endpoint,
  mockEnabled = false,
  pollIntervalMs = 150,
  nominalFreqHz = NOMINAL_BASELINE_FREQ_HZ,
  watchdogTimeoutMs = WATCHDOG_THRESHOLD_MS,
  incidentDurationMs = INCIDENT_DURATION_MS
}: UseEspTelemetryOptions): UseEspTelemetryResult {
  const [telemetry, setTelemetry] = useState<EspTelemetryPayload | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  // Rolling buffers: strictly last 60 samples for tabular-nums acceleration & frequency streams
  const [accelBuffer, setAccelBuffer] = useState<AccelSample[]>([]);
  const [frequencyBuffer, setFrequencyBuffer] = useState<FrequencySample[]>([]);

  const [packetCount, setPacketCount] = useState<number>(0);
  const [dropCount, setDropCount] = useState<number>(0);

  // Incident Flight Recorder (15s raw snapshots upon SEISMIC_EVENT)
  const [incidentFlightRecorder, setIncidentFlightRecorder] = useState<IncidentFlightSnapshot[]>([]);
  const [isRecordingIncident, setIsRecordingIncident] = useState<boolean>(false);

  // Internal references
  const wsRef = useRef<WebSocket | null>(null);
  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const incidentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRecordingIncidentRef = useRef<boolean>(false);
  const incidentStartTimeRef = useRef<number>(0);
  const incidentFlightRecorderRef = useRef<IncidentFlightSnapshot[]>([]);
  const accelBufferRef = useRef<AccelSample[]>([]);
  const frequencyBufferRef = useRef<FrequencySample[]>([]);
  const mockPhaseRef = useRef<number>(0);

  // Keep ref copies in sync
  useEffect(() => {
    accelBufferRef.current = accelBuffer;
  }, [accelBuffer]);

  useEffect(() => {
    frequencyBufferRef.current = frequencyBuffer;
  }, [frequencyBuffer]);

  useEffect(() => {
    incidentFlightRecorderRef.current = incidentFlightRecorder;
  }, [incidentFlightRecorder]);

  // Strict Zero-Fake-Data Watchdog: If no packet arrives for > 1500ms, pause immediately
  const resetWatchdog = useCallback(() => {
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
    }

    watchdogTimerRef.current = setTimeout(() => {
      // Zero-Fake-Data enforcement:
      // Mark disconnected and halt chart streams immediately
      setIsConnected(false);
      setConnectionStatus('DISCONNECTED');
      setLatencyMs(null);
    }, watchdogTimeoutMs);
  }, [watchdogTimeoutMs]);

  // Send actuator override { toggle_actuator: boolean } over WebSocket
  const sendActuatorOverride = useCallback(
    (override: boolean): boolean => {
      if (mockEnabled) {
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
    [mockEnabled]
  );

  // General command sender with backward compatibility
  const sendCommand = useCallback(
    async (path: string, body?: Record<string, unknown>): Promise<boolean> => {
      if (path.includes('barrier') || path.includes('actuator') || path.includes('buzzer')) {
        const target = Boolean(body?.deployed ?? body?.state ?? true);
        return sendActuatorOverride(target);
      }

      if (mockEnabled) {
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
    [endpoint, mockEnabled, sendActuatorOverride]
  );

  // Ingest incoming raw payload
  const handleIncomingPayload = useCallback(
    (payload: EspTelemetryPayload, rtt: number | null) => {
      // Pet watchdog
      resetWatchdog();

      setIsConnected(true);
      setConnectionStatus('CONNECTED');
      if (rtt !== null) setLatencyMs(rtt);
      setTelemetry(payload);
      setPacketCount((c) => c + 1);

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
      // When inference.state === "SEISMIC_EVENT", automatically buffer 15 seconds of raw data
      const isSeismicEvent = payload.inference.state === 'SEISMIC_EVENT';

      if (isSeismicEvent && !isRecordingIncidentRef.current) {
        // Trigger 15-second incident flight recorder window
        isRecordingIncidentRef.current = true;
        incidentStartTimeRef.current = Date.now();
        setIsRecordingIncident(true);
        setIncidentFlightRecorder([]); // reset for new incident

        if (incidentTimerRef.current) clearTimeout(incidentTimerRef.current);
        incidentTimerRef.current = setTimeout(() => {
          isRecordingIncidentRef.current = false;
          setIsRecordingIncident(false);
        }, incidentDurationMs);
      }

      // If flight recorder is active within the 15-second duration, record snapshot
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
    [incidentDurationMs, nominalFreqHz, resetWatchdog]
  );

  // Utility to export recorded incident or seismogram data as CSV
  const exportIncidentCSV = useCallback((): boolean => {
    const snapshots = incidentFlightRecorderRef.current;
    const accelHistory = accelBufferRef.current;

    if (snapshots.length === 0 && accelHistory.length === 0) {
      return false;
    }

    const rows: string[] = [];

    // Seismogram metadata header
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
      // Export current rolling buffer if no incident trigger occurred
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
  }, [nominalFreqHz, telemetry]);

  // WebSocket Connection Lifecycle & Mock Generator
  useEffect(() => {
    let isMounted = true;
    let mockIntervalId: ReturnType<typeof setInterval> | null = null;
    let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;

    if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Mock Mode Execution (Dev testing only)
    if (mockEnabled) {
      setConnectionStatus('CONNECTED');
      setIsConnected(true);

      mockIntervalId = setInterval(() => {
        if (!isMounted) return;
        mockPhaseRef.current += 0.2;
        const phase = mockPhaseRef.current;
        const dominantFreq = 3.2 + Math.sin(phase * 0.1) * 0.6;
        const isResonant = Math.abs(dominantFreq - 3.2) < 0.3;
        const anomaly = isResonant ? 0.65 : 0.08;

        const mockPayload: EspTelemetryPayload = {
          connected: true,
          timestamp: Date.now(),
          imu: {
            accel: {
              x: Number((Math.sin(phase * dominantFreq) * (isResonant ? 0.8 : 0.08)).toFixed(3)),
              y: Number((Math.cos(phase * dominantFreq) * (isResonant ? 0.5 : 0.05)).toFixed(3)),
              z: Number((0.98 + (isResonant ? Math.sin(phase * 2) * 0.3 : 0.02)).toFixed(3))
            },
            tilt: {
              pitch: Number((1.2 + Math.sin(phase * 0.5) * 0.8).toFixed(1)),
              roll: Number((-0.4 + Math.cos(phase * 0.5) * 0.6).toFixed(1))
            }
          },
          fft: {
            dominant_freq_hz: Number(dominantFreq.toFixed(2)),
            peak_magnitude: Number((isResonant ? 0.75 : 0.14).toFixed(2))
          },
          inference: {
            anomaly_score: Number(anomaly.toFixed(2)),
            state: isResonant ? 'RESONANCE_WARNING' : 'NOMINAL',
            probability: Number(anomaly.toFixed(2)),
            inference_latency_ms: 14
          },
          actuator: {
            safety_barrier_deployed: isResonant,
            buzzer_state: isResonant
          }
        };

        handleIncomingPayload(mockPayload, 6);
      }, pollIntervalMs);

      return () => {
        isMounted = false;
        if (mockIntervalId) clearInterval(mockIntervalId);
        if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
      };
    }

    // Real Hardware Connection
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

          // Retry connection after 2 seconds
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
  }, [endpoint, handleIncomingPayload, mockEnabled, pollIntervalMs, resetWatchdog]);

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
    exportIncidentCSV,
    sendActuatorOverride,
    sendCommand
  };
}
