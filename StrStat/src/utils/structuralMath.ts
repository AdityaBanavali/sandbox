import { DriftEvaluation, TareOffset } from '../types';
export type { DriftEvaluation, TareOffset };

/**
 * Structural Engineering Mathematics & Earthquake Accelerometer Dynamics
 * 
 * Provides:
 * 1. Peak Ground Acceleration (PGA) calculation with gravity compensation (g).
 * 2. Modified Mercalli Intensity (MMI) scale mapping (Roman numerals I-X) & hazard classifications.
 * 3. Structural resonant frequency drift calculation against baseline f0 = 4.0 Hz.
 * 4. Inter-story drift ratio & IS 1893:2016 / ASCE 7 seismic compliance threshold.
 * 5. IMU Tare / Sensor Zeroing baseline calibration offset management.
 */

export type MmiRoman = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VII' | 'VIII' | 'IX' | 'X';

export interface MmiEvaluation {
  roman: MmiRoman;
  intensity: number; // 1 - 10
  hazard: 'Imperceptible' | 'Weak' | 'Light' | 'Moderate' | 'Strong' | 'Very Strong' | 'Severe' | 'Violent' | 'Extreme';
  description: string;
  pgaG: number;
}

export interface FrequencyDriftEvaluation {
  currentFreqHz: number;
  nominalBaselineHz: number;
  driftHz: number;
  driftPercent: number;
  isResonantHazard: boolean;
}

/** Nominal baseline natural frequency for structure (Hz) */
export const NOMINAL_BASELINE_FREQ_HZ = 4.0;

/**
 * Calculates Peak Ground Acceleration (PGA) in g:
 * Formula: sqrt(ax^2 + ay^2 + az^2) - 1.0
 * 
 * Gravity baseline (1.0g) is subtracted from the 3-axis acceleration magnitude
 * to isolate dynamic structural / ground vibration.
 *
 * @param ax Acceleration along X-axis in g
 * @param ay Acceleration along Y-axis in g
 * @param az Acceleration along Z-axis in g
 * @param clampZero If true (default), returns 0 when total vector magnitude <= 1.0g
 * @returns PGA in units of g
 */
export function calculatePGA(
  ax: number,
  ay: number,
  az: number,
  clampZero: boolean = true
): number {
  const norm = Math.sqrt(ax * ax + ay * ay + az * az);
  const pga = norm - 1.0;
  return clampZero ? Math.max(0, pga) : pga;
}

/**
 * Calculates dynamic / AC acceleration along the Z-axis by subtracting 1.0g static Earth gravity datum.
 * Formula: az - 1.0
 */
export function calculateDynamicZ(az: number): number {
  return az - 1.0;
}

/**
 * Calculates raw vector magnitude sqrt(ax^2 + ay^2 + az^2)
 */
export function calculateTotalAcceleration(ax: number, ay: number, az: number): number {
  return Math.sqrt(ax * ax + ay * ay + az * az);
}

/**
 * Maps Peak Ground Acceleration (PGA in g) to the Modified Mercalli Intensity (MMI)
 * scale (Roman numerals I through X) and standard seismic hazard classifications.
 * 
 * USGS / ShakeMap Instrumental Intensity Standard:
 * - MMI I:   PGA < 0.0017 g  (Imperceptible)
 * - MMI II:  PGA 0.0017 - 0.005 g (Weak)
 * - MMI III: PGA 0.005 - 0.014 g  (Weak)
 * - MMI IV:  PGA 0.014 - 0.039 g  (Light)
 * - MMI V:   PGA 0.039 - 0.092 g  (Moderate)
 * - MMI VI:  PGA 0.092 - 0.18 g   (Strong)
 * - MMI VII: PGA 0.18 - 0.34 g    (Very Strong)
 * - MMI VIII:PGA 0.34 - 0.65 g    (Severe)
 * - MMI IX:  PGA 0.65 - 1.24 g    (Violent)
 * - MMI X:   PGA >= 1.24 g        (Extreme)
 * 
 * @param pga Peak ground acceleration in g
 * @returns MmiEvaluation
 */
