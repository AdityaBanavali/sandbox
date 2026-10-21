import React, { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, Stats } from '@react-three/drei'
import { EffectComposer, Bloom, Scanline, Vignette } from '@react-three/postprocessing'
import { computeLayout, type CityLayout } from './layout'
import { AnimatedCity } from './AnimatedCity'
import type { IngestedRepoData } from '../data/types'
import { useUIStore } from '../store'

interface CitySceneProps {
  data: IngestedRepoData
}

export const CityScene: React.FC<CitySceneProps> = ({ data }) => {
  const layout = useMemo<CityLayout>(() => computeLayout(data), [data])

  const centerX = (layout.bounds.minX + layout.bounds.maxX) / 2
  const centerZ = (layout.bounds.minZ + layout.bounds.maxZ) / 2

  return (
    <>
      <color attach="background" args={['#04050b']} />
      <fog attach="fog" args={['#04050b', 50, 280]} />

      {/* Cyberpunk Dynamic Lighting */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[60, 90, 60]} intensity={1.5} color="#e0e7ff" />
      <directionalLight position={[-50, 40, -50]} intensity={0.7} color="#d946ef" />
      <pointLight position={[centerX, 45, centerZ]} intensity={2.2} color="#00f0ff" distance={200} />

      {/* Retro Synthwave Floor Grid */}
      <gridHelper args={[340, 170, '#3b0764', '#0f172a']} position={[0, -0.05, 0]} />

      {/* Animated Voxel City: InstancedMesh buildings, ripples, earthquake shockwave, islands */}
      <AnimatedCity data={data} layout={layout} />

      {/* Retro Postprocessing: Bloom + Subtle Scanlines + Vignette */}
      <EffectComposer multisampling={4}>
        <Bloom
          luminanceThreshold={0.25}
          luminanceSmoothing={0.8}
          intensity={1.1}
          mipmapBlur
        />
        <Scanline density={1.2} opacity={0.12} />
        <Vignette eskil={false} offset={0.15} darkness={0.75} />
      </EffectComposer>

      {/* Camera OrbitControls with smooth damping (disabled during cinematic auto-orbit) */}
      <OrbitControls
        makeDefault
        target={[centerX, 0, centerZ]}
        enableDamping
        dampingFactor={0.05}
        maxPolarAngle={Math.PI / 2 - 0.05}
        enabled={!useUIStore.getState().isCinematicMode}
      />

      {/* Smooth Camera Fly-to Manager for District Zooming & Cinematic Orbit */}
      <CameraManager defaultCenter={[centerX, 0, centerZ]} />

      {/* Dev Mode FPS Counter in bottom-left */}
      {import.meta.env.DEV && (
        <Stats className="!left-4 !right-auto !bottom-24 !top-auto !opacity-85 pointer-events-auto" />
      )}
    </>
  )
}

function CameraManager({ defaultCenter }: { defaultCenter: [number, number, number] }) {
  const { camera } = useThree()
  const controls = useThree((state) => state.controls) as any
  const cameraTarget = useUIStore((s) => s.cameraTarget)
  const isCinematicMode = useUIStore((s) => s.isCinematicMode)
  const flyByTrigger = useUIStore((s) => s.flyByTrigger)

  const isTransitioning = useRef(false)
  const currentId = useRef(0)

  // Cinematic auto-orbit and fly-by refs
  const orbitAngleRef = useRef(0)
  const flyByTimerRef = useRef(0)
  const flyByPosRef = useRef<THREE.Vector3 | null>(null)
  const lastFlyByIdRef = useRef<number>(0)

  useEffect(() => {
    if (cameraTarget && cameraTarget.id !== currentId.current) {
      currentId.current = cameraTarget.id
      isTransitioning.current = true
    }
  }, [cameraTarget])

  useEffect(() => {
    if (flyByTrigger && flyByTrigger.id !== lastFlyByIdRef.current) {
      lastFlyByIdRef.current = flyByTrigger.id
      flyByTimerRef.current = 2.4
      flyByPosRef.current = new THREE.Vector3(...flyByTrigger.target)
    }
  }, [flyByTrigger])

  // Track drone mode exit for smooth 0.6s transition back to orbit controls
  const wasCinematicRef = useRef(isCinematicMode)
  const exitTransitionTimerRef = useRef(0)
  const exitDuration = 0.6

  useEffect(() => {
    // Release pointer lock on drone exit or window blur
    if (wasCinematicRef.current && !isCinematicMode) {
      if (document.pointerLockElement) {
        document.exitPointerLock()
      }
      exitTransitionTimerRef.current = exitDuration
      if (controls) {
        controls.target.set(defaultCenter[0], defaultCenter[1], defaultCenter[2])
        controls.update()
      }
    }
    wasCinematicRef.current = isCinematicMode
  }, [isCinematicMode, controls, defaultCenter])

  // Release pointer lock on window blur
  useEffect(() => {
    const handleBlur = () => {
      if (document.pointerLockElement) {
        document.exitPointerLock()
      }
    }
    window.addEventListener('blur', handleBlur)
    return () => window.removeEventListener('blur', handleBlur)
  }, [])

  useFrame((_, delta) => {
    if (isCinematicMode) {
      orbitAngleRef.current += delta * 0.2
      const radius = 68
      const orbitPos = new THREE.Vector3(
        defaultCenter[0] + radius * Math.cos(orbitAngleRef.current),
        36 + 8 * Math.sin(orbitAngleRef.current * 0.5),
        defaultCenter[2] + radius * Math.sin(orbitAngleRef.current)
      )
      const orbitTarget = new THREE.Vector3(...defaultCenter)

      // Check dramatic fly-by during big commits
      if (flyByTimerRef.current > 0 && flyByPosRef.current) {
        flyByTimerRef.current -= delta
        const flyTarget = flyByPosRef.current
        const flyPos = new THREE.Vector3(
          flyTarget.x + 10 * Math.cos(orbitAngleRef.current),
          10,
          flyTarget.z + 10 * Math.sin(orbitAngleRef.current)
        )
        camera.position.lerp(flyPos, delta * 3.5)
        if (controls && controls.target) {
          controls.target.lerp(flyTarget, delta * 3.5)
          controls.update()
        }
      } else {
        camera.position.lerp(orbitPos, delta * 1.8)
        if (controls && controls.target) {
          controls.target.lerp(orbitTarget, delta * 1.8)
          controls.update()
        }
      }
      return
    }

    // Smooth 0.6s transition when exiting drone mode
    if (exitTransitionTimerRef.current > 0) {
      exitTransitionTimerRef.current -= delta
      if (controls && controls.target) {
        const orbitTarget = new THREE.Vector3(...defaultCenter)
        controls.target.lerp(orbitTarget, delta * 4)
        controls.update()
      }
      return
    }

    if (!isTransitioning.current) return

    const destPos = cameraTarget
      ? new THREE.Vector3(...cameraTarget.position)
      : new THREE.Vector3(defaultCenter[0] + 50, 60, defaultCenter[2] + 50)
    const destTarget = cameraTarget
      ? new THREE.Vector3(...cameraTarget.target)
      : new THREE.Vector3(...defaultCenter)

    camera.position.lerp(destPos, delta * 3.5)
    if (controls && controls.target) {
      controls.target.lerp(destTarget, delta * 3.5)
      controls.update()
    }

    if (camera.position.distanceTo(destPos) < 0.3) {
      isTransitioning.current = false
    }
  })

  return null
}
