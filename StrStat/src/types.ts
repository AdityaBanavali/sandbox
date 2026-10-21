export type InferenceState = 'NOMINAL' | 'RESONANCE_WARNING' | 'SEISMIC_EVENT';

export interface ImuData {
  accel: {
    x: number;
    y: number;
    z: number;
  };
  tilt: {
    pitch: number;
    roll: number;
  };
}

export interface FftData {
  dominant_freq_hz: number;
  peak_magnitude: number;
}

export interface InferenceData {
  anomaly_score: number;
  state: InferenceState;
  probability: number;
  inference_latency_ms: number;
}

export interface ActuatorData {
  safety_barrier_deployed: boolean;
  buzzer_state: boolean;
}

export interface EspTelemetryPayload {
  connected: boolean;
  timestamp: number;
  imu: ImuData;
  fft: FftData;
  inference: InferenceData;
  actuator: ActuatorData;
}

export interface AccelSample {
  timestamp: number;
  x: number;
  y: number;
  z: number;
  total: number;
  pga?: number;
}

export interface FrequencySample {
  timestamp: number;
  dominant_freq_hz: number;
  peak_magnitude: number;
  drift_percent: number;
}

export interface IncidentFlightSnapshot {
  timestamp: number;
  elapsedSec: number;
  x: number;
  y: number;
  z: number;
  total_g: number;
  pga_g: number;
  mmi_roman: string;
  hazard_level: string;
  dominant_freq_hz: number;
  peak_magnitude: number;
  drift_percent: number;
  pitch_deg: number;
  roll_deg: number;
  inference_state: InferenceState;
  anomaly_score: number;
  probability: number;
  safety_barrier_deployed: boolean;
  buzzer_state: boolean;
}

export interface EventLogItem {
  id: string;
  timestamp: string;
  type: 'INFO' | 'WARN' | 'CRITICAL' | 'COMMAND';
  message: string;
}

export type ConnectionStatus = 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED';

