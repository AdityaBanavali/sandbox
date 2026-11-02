import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Box, ShieldAlert, WifiOff, Camera, CheckCircle2, AlertOctagon } from 'lucide-react';
import { InferenceState, DriftEvaluation } from '../types';
import { calculateInterStoryDrift } from '../utils/structuralMath';

export type CameraPreset = 'ISO' | 'FRONT' | 'TOP' | 'RESET';

export interface DigitalTwinViewerProps {
  pitch?: number; // Pitch in degrees
  roll?: number; // Roll in degrees
  accelMagnitude?: number; // Dynamic PGA or total norm in g
  dominantFreqHz?: number; // Dominant vibration frequency in Hz
  inferenceState?: InferenceState;
  anomalyScore?: number;
  isConnected: boolean;
  className?: string;
}

interface TowerModelProps {
  pitch: number;
  roll: number;
  accelMagnitude: number;
  dominantFreqHz: number;
  inferenceState: InferenceState;
  anomalyScore: number;
  isConnected: boolean;
}

const NUM_STORIES = 5;
const STORY_HEIGHT = 0.85;
const TOWER_WIDTH = 1.6;
const TOWER_DEPTH = 1.6;

const CAMERA_POSITIONS: Record<CameraPreset, [number, number, number]> = {
  ISO: [5.0, 3.2, 5.0],
  FRONT: [0.0, 1.0, 6.5],
  TOP: [0.001, 7.8, 0.001],
  RESET: [5.0, 3.2, 5.0]
};

function CameraController({ preset }: { preset: CameraPreset }) {
  const { camera } = useThree();
  const targetPos = useMemo(() => new THREE.Vector3(...CAMERA_POSITIONS[preset]), [preset]);

  useFrame((_, delta) => {
    camera.position.lerp(targetPos, Math.min(1, delta * 6));
    camera.lookAt(0, 0.2, 0);
  });

  return null;
}

/**
 * Procedural multi-story structural frame with floor slabs, columns, cross-braces,
 * dynamic ground shake grid, and dynamic stress/strain material shading.
 */