export function mapPgaToMmi(pga: number): MmiEvaluation {
  const safePga = Math.max(0, pga);

  if (safePga < 0.0017) {
    return {
      roman: 'I',
      intensity: 1,
      hazard: 'Imperceptible',
      description: 'Not felt except by very few under especially favorable conditions.',
      pgaG: safePga
    };
  }

  if (safePga < 0.005) {
    return {
      roman: 'II',
      intensity: 2,
      hazard: 'Weak',
      description: 'Felt only by a few persons at rest, especially on upper floors of buildings.',
      pgaG: safePga
    };
  }

  if (safePga < 0.014) {
    return {
      roman: 'III',
      intensity: 3,
      hazard: 'Weak',
      description: 'Felt noticeably indoors, especially on upper floors. Hanging objects swing.',
      pgaG: safePga
    };
  }

  if (safePga < 0.039) {
    return {
      roman: 'IV',
      intensity: 4,
      hazard: 'Light',
      description: 'Felt indoors by many. Dishes, windows, doors disturbed; walls make cracking sound.',
      pgaG: safePga
    };
  }

  if (safePga < 0.092) {
    return {
      roman: 'V',
      intensity: 5,
      hazard: 'Moderate',
      description: 'Felt by nearly everyone; some dishes and windows broken; unstable objects overturned.',
      pgaG: safePga
    };
  }

  if (safePga < 0.18) {
    return {
      roman: 'VI',
      intensity: 6,
      hazard: 'Strong',
      description: 'Felt by all. Some heavy furniture moved; a few instances of fallen plaster; slight damage.',
      pgaG: safePga
    };
  }

  if (safePga < 0.34) {
    return {
      roman: 'VII',
      intensity: 7,
      hazard: 'Very Strong',
      description: 'Damage negligible in buildings of good design and construction; slight to moderate in ordinary structures.',
      pgaG: safePga
    };
  }

  if (safePga < 0.65) {
    return {
      roman: 'VIII',
      intensity: 8,
      hazard: 'Severe',
      description: 'Damage slight in specially designed structures; considerable in ordinary substantial buildings with partial collapse.',
      pgaG: safePga
    };
  }

  if (safePga < 1.24) {
    return {
      roman: 'IX',
      intensity: 9,
      hazard: 'Violent',
      description: 'Damage considerable in specially designed structures; buildings shifted off foundations; ground cracked conspicuously.',
      pgaG: safePga
    };
  }

  return {
    roman: 'X',
    intensity: 10,
    hazard: 'Extreme',
    description: 'Some well-built wooden structures destroyed; most masonry and frame structures destroyed with foundations; rails bent.',
    pgaG: safePga
  };
}

/**
 * Resonant frequency drift calculation:
 * Computes the percentage shift of the current dominant frequency relative to
 * a baseline nominal frequency (f0 = 4.0 Hz).
 * 
 * Formula: ((currentFreq - baselineFreq) / baselineFreq) * 100
 * 
 * @param currentFreq Current dominant frequency in Hz
 * @param baselineFreq Nominal baseline frequency in Hz (defaults to 4.0 Hz)
 * @returns Percentage shift (%)
 */
export function calculateResonantFrequencyDrift(
  currentFreq: number,
  baselineFreq: number = NOMINAL_BASELINE_FREQ_HZ
): number {
  if (baselineFreq === 0) return 0;
  return ((currentFreq - baselineFreq) / baselineFreq) * 100;
}

/**
 * Detailed evaluation of resonant frequency shift.
 * 
 * @param currentFreq Current dominant frequency in Hz
 * @param baselineFreq Nominal baseline frequency in Hz (defaults to 4.0 Hz)
 * @param dangerThresholdPercent Drift threshold to consider hazardous (default 15%)
 */
export function evaluateResonantFrequencyDrift(
  currentFreq: number,
  baselineFreq: number = NOMINAL_BASELINE_FREQ_HZ,
  dangerThresholdPercent: number = 15.0
): FrequencyDriftEvaluation {
  const driftHz = currentFreq - baselineFreq;
  const driftPercent = calculateResonantFrequencyDrift(currentFreq, baselineFreq);
  const isResonantHazard = Math.abs(driftPercent) >= dangerThresholdPercent;

  return {
    currentFreqHz: currentFreq,
    nominalBaselineHz: baselineFreq,
    driftHz,
    driftPercent,
    isResonantHazard
  };
}

// Case aliases for developer flexibility
export const calculatePga = calculatePGA;
export const mapPGAToMMI = mapPgaToMmi;

/** Default story height for scale model tower in mm (h = 400 mm) */
export const DEFAULT_STORY_HEIGHT_MM = 400;

/** IS 1893:2016 / ASCE 7 maximum allowable elastic drift ratio threshold (0.004 = 0.4%) */
export const IS1893_DRIFT_THRESHOLD = 0.004;

