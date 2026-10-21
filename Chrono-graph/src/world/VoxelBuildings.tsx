import React, { useMemo, useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import type { CityLayout } from './layout'

interface VoxelBuildingsProps {
  layout: CityLayout
  targetCommitIndex?: number // if omitted, uses final state
}

export const VoxelBuildings: React.FC<VoxelBuildingsProps> = ({
  layout,
  targetCommitIndex,
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const roofMeshRef = useRef<THREE.InstancedMesh>(null)

  // Calculate voxel stacks for all buildings at target state
  const { voxelInstances, roofInstances, totalVoxels, totalRoofs } = useMemo(() => {
    interface VoxelData {
      x: number
      y: number
      z: number
      color: THREE.Color
      scale: number
    }

    interface RoofData {
      x: number
      y: number
      z: number
      color: THREE.Color
      scale: number
    }

    const voxels: VoxelData[] = []
    const roofs: RoofData[] = []

    const isSmall = layout.isSmallRepo
    const voxelWidth = isSmall ? 2.2 : 1.25
    const voxelHeight = isSmall ? 1.0 : 0.75
    const vGap = 0.04

    layout.buildings.forEach((b) => {
      // Check if alive at target commit index
      const commitLimit =
        targetCommitIndex !== undefined ? targetCommitIndex : Infinity
      const isBorn = b.birthCommitIndex <= commitLimit
      const isDead =
        b.deathCommitIndex !== null && b.deathCommitIndex <= commitLimit

      if (!isBorn) return

      const touches =
        targetCommitIndex !== undefined
          ? b.touchCommitIndices.filter((idx) => idx <= targetCommitIndex).length
          : b.touchCount

      // Height in stacked voxels = f(touch count)
      const stackCount = isDead
        ? 1
        : Math.max(1, Math.min(22, 1 + Math.floor(Math.sqrt(touches) * 3)))

      const district = layout.districts.find((d) => d.id === b.districtId)
      const baseColorHex = isDead ? '#1c1e28' : district?.color || '#00f0ff'
      const baseColor = new THREE.Color(baseColorHex)

      for (let lvl = 0; lvl < stackCount; lvl++) {
        const y = (lvl + 0.5) * (voxelHeight + vGap)
        const isTop = lvl === stackCount - 1

        // Retro gradient: base is deep, climbing voxels get brighter & emissive
        const color = baseColor.clone()
        if (isDead) {
          color.set('#161824')
        } else {
          const lightnessFactor = 0.7 + (lvl / Math.max(1, stackCount)) * 0.5
          color.multiplyScalar(lightnessFactor)
          if (isTop) {
            color.addScalar(0.2) // highlight top voxel
          }
        }

        voxels.push({
          x: b.x,
          y,
          z: b.z,
          color,
          scale: voxelWidth,
        })
      }

      // Add rooftop neon beacon on active buildings with touches >= 2
      if (!isDead && touches >= 2) {
        const topY = stackCount * (voxelHeight + vGap) + 0.4
        const roofColor = baseColor.clone().add(new THREE.Color('#33ffff'))
        roofs.push({
          x: b.x,
          y: topY,
          z: b.z,
          color: roofColor,
          scale: voxelWidth * 0.35,
        })
      }
    })

    return {
      voxelInstances: voxels,
      roofInstances: roofs,
      totalVoxels: voxels.length,
      totalRoofs: roofs.length,
    }
  }, [layout, targetCommitIndex])

  // Populate InstancedMesh buffers
  useLayoutEffect(() => {
    if (!meshRef.current) return

    const dummy = new THREE.Object3D()
    const voxelH = layout.isSmallRepo ? 1.0 : 0.75

    voxelInstances.forEach((inst, i) => {
      dummy.position.set(inst.x, inst.y, inst.z)
      dummy.scale.set(inst.scale, voxelH, inst.scale)
      dummy.updateMatrix()

      meshRef.current!.setMatrixAt(i, dummy.matrix)
      meshRef.current!.setColorAt(i, inst.color)
    })

    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true
    }
  }, [voxelInstances, layout.isSmallRepo])

  useLayoutEffect(() => {
    if (!roofMeshRef.current) return

    const dummy = new THREE.Object3D()

    roofInstances.forEach((inst, i) => {
      dummy.position.set(inst.x, inst.y, inst.z)
      dummy.scale.set(inst.scale, 0.8, inst.scale)
      dummy.updateMatrix()

      roofMeshRef.current!.setMatrixAt(i, dummy.matrix)
      roofMeshRef.current!.setColorAt(i, inst.color)
    })

    roofMeshRef.current.instanceMatrix.needsUpdate = true
    if (roofMeshRef.current.instanceColor) {
      roofMeshRef.current.instanceColor.needsUpdate = true
    }
  }, [roofInstances])

  if (totalVoxels === 0) return null

  return (
    <group>
      {/* Voxel Cubes InstancedMesh */}
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, totalVoxels]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          roughness={0.25}
          metalness={0.4}
          toneMapped={false}
        />
      </instancedMesh>

      {/* Rooftop Glowing Beacons InstancedMesh */}
      {totalRoofs > 0 && (
        <instancedMesh
          ref={roofMeshRef}
          args={[undefined, undefined, totalRoofs]}
        >
          <cylinderGeometry args={[0.3, 0.6, 1, 8]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
      )}
    </group>
  )
}
