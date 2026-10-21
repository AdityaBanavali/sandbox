import React, { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { IngestedRepoData } from '../data/types'
import type { CityLayout } from './layout'
import { Avatars } from './Avatars'
import { useTimelineStore, useUIStore, useRepoStore, useSettingsStore } from '../store'
import { sound } from '../data/sound'

interface AnimatedCityProps {
  data: IngestedRepoData
  layout: CityLayout
}

interface Ripple {
  x: number
  z: number
  radius: number
  maxRadius: number
  opacity: number
  color: THREE.Color
  active: boolean
}

const MAX_RIPPLES = 12

export const AnimatedCity: React.FC<AnimatedCityProps> = ({ data, layout }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const roofMeshRef = useRef<THREE.InstancedMesh>(null)
  const { camera } = useThree()

  const totalCommits = data.commits.length
  const isLandingOpen = useUIStore((s) => s.isLandingOpen)

  // Precompute building trajectory maps for zero-overhead evaluation in useFrame
  const buildingMeta = useMemo(() => {
    return layout.buildings.map((b) => {
      // Precompute cumulative touches count for every integer commit index
      const touchCurve = new Int32Array(totalCommits)
      let count = 0
      for (let c = 0; c < totalCommits; c++) {
        if (b.touchCommitIndices.includes(c)) count++
        touchCurve[c] = count
      }

      const district = layout.districts.find((d) => d.id === b.districtId)
      const baseColor = new THREE.Color(district?.color || '#00f0ff')

      return {
        slot: b,
        touchCurve,
        baseColor,
        currentHeight: 0,
        spawnProgress: 0,
      }
    })
  }, [layout, totalCommits])

  // Contributor dominant territory mapping
  const territoryMap = useMemo(() => {
    const map = new Map<string, string>()
    data.contributors.forEach((contrib) => {
      const districtTally = new Map<string, number>()
      data.commits.forEach((c) => {
        if (c.author === contrib.name) {
          c.files.forEach((f) => {
            const b = layout.buildings.find((item) => item.path === f.path)
            if (b) {
              districtTally.set(b.districtId, (districtTally.get(b.districtId) || 0) + 1)
            }
          })
        }
      })
      let dominantDistrictId = layout.districts[0]?.id || 'root'
      let maxTouches = -1
      districtTally.forEach((count, dId) => {
        if (count > maxTouches) {
          maxTouches = count
          dominantDistrictId = dId
        }
      })
      map.set(contrib.name, dominantDistrictId)
    })
    return map
  }, [data, layout])

  // Earthquake & shockwave refs
  const earthquakeIntensityRef = useRef(0)
  const shockwaveRef = useRef<THREE.Mesh>(null)
  const shockwaveDataRef = useRef({ radius: 0, opacity: 0, active: false })

  // Ground pulse ripples pool (capped at MAX_RIPPLES)
  const ripplesRef = useRef<Ripple[]>(
    Array.from({ length: MAX_RIPPLES }, () => ({
      x: 0,
      z: 0,
      radius: 0,
      maxRadius: 18,
      opacity: 0,
      color: new THREE.Color('#00f0ff'),
      active: false,
    }))
  )

  const lastFloorIndexRef = useRef(-1)
  const prevCameraBasePos = useRef(new THREE.Vector3())

  // Center camera on bounds
  useEffect(() => {
    const { minX, maxX, minZ, maxZ } = layout.bounds
    const cx = (minX + maxX) / 2
    const cz = (minZ + maxZ) / 2
    const span = Math.max(maxX - minX, maxZ - minZ, 30)

    const isoDist = span * 1.15
    camera.position.set(cx + isoDist, isoDist * 0.9, cz + isoDist)
    camera.lookAt(cx, 0, cz)
    prevCameraBasePos.current.copy(camera.position)
  }, [layout, camera])

  // Precompute commit weights for auto-pacing:
  // Busy commits (many files touched) receive higher weight -> slower rate / longer dwell time
  const autoPaceMeta = useMemo(() => {
    if (totalCommits === 0) return { totalWeight: 1, weights: new Float32Array(0) }
    const weights = new Float32Array(totalCommits)
    let totalWeight = 0
    for (let i = 0; i < totalCommits; i++) {
      const filesTouched = data.commits[i]?.files.length || 1
      const w = 1 + Math.min(6, Math.sqrt(filesTouched))
      weights[i] = w
      totalWeight += w
    }
    return { totalWeight, weights }
  }, [data, totalCommits])

  // Center coordinates
  const centerX = (layout.bounds.minX + layout.bounds.maxX) / 2
  const centerZ = (layout.bounds.minZ + layout.bounds.maxZ) / 2

  // Frame loop: updates commit progression, building heights, ripples, camera shake
  useFrame((_, delta) => {
    const timeline = useTimelineStore.getState()
    const autoPaceDuration = useUIStore.getState().autoPaceDuration
    let currentIndex = timeline.currentCommitIndex

    // 1. Advance playback if playing
    if (timeline.playing && totalCommits > 0) {
      let advanceRate: number
      if (autoPaceDuration != null) {
        // Fit whole history into target duration (15s / 30s / 60s)
        const commitIdx = Math.min(totalCommits - 1, Math.floor(currentIndex))
        const weight = autoPaceMeta.weights[commitIdx] || 1
        const avgWeight = autoPaceMeta.totalWeight / totalCommits
        advanceRate = (totalCommits / autoPaceDuration) * (avgWeight / weight)
      } else {
        advanceRate = 1.8 * timeline.speed
      }

      currentIndex += delta * advanceRate

      if (currentIndex >= totalCommits - 1) {
        currentIndex = totalCommits - 1
        timeline.setPlaying(false)
      }
      timeline.setCommitIndex(currentIndex)
    }

    const currentFloor = Math.floor(currentIndex)

    // 2. Commit transition event trigger (pulses + earthquake + fly-bys)
    if (currentFloor !== lastFloorIndexRef.current && currentFloor < totalCommits) {
      lastFloorIndexRef.current = currentFloor
      const commit = data.commits[currentFloor]

      if (commit) {
        const touchedCount = commit.files.length

        // Compute centroid of touched buildings
        let sumX = 0
        let sumZ = 0
        let matchCount = 0

        commit.files.forEach((f) => {
          const b = layout.buildings.find((item) => item.path === f.path)
          if (b) {
            sumX += b.x
            sumZ += b.z
            matchCount++
          }
        })

        const rx = matchCount > 0 ? sumX / matchCount : centerX
        const rz = matchCount > 0 ? sumZ / matchCount : centerZ

        // Dramatic camera fly-by during big commits in cinematic mode
        if (touchedCount >= 18 && useUIStore.getState().isCinematicMode) {
          useUIStore.getState().triggerFlyBy([rx, 0, rz])
        }

        // Huge / merge commit (> 50 files touched): trigger earthquake!
        if (touchedCount > 50) {
          sound.playEarthquakeBassHit()
          earthquakeIntensityRef.current = useSettingsStore.getState().reducedMotion ? 0 : 1.5
          shockwaveDataRef.current = {
            radius: 1,
            opacity: 1.0,
            active: true,
          }
        } else {
          // Standard commit tick sound + ground pulse ripple at touched centroid
          sound.playCommitTick()
          const rPool = ripplesRef.current
          const targetRipple =
            rPool.find((r) => !r.active) ||
            rPool.reduce((oldest, cur) => (cur.opacity < oldest.opacity ? cur : oldest))

          targetRipple.x = rx
          targetRipple.z = rz
          targetRipple.radius = 1
          targetRipple.maxRadius = layout.isSmallRepo ? 20 : 14
          targetRipple.opacity = 0.95
          targetRipple.active = true
          targetRipple.color.set(matchCount > 0 ? '#00f0ff' : '#f43f5e')
        }
      }
    }

    // 3. Camera Earthquake shake (disabled if reducedMotion)
    if (earthquakeIntensityRef.current > 0.01 && !useSettingsStore.getState().reducedMotion) {
      const shake = earthquakeIntensityRef.current
      camera.position.x += (Math.random() - 0.5) * shake * 1.6
      camera.position.y += (Math.random() - 0.5) * shake * 1.6
      camera.position.z += (Math.random() - 0.5) * shake * 1.6
      earthquakeIntensityRef.current *= Math.exp(-delta * 6.5)
    }

    // 4. Update shockwave ring
    if (shockwaveRef.current && shockwaveDataRef.current.active) {
      const sw = shockwaveDataRef.current
      sw.radius += delta * 65
      sw.opacity = Math.max(0, 1 - sw.radius / 90)
      shockwaveRef.current.scale.set(sw.radius, sw.radius, 1)
      const mat = shockwaveRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = sw.opacity
      if (sw.opacity <= 0.01) sw.active = false
    }

    // 5. Update building instances
    if (meshRef.current) {
      const dummy = new THREE.Object3D()
      const isSmall = layout.isSmallRepo
      const baseVoxelWidth = isSmall ? 2.4 : 1.3
      const voxelH = isSmall ? 1.0 : 0.8
      const vStep = voxelH + 0.04

      const speedFactor = Math.min(1, delta * 15 * Math.sqrt(timeline.speed))

      buildingMeta.forEach((meta, i) => {
        const { slot, touchCurve, baseColor } = meta
        const birth = slot.birthCommitIndex
        const death = slot.deathCommitIndex

        if (currentIndex < birth) {
          // Unborn: hidden
          dummy.position.set(slot.x, -5, slot.z)
          dummy.scale.set(0, 0, 0)
          dummy.updateMatrix()
          meshRef.current!.setMatrixAt(i, dummy.matrix)
          return
        }

        const safeIndex = Math.min(totalCommits - 1, Math.max(0, currentFloor))
        const touches = touchCurve[safeIndex] || 1

        // Target height
        let targetH = Math.max(1, 1 + Math.floor(Math.sqrt(touches) * 2.8))

        // Birth pop rise: easeOutBack
        const age = currentIndex - birth
        let popScale = 1.0
        if (age < 1.0) {
          const c1 = 1.70158
          const c3 = c1 + 1
          const t = Math.max(0, Math.min(1, age))
          popScale = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
        }

        // Deleted crumble: sink down and shrink
        let crumbleY = 0
        let isDead = false
        if (death !== null && currentIndex >= death) {
          isDead = true
          const deathAge = currentIndex - death
          crumbleY = -deathAge * 3.5
          popScale = Math.max(0, 1 - deathAge * 0.7)
          targetH = 1
        }

        // Animate height smoothly
        meta.currentHeight += (targetH - meta.currentHeight) * speedFactor

        const h = Math.max(0.2, meta.currentHeight)
        const totalHeight = h * vStep
        const posY = totalHeight / 2 + crumbleY

        dummy.position.set(slot.x, posY, slot.z)
        dummy.scale.set(baseVoxelWidth * popScale, totalHeight * popScale, baseVoxelWidth * popScale)
        dummy.updateMatrix()
        meshRef.current!.setMatrixAt(i, dummy.matrix)

        // Color with territory dimming
        const color = baseColor.clone()
        const selectedAuthor = timeline.selectedContributor
        const dominantDId = selectedAuthor ? territoryMap.get(selectedAuthor) : null
        const isDimmed = dominantDId !== null && slot.districtId !== dominantDId

        if (isDead) {
          color.set('#1a1c29')
        } else if (isDimmed) {
          color.multiplyScalar(0.2) // Dim non-selected territory
        } else {
          color.multiplyScalar(0.9 + Math.min(1, touches / 8) * 0.4)
        }
        meshRef.current!.setColorAt(i, color)

        // Rooftop antenna beacon
        if (roofMeshRef.current) {
          if (!isDead && touches >= 2 && popScale > 0.5) {
            dummy.position.set(slot.x, totalHeight + 0.6 + crumbleY, slot.z)
            dummy.scale.set(baseVoxelWidth * 0.35, 1.0, baseVoxelWidth * 0.35)
            dummy.updateMatrix()
            roofMeshRef.current.setMatrixAt(i, dummy.matrix)
            roofMeshRef.current.setColorAt(i, new THREE.Color('#38bdf8'))
          } else {
            dummy.scale.set(0, 0, 0)
            dummy.updateMatrix()
            roofMeshRef.current.setMatrixAt(i, dummy.matrix)
          }
        }
      })

      meshRef.current.instanceMatrix.needsUpdate = true
      if (meshRef.current.instanceColor) {
        meshRef.current.instanceColor.needsUpdate = true
      }
      if (roofMeshRef.current) {
        roofMeshRef.current.instanceMatrix.needsUpdate = true
        if (roofMeshRef.current.instanceColor) {
          roofMeshRef.current.instanceColor.needsUpdate = true
        }
      }
    }
  })

  const buildingCount = layout.buildings.length

  return (
    <group>
      {/* All Buildings InstancedMesh */}
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, buildingCount]}
        castShadow
        receiveShadow
        onPointerMove={(e) => {
          e.stopPropagation()
          if (e.instanceId === undefined) return
          const b = layout.buildings[e.instanceId]
          if (!b) return
          const currentIdx = Math.min(
            totalCommits - 1,
            Math.max(0, Math.floor(useTimelineStore.getState().currentCommitIndex))
          )
          if (
            b.birthCommitIndex > currentIdx ||
            (b.deathCommitIndex != null && b.deathCommitIndex <= currentIdx)
          ) {
            useUIStore.getState().setHoveredBuilding(null)
            return
          }
          const touchesSoFar = buildingMeta[e.instanceId]?.touchCurve[currentIdx] || 1
          const districtObj = layout.districts.find((d) => d.id === b.districtId)

          let lastAuthor = 'Unknown'
          for (let c = currentIdx; c >= 0; c--) {
            const commit = data.commits[c]
            if (commit && commit.files.some((f) => f.path === b.path)) {
              lastAuthor = commit.author
              break
            }
          }

          useUIStore.getState().setHoveredBuilding({
            path: b.path,
            touches: touchesSoFar,
            lastAuthor,
            districtName: districtObj?.name || b.districtId,
            screenX: e.clientX,
            screenY: e.clientY,
          })
        }}
        onPointerOut={() => {
          useUIStore.getState().setHoveredBuilding(null)
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.25} metalness={0.4} toneMapped={false} />
      </instancedMesh>

      {/* Rooftop Beacons InstancedMesh */}
      <instancedMesh
        ref={roofMeshRef}
        args={[undefined, undefined, buildingCount]}
      >
        <cylinderGeometry args={[0.25, 0.5, 1, 8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* Earthquake Mega Shockwave Ring */}
      <mesh
        ref={shockwaveRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[centerX, 0.05, centerZ]}
      >
        <ringGeometry args={[0.8, 2.5, 64]} />
        <meshBasicMaterial
          color="#ff0055"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Ground Pulse Ripples Pool */}
      {ripplesRef.current.map((_, idx) => (
        <RippleMesh key={idx} index={idx} ripplesRef={ripplesRef} />
      ))}

      {/* Contributor Avatars */}
      <Avatars data={data} layout={layout} />

      {/* District Platforms */}
      {layout.districts.map((district) => {
        const selectedAuthor = useTimelineStore.getState().selectedContributor
        const dominantDId = selectedAuthor ? territoryMap.get(selectedAuthor) : null
        const isDimmed = dominantDId !== null && district.id !== dominantDId

        return (
          <group key={district.id} position={[district.x, 0, district.z]}>
            <mesh
              position={[0, -0.3, 0]}
              onClick={(e) => {
                e.stopPropagation()
                const districtBuildings = layout.buildings.filter(
                  (b) => b.districtId === district.id
                )
                const currentIdx = Math.min(
                  totalCommits - 1,
                  Math.max(0, Math.floor(useTimelineStore.getState().currentCommitIndex))
                )

                let totalTouches = 0
                const authorMap = new Map<string, number>()
                const files: string[] = []

                districtBuildings.forEach((b) => {
                  files.push(b.path)
                  b.touchCommitIndices.forEach((cIdx) => {
                    if (cIdx <= currentIdx) {
                      totalTouches++
                      const commit = data.commits[cIdx]
                      if (commit) {
                        authorMap.set(
                          commit.author,
                          (authorMap.get(commit.author) || 0) + 1
                        )
                      }
                    }
                  })
                })

                const topContribs = Array.from(authorMap.entries())
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([name, count]) => ({ name, count }))

                useUIStore.getState().setSelectedDistrict({
                  id: district.id,
                  name: district.name,
                  color: district.color,
                  fileCount: districtBuildings.length,
                  totalTouches,
                  topContributors: topContribs,
                  recentFiles: files.slice(0, 20),
                  centerX: district.x,
                  centerZ: district.z,
                  width: district.width,
                  depth: district.depth,
                })

                useUIStore.getState().focusCamera(
                  [district.x, 0, district.z],
                  [
                    district.x,
                    Math.max(16, district.width * 1.1),
                    district.z + Math.max(22, district.depth * 1.3),
                  ]
                )
              }}
            >
              <boxGeometry args={[district.width, 0.6, district.depth]} />
              <meshStandardMaterial
                color={isDimmed ? '#06070e' : '#090a16'}
                roughness={0.85}
                metalness={0.15}
              />
            </mesh>

            <lineSegments position={[0, 0.01, 0]}>
              <edgesGeometry
                attach="geometry"
                args={[new THREE.BoxGeometry(district.width, 0.02, district.depth)]}
              />
              <lineBasicMaterial
                attach="material"
                color={isDimmed ? '#1e293b' : district.color}
                linewidth={isDimmed ? 1 : 2}
              />
            </lineSegments>

            <mesh position={[0, 0.005, 0]}>
              <planeGeometry args={[district.width - 0.4, district.depth - 0.4]} />
              <meshBasicMaterial
                color={district.color}
                transparent
                opacity={isDimmed ? 0.01 : 0.06}
                side={THREE.DoubleSide}
              />
            </mesh>

            <Html
              position={[0, 1.4, district.depth / 2 + 1.8]}
              center
              distanceFactor={32}
              transform
              rotation={[-Math.PI / 4, 0, 0]}
            >
              <div
                style={{
                  display:
                    isLandingOpen ||
                    useRepoStore.getState().isLoading ||
                    useUIStore.getState().isShareModalOpen ||
                    useUIStore.getState().isRecordModalOpen ||
                    useUIStore.getState().isHelpOpen
                      ? 'none'
                      : 'block',
                  fontFamily: "'Press Start 2P', monospace",
                  borderColor: isDimmed ? '#334155' : district.color,
                  boxShadow: isDimmed
                    ? 'none'
                    : `0 0 10px ${district.color}55, inset 0 0 6px ${district.color}33`,
                  color: isDimmed ? '#475569' : district.color,
                }}
                className="px-2.5 py-1.5 bg-[#070814]/95 border text-[8px] font-black tracking-widest rounded select-none whitespace-nowrap backdrop-blur-sm pointer-events-none transition-all"
              >
                {district.name}
              </div>
            </Html>
          </group>
        )
      })}
    </group>
  )
}

function RippleMesh({
  index,
  ripplesRef,
}: {
  index: number
  ripplesRef: React.RefObject<Ripple[]>
}) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (!meshRef.current || !ripplesRef.current) return
    const ripple = ripplesRef.current[index]
    if (!ripple || !ripple.active) {
      meshRef.current.visible = false
      return
    }

    ripple.radius += delta * 22
    ripple.opacity = Math.max(0, 1 - ripple.radius / ripple.maxRadius)

    meshRef.current.visible = true
    meshRef.current.position.set(ripple.x, 0.03, ripple.z)
    meshRef.current.scale.set(ripple.radius, ripple.radius, 1)

    const mat = meshRef.current.material as THREE.MeshBasicMaterial
    mat.color.copy(ripple.color)
    mat.opacity = ripple.opacity

    if (ripple.opacity <= 0.02) {
      ripple.active = false
    }
  })

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.5, 1.2, 32]} />
      <meshBasicMaterial
        color="#00f0ff"
        transparent
        opacity={0}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