/**
 * Calculates structural lateral displacement and inter-story drift ratio:
 * Formula: drift_ratio = max_sway_displacement_mm / story_height_mm
 * 
 * Lateral displacement combines dynamic inertial displacement:
 *   disp_dyn = (PGA * 9810 mm/s²) / (2π * max(f, 0.5))²
 * and static/kinematic tilt displacement:
 *   disp_tilt = story_height_mm * sin(theta_rad)
 *
 * Evaluated against IS 1893:2016:
 * - If drift_ratio < 0.004: PASS (Elastic Drift Nominal)
 * - If drift_ratio >= 0.004: CRITICAL EXCURSION (Inelastic Drift Exceeded)
 */
export function calculateInterStoryDrift(
  pgaG: number,
  dominantFreqHz: number = 3.2,
  pitchDeg: number = 0,
  rollDeg: number = 0,
  storyHeightMm: number = DEFAULT_STORY_HEIGHT_MM
): DriftEvaluation {
  const safeFreq = Math.max(0.5, dominantFreqHz || 3.2);
  const omega = 2 * Math.PI * safeFreq;
  // Inertial dynamic sway amplitude in mm: (a * g) / omega^2, where 1g = 9810 mm/s^2
  const dynamicDispMm = (Math.max(0, pgaG) * 9810) / (omega * omega);

  // Geometric tilt sway displacement in mm
  const tiltTotalDeg = Math.sqrt(pitchDeg * pitchDeg + rollDeg * rollDeg);
  const tiltRad = (tiltTotalDeg * Math.PI) / 180;
  const tiltDispMm = storyHeightMm * Math.sin(tiltRad);

  const totalDisplacementMm = dynamicDispMm + tiltDispMm;
  const driftRatio = totalDisplacementMm / storyHeightMm;
  const isPass = driftRatio < IS1893_DRIFT_THRESHOLD;

  return {
    displacementMm: totalDisplacementMm,
    storyHeightMm,
    driftRatio,
    isPass,
    statusText: isPass ? 'PASS (Elastic Drift Nominal)' : 'CRITICAL EXCURSION (Inelastic Drift Exceeded)',
    badgeText: isPass ? 'IS 1893: PASS (Elastic Drift Nominal)' : 'IS 1893: CRITICAL EXCURSION (Inelastic Drift Exceeded)'
  };
}

/** LocalStorage key for storing IMU Tare / Zeroing baseline */
export const STORAGE_KEY_TARE = 'aegis_imu_tare_offset';

export const ZERO_TARE_OFFSET: TareOffset = {
  ax: 0,
  ay: 0,
  az: 0,
  pitch: 0,
  roll: 0
};

export function getStoredTareOffset(): TareOffset {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TARE);
    if (!raw) return ZERO_TARE_OFFSET;
    const parsed = JSON.parse(raw);
    return {
      ax: typeof parsed.ax === 'number' ? parsed.ax : 0,
      ay: typeof parsed.ay === 'number' ? parsed.ay : 0,
      az: typeof parsed.az === 'number' ? parsed.az : 0,
      pitch: typeof parsed.pitch === 'number' ? parsed.pitch : 0,
      roll: typeof parsed.roll === 'number' ? parsed.roll : 0
    };
  } catch {
    return ZERO_TARE_OFFSET;
  }
}

export function saveTareOffset(offset: TareOffset): void {
  try {
    localStorage.setItem(STORAGE_KEY_TARE, JSON.stringify(offset));
  } catch (err) {
    console.error('Failed to save tare offset', err);
  }
}

export function clearTareOffset(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_TARE);
  } catch (err) {
    console.error('Failed to clear tare offset', err);
  }
}

/**
 * Applies calibration tare offsets to raw sensor readings.
 * At rest, calibrated acceleration total is centered at 1.0g datum (az = 1.0g, ax=0, ay=0),
 * and calibrated pitch & roll are centered at 0.0°.
 */
export function applyTareOffset(
  accel: { x: number; y: number; z: number },
  tilt: { pitch: number; roll: number },
  offset: TareOffset
): {
  accel: { x: number; y: number; z: number };
  tilt: { pitch: number; roll: number };
} {
  return {
    accel: {
      x: Number((accel.x - offset.ax).toFixed(4)),
      y: Number((accel.y - offset.ay).toFixed(4)),
      z: Number((accel.z - offset.az).toFixed(4))
    },
    tilt: {
      pitch: Number((tilt.pitch - offset.pitch).toFixed(2)),
      roll: Number((tilt.roll - offset.roll).toFixed(2))
    }
  };
}
