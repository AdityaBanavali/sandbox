/**
 * Structural Engineering Mathematics & Earthquake Accelerometer Dynamics
 * 
 * Provides:
 * 1. Peak Ground Acceleration (PGA) calculation with gravity compensation (g).
 * 2. Modified Mercalli Intensity (MMI) scale mapping (Roman numerals I-X) & hazard classifications.
 * 3. Structural resonant frequency drift calculation against baseline f0 = 4.0 Hz.
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
