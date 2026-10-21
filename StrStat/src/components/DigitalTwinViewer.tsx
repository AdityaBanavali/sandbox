import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Box, Activity, ShieldAlert, WifiOff } from 'lucide-react';
import { InferenceState } from '../types';

export interface DigitalTwinViewerProps {
  pitch?: number; // Pitch in degrees
  roll?: number; // Roll in degrees
  accelMagnitude?: number; // Total acceleration norm or PGA in g
  dominantFreqHz?: number; // Dominant vibration frequency in Hz
  inferenceState?: InferenceState;
  isConnected: boolean;
  className?: string;
}

interface TowerModelProps {
  pitch: number;
  roll: number;
  accelMagnitude: number;
  dominantFreqHz: number;
  inferenceState: InferenceState;
  isConnected: boolean;
}

const NUM_STORIES = 5;
const STORY_HEIGHT = 0.85;
const TOWER_WIDTH = 1.6;
const TOWER_DEPTH = 1.6;

/**
 * Procedural multi-story structural frame with floor slabs, columns, and cross-braces
 */
function StructuralTower({
  pitch,
  roll,
  accelMagnitude,
  dominantFreqHz,
  inferenceState,
  isConnected
}: TowerModelProps) {
  const rootGroupRef = useRef<THREE.Group>(null);
  const storyGroupRefs = useRef<(THREE.Group | null)[]>([]);

  // Smooth rotation tracking
  const currentRotationRef = useRef({ x: 0, z: 0 });

  // Geometry definitions for slabs and cross-braces
  const { slabEdgesGeometry, slabFillGeometry, braceLineGeometries, columnLineGeometries } = useMemo(() => {
    // 1. Floor slab geometries
    const slabBox = new THREE.BoxGeometry(TOWER_WIDTH, 0.08, TOWER_DEPTH);
    const slabEdges = new THREE.EdgesGeometry(slabBox);

    // 2. Cross-braces for all 4 facades per tier
    const halfW = TOWER_WIDTH / 2;
    const halfD = TOWER_DEPTH / 2;
    const h = STORY_HEIGHT;

    // Build diagonal cross-braces per story tier
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
      new THREE.Vector3(halfW, 0, halfD), new THREE.Vector3(halfW, h, -halfD)
    ];
    const bracesGeom = new THREE.BufferGeometry().setFromPoints(bracesPoints);

    // 3. Corner vertical columns per story tier
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

  // Dynamic frame animation and structural kinematics
  useFrame((state, delta) => {
    if (!rootGroupRef.current) return;

    const time = state.clock.getElapsedTime();

    if (!isConnected) {
      // Return smoothly to static level orientation
      rootGroupRef.current.rotation.x = THREE.MathUtils.lerp(rootGroupRef.current.rotation.x, 0, delta * 3);
      rootGroupRef.current.rotation.z = THREE.MathUtils.lerp(rootGroupRef.current.rotation.z, 0, delta * 3);

      for (let i = 0; i < NUM_STORIES; i++) {
        const floorNode = storyGroupRefs.current[i];
        if (floorNode) {
          floorNode.position.x = THREE.MathUtils.lerp(floorNode.position.x, 0, delta * 4);
          floorNode.position.z = THREE.MathUtils.lerp(floorNode.position.z, 0, delta * 4);
        }
      }
      return;
    }

    // 1. Continuous Pitch & Roll smoothing with subtle lerp
    // Pitch (tilt forward/backward) -> Rotation around X
    // Roll (tilt left/right) -> Rotation around Z
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

    // 2. Modulate structural shear displacement:
    // Upper floors experience progressive lateral sway based on dynamic acceleration & frequency
    const effectiveFreq = Math.max(0.5, Math.min(12, dominantFreqHz || 3.2));
    const angularSpeed = effectiveFreq * Math.PI * 2;
    const dynamicSwayMagnitude = Math.min(0.35, Math.max(0.01, accelMagnitude * 0.15));

    const harmonicX = Math.sin(time * angularSpeed) * dynamicSwayMagnitude;
    const harmonicZ = Math.cos(time * (angularSpeed * 0.8)) * dynamicSwayMagnitude * 0.7;

    for (let story = 0; story < NUM_STORIES; story++) {
      const floorNode = storyGroupRefs.current[story];
      if (!floorNode) continue;

      // Cantilever shear amplification: displacement scales non-linearly with floor elevation
      const storyRatio = Math.pow((story + 1) / NUM_STORIES, 1.4);
      const targetDisplacementX = harmonicX * storyRatio;
      const targetDisplacementZ = harmonicZ * storyRatio;

      floorNode.position.x = THREE.MathUtils.lerp(floorNode.position.x, targetDisplacementX, delta * 12);
      floorNode.position.z = THREE.MathUtils.lerp(floorNode.position.z, targetDisplacementZ, delta * 12);
    }
  });

  // Color scheme: neon cyan/emerald for nominal, warning amber, emergency crimson pulse for seismic, neutral gray when offline
  const colors = useMemo(() => {
    if (!isConnected) {
      return {
        primaryEdge: '#334155', // Slate 700
        secondaryEdge: '#1E293B', // Slate 800
        slabFill: '#0F172A',
        slabOpacity: 0.25,
        corePulse: '#1E293B'
      };
    }

    if (inferenceState === 'SEISMIC_EVENT') {
      return {
        primaryEdge: '#EF4444', // Neon Crimson
        secondaryEdge: '#F43F5E',
        slabFill: '#450A0A',
        slabOpacity: 0.6,
        corePulse: '#DC2626'
      };
    }

    if (inferenceState === 'RESONANCE_WARNING') {
      return {
        primaryEdge: '#F59E0B', // Amber
        secondaryEdge: '#D97706',
        slabFill: '#451A03',
        slabOpacity: 0.45,
        corePulse: '#F59E0B'
      };
    }

    return {
      primaryEdge: '#06B6D4', // Neon Cyan
      secondaryEdge: '#10B981', // Emerald
      slabFill: '#083344',
      slabOpacity: 0.35,
      corePulse: '#06B6D4'
    };
  }, [isConnected, inferenceState]);

  return (
    <group ref={rootGroupRef} position={[0, -1.8, 0]}>
      {/* Structural Foundation Foundation Footing */}
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[TOWER_WIDTH * 1.3, 0.1, TOWER_DEPTH * 1.3]} />
        <meshBasicMaterial color="#0B111E" />
      </mesh>
      <lineSegments position={[0, -0.05, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(TOWER_WIDTH * 1.3, 0.1, TOWER_DEPTH * 1.3)]} />
        <lineBasicMaterial color={isConnected ? '#1E293B' : '#0F172A'} linewidth={1} />
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
                color={colors.primaryEdge}
                linewidth={1.5}
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
                color={colors.secondaryEdge}
                linewidth={1}
                transparent
                opacity={isConnected ? 0.75 : 0.25}
              />
            </lineSegments>

            {/* Floor Slab Plate & Wireframe Edges */}
            <group position={[0, floorElevation, 0]}>
              <mesh geometry={slabFillGeometry}>
                <meshBasicMaterial
                  color={colors.slabFill}
                  transparent
                  opacity={colors.slabOpacity}
                />
              </mesh>
              <lineSegments geometry={slabEdgesGeometry}>
                <lineBasicMaterial
                  color={colors.primaryEdge}
                  linewidth={1.5}
                  transparent
                  opacity={isConnected ? 1.0 : 0.5}
                />
              </lineSegments>
            </group>
          </group>
        );
      })}

      {/* Base Grid Plane Indicator */}
      <gridHelper
        args={[10, 20, isConnected ? '#1E293B' : '#0F172A', '#0B111E']}
        position={[0, -0.1, 0]}
      />
    </group>
  );
}