function StructuralTower({
  pitch,
  roll,
  accelMagnitude,
  dominantFreqHz,
  inferenceState,
  anomalyScore,
  isConnected
}: TowerModelProps) {
  const rootGroupRef = useRef<THREE.Group>(null);
  const storyGroupRefs = useRef<(THREE.Group | null)[]>([]);
  const groundShakeRef = useRef<THREE.Group>(null);
  const currentRotationRef = useRef({ x: 0, z: 0 });

  // Determine stress/strain bracket based on Dynamic PGA & Anomaly Score:
  // - Nominal (< 0.40): Cyan/Slate-400 (#38BDF8 / #94A3B8)
  // - Elevated Resonance (0.40 - 0.70): Amber warning glow (#F59E0B)
  // - Seismic / Critical Event (>= 0.70): High-intensity emissive Red pulse (#EF4444)
  const stressSeverity = useMemo(() => {
    if (!isConnected) return 'OFFLINE';
    const effectivePga = accelMagnitude;
    const effectiveScore = anomalyScore;

    if (inferenceState === 'SEISMIC_EVENT' || effectivePga >= 0.70 || effectiveScore >= 0.70) {
      return 'CRITICAL';
    }
    if (inferenceState === 'RESONANCE_WARNING' || effectivePga >= 0.40 || effectiveScore >= 0.40) {
      return 'ELEVATED';
    }
    return 'NOMINAL';
  }, [isConnected, accelMagnitude, anomalyScore, inferenceState]);

  // Geometry definitions for slabs and cross-braces
  const { slabEdgesGeometry, slabFillGeometry, braceLineGeometries, columnLineGeometries } = useMemo(() => {
    const slabBox = new THREE.BoxGeometry(TOWER_WIDTH, 0.08, TOWER_DEPTH);
    const slabEdges = new THREE.EdgesGeometry(slabBox);

    const halfW = TOWER_WIDTH / 2;
    const halfD = TOWER_DEPTH / 2;
    const h = STORY_HEIGHT;

    const bracesPoints: THREE.Vector3[] = [
      // Front face (+Z)
      new THREE.Vector3(-halfW, 0, halfD), new THREE.Vector3(halfW, h, halfD),
      new THREE.Vector3(halfW, 0, halfD), new THREE.Vector3(-halfW, h, halfD),
      // Back face (-Z)
      new THREE.Vector3(-halfW, 0, -halfD), new THREE.Vector3(halfW, h, -halfD),
      new THREE.Vector3(halfW, 0, -halfD), new THREE.Vector3(-halfW, h, -halfD),
      // Left face (-X)
      new THREE.Vector3(-halfW, 0, -halfD), new THREE.Vector3(-halfW, h, halfD),
      new THREE.Vector3(-halfW, 0, halfD), new THREE.Vector3(-halfW, h, -halfD),
      // Right face (+X)
      new THREE.Vector3(halfW, 0, -halfD), new THREE.Vector3(halfW, h, halfD),
      new THREE.Vector3(halfW, 0, halfD), new THREE.Vector3(-halfW, h, -halfD)
    ];
    const bracesGeom = new THREE.BufferGeometry().setFromPoints(bracesPoints);

    const columnPoints: THREE.Vector3[] = [
      new THREE.Vector3(-halfW, 0, -halfD), new THREE.Vector3(-halfW, h, -halfD),
      new THREE.Vector3(halfW, 0, -halfD), new THREE.Vector3(halfW, h, -halfD),
      new THREE.Vector3(-halfW, 0, halfD), new THREE.Vector3(-halfW, h, halfD),
      new THREE.Vector3(halfW, 0, halfD), new THREE.Vector3(halfW, h, halfD)
    ];
    const columnGeom = new THREE.BufferGeometry().setFromPoints(columnPoints);

    return {
      slabEdgesGeometry: slabEdges,
      slabFillGeometry: slabBox,
      braceLineGeometries: bracesGeom,
      columnLineGeometries: columnGeom
    };
  }, []);

  // Material references to dynamically pulse stress colors smoothly
  const columnMaterialRef = useRef<THREE.LineBasicMaterial>(null);
  const braceMaterialRef = useRef<THREE.LineBasicMaterial>(null);
  const slabMaterialRef = useRef<THREE.MeshBasicMaterial>(null);

  // Dynamic frame animation and structural kinematics
  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();

    if (!rootGroupRef.current) return;

    if (!isConnected) {
      rootGroupRef.current.rotation.x = THREE.MathUtils.lerp(rootGroupRef.current.rotation.x, 0, delta * 3);
      rootGroupRef.current.rotation.z = THREE.MathUtils.lerp(rootGroupRef.current.rotation.z, 0, delta * 3);

      for (let i = 0; i < NUM_STORIES; i++) {
        const floorNode = storyGroupRefs.current[i];
        if (floorNode) {
          floorNode.position.x = THREE.MathUtils.lerp(floorNode.position.x, 0, delta * 4);
          floorNode.position.z = THREE.MathUtils.lerp(floorNode.position.z, 0, delta * 4);
        }
      }

      if (groundShakeRef.current) {
        groundShakeRef.current.position.x = THREE.MathUtils.lerp(groundShakeRef.current.position.x, 0, delta * 4);
        groundShakeRef.current.position.z = THREE.MathUtils.lerp(groundShakeRef.current.position.z, 0, delta * 4);
      }
      return;
    }

    // 1. Tilt angles smoothed with lerp
    const targetRotX = (pitch * Math.PI) / 180;
    const targetRotZ = (-roll * Math.PI) / 180;

    currentRotationRef.current.x = THREE.MathUtils.lerp(
      currentRotationRef.current.x,
      targetRotX,
      Math.min(1, delta * 6)
    );
    currentRotationRef.current.z = THREE.MathUtils.lerp(
      currentRotationRef.current.z,
      targetRotZ,
      Math.min(1, delta * 6)
    );

    rootGroupRef.current.rotation.x = currentRotationRef.current.x;
    rootGroupRef.current.rotation.z = currentRotationRef.current.z;

    // 2. Modulate structural shear displacement and ground shake
    const effectiveFreq = Math.max(0.5, Math.min(12, dominantFreqHz || 3.2));
    const angularSpeed = effectiveFreq * Math.PI * 2;
    const dynamicSwayMagnitude = Math.min(0.40, Math.max(0.01, accelMagnitude * 0.18));

    const harmonicX = Math.sin(time * angularSpeed) * dynamicSwayMagnitude;
    const harmonicZ = Math.cos(time * (angularSpeed * 0.8)) * dynamicSwayMagnitude * 0.7;

    // Move oscillating ground shake grid directly beneath the base floor
    if (groundShakeRef.current) {
      groundShakeRef.current.position.x = -harmonicX * 0.45;
      groundShakeRef.current.position.z = -harmonicZ * 0.45;
    }

    // Distribute lateral cantilever shear over floors
    for (let story = 0; story < NUM_STORIES; story++) {
      const floorNode = storyGroupRefs.current[story];
      if (!floorNode) continue;

      const storyRatio = Math.pow((story + 1) / NUM_STORIES, 1.4);
      const targetDisplacementX = harmonicX * storyRatio;
      const targetDisplacementZ = harmonicZ * storyRatio;

      floorNode.position.x = THREE.MathUtils.lerp(floorNode.position.x, targetDisplacementX, delta * 14);
      floorNode.position.z = THREE.MathUtils.lerp(floorNode.position.z, targetDisplacementZ, delta * 14);
    }

    // 3. Dynamic Stress/Strain Wireframe Shading & Emissive Pulse
    if (columnMaterialRef.current && braceMaterialRef.current && slabMaterialRef.current) {
      if (stressSeverity === 'CRITICAL') {
        // High-intensity emissive Red pulse (pulsing at 8 Hz)
        const pulse = 0.7 + 0.3 * Math.sin(time * 10);
        columnMaterialRef.current.color.setRGB(0.94 * pulse, 0.27 * (1 - pulse), 0.27 * (1 - pulse));
        braceMaterialRef.current.color.setRGB(0.96 * pulse, 0.25 * (1 - pulse), 0.37 * (1 - pulse));
        slabMaterialRef.current.color.setRGB(0.35 * pulse, 0.05, 0.05);
        slabMaterialRef.current.opacity = 0.55 * pulse;
      } else if (stressSeverity === 'ELEVATED') {
        // Amber warning glow (#F59E0B)
        const glow = 0.85 + 0.15 * Math.sin(time * 4);
        columnMaterialRef.current.color.set('#F59E0B');
        braceMaterialRef.current.color.set('#D97706');
        slabMaterialRef.current.color.set('#451A03');
        slabMaterialRef.current.opacity = 0.42 * glow;
      } else {
        // Nominal (< 0.40): Cyan/Slate-400 (#38BDF8 / #94A3B8)
        columnMaterialRef.current.color.set('#38BDF8');
        braceMaterialRef.current.color.set('#94A3B8');
        slabMaterialRef.current.color.set('#082F49');
        slabMaterialRef.current.opacity = 0.32;
      }
    }
  });

  return (
    <group ref={rootGroupRef} position={[0, -1.8, 0]}>
      {/* Structural Foundation Footing */}
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[TOWER_WIDTH * 1.3, 0.1, TOWER_DEPTH * 1.3]} />
        <meshBasicMaterial color="#0B111E" />
      </mesh>
      <lineSegments position={[0, -0.05, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(TOWER_WIDTH * 1.3, 0.1, TOWER_DEPTH * 1.3)]} />
        <lineBasicMaterial color={isConnected ? '#1E243B' : '#0F172A'} linewidth={1} />
      </lineSegments>

      {/* Multi-Story Tier Assembly */}
      {Array.from({ length: NUM_STORIES }, (_, storyIdx) => {
        const floorElevation = (storyIdx + 1) * STORY_HEIGHT;

        return (
          <group
            key={`story-${storyIdx}`}
            ref={(el) => {
              storyGroupRefs.current[storyIdx] = el;
            }}
          >
            {/* Story Vertical Columns */}
            <lineSegments
              geometry={columnLineGeometries}
              position={[0, storyIdx * STORY_HEIGHT, 0]}
            >
              <lineBasicMaterial
                ref={storyIdx === 0 ? columnMaterialRef : undefined}
                color={
                  !isConnected
                    ? '#334155'
                    : stressSeverity === 'CRITICAL'
                    ? '#EF4444'
                    : stressSeverity === 'ELEVATED'
                    ? '#F59E0B'
                    : '#38BDF8'
                }
                linewidth={1.8}
                transparent
                opacity={isConnected ? 0.95 : 0.4}
              />
            </lineSegments>

            {/* Story Diagonal Cross-Bracing */}
            <lineSegments
              geometry={braceLineGeometries}
              position={[0, storyIdx * STORY_HEIGHT, 0]}
            >
              <lineBasicMaterial
                ref={storyIdx === 0 ? braceMaterialRef : undefined}
                color={
                  !isConnected
                    ? '#1E293B'
                    : stressSeverity === 'CRITICAL'
                    ? '#F43F5E'
                    : stressSeverity === 'ELEVATED'
                    ? '#D97706'
                    : '#94A3B8'
                }
                linewidth={1.2}
                transparent
                opacity={isConnected ? 0.8 : 0.25}
              />
            </lineSegments>

            {/* Floor Slab Plate & Wireframe Edges */}
            <group position={[0, floorElevation, 0]}>
              <mesh geometry={slabFillGeometry}>
                <meshBasicMaterial
                  ref={storyIdx === 0 ? slabMaterialRef : undefined}
                  color={
                    !isConnected
                      ? '#0F172A'
                      : stressSeverity === 'CRITICAL'
                      ? '#450A0A'
                      : stressSeverity === 'ELEVATED'
                      ? '#451A03'
                      : '#082F49'
                  }
                  transparent
                  opacity={isConnected ? 0.35 : 0.2}
                />
              </mesh>
              <lineSegments geometry={slabEdgesGeometry}>
                <lineBasicMaterial
                  color={
                    !isConnected
                      ? '#334155'
                      : stressSeverity === 'CRITICAL'
                      ? '#EF4444'
                      : stressSeverity === 'ELEVATED'
                      ? '#F59E0B'
                      : '#38BDF8'
                  }
                  linewidth={1.5}
                  transparent
                  opacity={isConnected ? 1.0 : 0.5}
                />
              </lineSegments>
            </group>
          </group>
        );
      })}

      {/* Dynamic Oscillating Ground Shake Grid */}
      <group ref={groundShakeRef} position={[0, -0.1, 0]}>
        <gridHelper
          args={[
            10,
            24,
            !isConnected
              ? '#0F172A'
              : stressSeverity === 'CRITICAL'
              ? '#EF4444'
              : stressSeverity === 'ELEVATED'
              ? '#F59E0B'
              : '#0284C7',
            '#0A111C'
          ]}
        />
        {/* Footing seismic excitation rings */}
        <lineSegments position={[0, 0.01, 0]}>
          <edgesGeometry args={[new THREE.BoxGeometry(2.6, 0.02, 2.6)]} />
          <lineBasicMaterial
            color={
              stressSeverity === 'CRITICAL'
                ? '#EF4444'
                : stressSeverity === 'ELEVATED'
                ? '#F59E0B'
                : '#1E293B'
            }
            transparent
            opacity={0.6}
          />
        </lineSegments>
      </group>
    </group>
  );
}

export const DigitalTwinViewer: React.FC<DigitalTwinViewerProps> = ({
  pitch = 0,
  roll = 0,
  accelMagnitude = 0,
  dominantFreqHz = 3.2,
  inferenceState = 'NOMINAL',
  anomalyScore = 0.08,
  isConnected,
  className = ''
}) => {
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('ISO');

  const isEmergency = isConnected && (inferenceState === 'SEISMIC_EVENT' || accelMagnitude >= 0.70);
  const isWarning =
    isConnected &&
    !isEmergency &&
    (inferenceState === 'RESONANCE_WARNING' || accelMagnitude >= 0.40);

  // Compute Inter-Story Drift Ratio & Seismic Compliance (IS 1893:2016)
  const driftEval: DriftEvaluation = useMemo(() => {
    return calculateInterStoryDrift(accelMagnitude, dominantFreqHz, pitch, roll);
  }, [accelMagnitude, dominantFreqHz, pitch, roll]);

  return (
    <div
      className={`bg-[#0A0D14] border ${
        isEmergency
          ? 'border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
          : isWarning
          ? 'border-amber-500/50'
          : 'border-[#1F2430]'
      } rounded p-3 flex flex-col justify-between relative overflow-hidden transition-colors duration-300 ${className}`}
    >
      {/* Top Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F2430] pb-2 mb-2.5 z-10">
        <div className="flex items-center gap-2">
          <Box className={`w-4 h-4 ${isConnected ? 'text-cyan-400' : 'text-slate-600'}`} />
          <h3 className="text-xs font-mono font-semibold tracking-wider text-slate-200 uppercase">
            3D DIGITAL TWIN // TOWER KINEMATICS
          </h3>
          {isEmergency && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-red-400 bg-red-500/10 border border-red-500/30 px-2 py-0.5 rounded animate-pulse">
              <ShieldAlert className="w-3 h-3 text-red-400" />
              DYNAMIC SHEAR BREACH
            </span>
          )}
        </div>

        {/* Pitch, Roll, and Story Height Info */}
        <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
          <div className="flex items-center gap-1.5 bg-[#07090F] border border-[#1F2430] rounded px-2 py-0.5 text-[11px] tabular-nums">
            <span className="text-slate-600">PITCH:</span>
            <span className={isConnected ? 'text-cyan-300' : 'text-slate-600'}>
              {isConnected ? `${pitch.toFixed(1)}°` : '--'}
            </span>
            <span className="text-slate-700">|</span>
            <span className="text-slate-600">ROLL:</span>
            <span className={isConnected ? 'text-cyan-300' : 'text-slate-600'}>
              {isConnected ? `${roll.toFixed(1)}°` : '--'}
            </span>
          </div>

          <span className="text-[10px] text-slate-500 hidden sm:inline">
            5-STORY • h=400mm
          </span>
        </div>
      </div>

      {/* 3D WebGL Canvas Viewport */}
      <div className="relative w-full h-64 md:h-72 rounded bg-[#07090F] border border-[#161B26] overflow-hidden">
        <Canvas
          camera={{ position: CAMERA_POSITIONS.ISO, fov: 42 }}
          gl={{ antialias: true, alpha: true }}
        >
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 15, 10]} intensity={1.3} />
          <CameraController preset={cameraPreset} />
          <StructuralTower
            pitch={pitch}
            roll={roll}
            accelMagnitude={accelMagnitude}
            dominantFreqHz={dominantFreqHz}
            inferenceState={inferenceState}
            anomalyScore={anomalyScore}
            isConnected={isConnected}
          />
        </Canvas>

        {/* Overlay Pill Bar: Camera Preset Switchers [ISO], [FRONT], [TOP], [RESET] */}
        <div className="absolute top-2.5 right-2.5 flex items-center bg-[#0B0D13]/90 border border-[#1F2430] rounded p-0.5 backdrop-blur-sm z-30 shadow-lg">
          {(['ISO', 'FRONT', 'TOP', 'RESET'] as CameraPreset[]).map((preset) => {
            const isActive = cameraPreset === preset;
            return (
              <button
                key={preset}
                onClick={() => setCameraPreset(preset)}
                title={`Switch camera to ${preset} view`}
                className={`px-2 py-1 text-[10px] font-mono font-semibold rounded transition flex items-center gap-1 ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {preset === 'RESET' && <Camera className="w-2.5 h-2.5 text-slate-400" />}
                <span>{preset}</span>
              </button>
            );
          })}
        </div>

        {/* Fallback / Disconnected Overlay */}
        {!isConnected && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[1px] flex flex-col items-center justify-center p-4 z-20">
            <div className="border border-slate-700 bg-slate-900/80 text-slate-400 px-3.5 py-1.5 rounded flex items-center gap-2 text-xs font-mono tracking-wider uppercase mb-1.5 shadow-lg">
              <WifiOff className="w-3.5 h-3.5 text-slate-500" />
              TELEMETRY OFFLINE // TWIN INACTIVE
            </div>
            <p className="text-[10px] text-slate-600 font-mono text-center max-w-xs">
              Awaiting live IMU matrix stream from edge telemetry node.
            </p>
          </div>
        )}

        {/* Live Coordinate Crosshairs HUD */}
        <div className="absolute top-2.5 left-2.5 pointer-events-none text-[9px] font-mono text-slate-500 flex flex-col gap-0.5 bg-[#07090F]/70 px-2 py-1 rounded border border-[#161B26]">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                !isConnected
                  ? 'bg-slate-600'
                  : isEmergency
                  ? 'bg-rose-500 animate-ping'
                  : isWarning
                  ? 'bg-amber-400'
                  : 'bg-cyan-400'
              }`}
            ></span>
            <span>SHADING: {isEmergency ? 'CRITICAL PULSE' : isWarning ? 'AMBER WARN' : 'NOMINAL WIRE'}</span>
          </span>
          <span>GROUND: LATERAL OSCILLATION ACTIVE</span>
        </div>
      </div>

      {/* Structural Drift Ratio & IS 1893:2016 Seismic Compliance Badge */}
      <div className="mt-2.5 bg-[#07090F] border border-[#1F2430] rounded px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-500 uppercase">INTER-STORY DRIFT:</span>
          <span className="text-slate-300 font-semibold tabular-nums">
            {isConnected ? `${driftEval.displacementMm.toFixed(2)} mm` : '--'}
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-[10px] text-slate-500 uppercase">DRIFT RATIO (Δ/h):</span>
          <span
            className={`font-semibold tabular-nums ${
              !isConnected
                ? 'text-slate-600'
                : driftEval.isPass
                ? 'text-cyan-300'
                : 'text-rose-400 font-bold animate-pulse'
            }`}
          >
            {isConnected ? `${(driftEval.driftRatio * 100).toFixed(3)}%` : '--'}
          </span>
        </div>

        {/* IS 1893 Compliance Badge */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded border text-[10px] font-semibold tracking-wider uppercase transition-colors ${
            !isConnected
              ? 'bg-slate-900 border-slate-800 text-slate-600'
              : driftEval.isPass
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-500/20 border-rose-500/50 text-rose-300 animate-pulse'
          }`}
        >
          {driftEval.isPass ? (
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          ) : (
            <AlertOctagon className="w-3 h-3 text-rose-400" />
          )}
          <span>{isConnected ? driftEval.badgeText : 'IS 1893: STANDBY'}</span>
        </div>
      </div>
    </div>
  );
};