export const DigitalTwinViewer: React.FC<DigitalTwinViewerProps> = ({
  pitch = 0,
  roll = 0,
  accelMagnitude = 0,
  dominantFreqHz = 3.2,
  inferenceState = 'NOMINAL',
  isConnected,
  className = ''
}) => {
  const isEmergency = isConnected && inferenceState === 'SEISMIC_EVENT';
  const isWarning = isConnected && inferenceState === 'RESONANCE_WARNING';

  return (
    <div
      className={`bg-[#0A0D14] border ${
        isEmergency
          ? 'border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
          : isWarning
          ? 'border-amber-500/50'
          : 'border-[#1F2430]'
      } rounded p-4 flex flex-col justify-between relative overflow-hidden transition-colors duration-300 ${className}`}
    >
      {/* Top Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1F2430] pb-2.5 mb-3 z-10">
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

        <div className="flex items-center gap-3 font-mono text-xs text-slate-400">
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
            5-STORY CANTILEVER • 1:1 SCALE
          </span>
        </div>
      </div>

      {/* 3D WebGL Canvas Viewport */}
      <div className="relative w-full h-64 md:h-72 rounded bg-[#07090F] border border-[#161B26] overflow-hidden">
        <Canvas
          camera={{ position: [5.0, 3.2, 5.0], fov: 42 }}
          gl={{ antialias: true, alpha: true }}
        >
          <ambientLight intensity={0.4} />
          <pointLight position={[10, 15, 10]} intensity={1.2} />
          <StructuralTower
            pitch={pitch}
            roll={roll}
            accelMagnitude={accelMagnitude}
            dominantFreqHz={dominantFreqHz}
            inferenceState={inferenceState}
            isConnected={isConnected}
          />
        </Canvas>

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
        <div className="absolute top-2 left-2 pointer-events-none text-[9px] font-mono text-slate-600 flex flex-col gap-0.5">
          <span>AXIS: X/Z LATERAL SHEAR</span>
          <span>MODE: CONTINUOUS LERP</span>
        </div>
      </div>

      {/* Technical Footer */}
      <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono text-slate-500 border-t border-[#1F2430]/60 pt-2">
        <div className="flex items-center gap-2">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected
                ? isEmergency
                  ? 'bg-red-500 animate-ping'
                  : 'bg-cyan-400'
                : 'bg-slate-700'
            }`}
          ></span>
          <span>
            {isConnected
              ? `VIBRATION RESPONSE: ${dominantFreqHz.toFixed(1)} Hz`
              : 'MODEL SYNCHRONIZATION PAUSED'}
          </span>
        </div>
        <div className="text-[10px] text-slate-600">
          CROSS-BRACED TRUSS • KINEMATIC SWAY MATRIX
        </div>
      </div>
    </div>
  );
};
