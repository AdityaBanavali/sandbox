import React, { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { IngestedRepoData } from '../data/types'
import type { CityLayout } from './layout'
import { useTimelineStore, useUIStore } from '../store'

interface AvatarsProps {
  data: IngestedRepoData
  layout: CityLayout
}

// Procedural 16x16 pixel-art 2-frame generator
function generatePixelAvatar(
  name: string,
  shirtColorHex: string
): [THREE.CanvasTexture, THREE.CanvasTexture] {
  let seed = 0
  for (let i = 0; i < name.length; i++) {
    seed = (seed << 5) - seed + name.charCodeAt(i)
  }
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }

  const skinTones = ['#ffd1b3', '#fcd0a1', '#e0ac69', '#c68642', '#8d5524']
  const hairColors = [
    '#1a1105',
    '#4a2912',
    '#b55214',
    '#e6be8a',
    '#8a8a8a',
    '#00f0ff',
    '#ff0055',
    '#ffe600',
  ]
  const pantColors = ['#1e293b', '#1e3a8a', '#334155']

  const skin = skinTones[Math.floor(rand() * skinTones.length)]
  const hair = hairColors[Math.floor(rand() * hairColors.length)]
  const pants = pantColors[Math.floor(rand() * pantColors.length)]
  const shirt = shirtColorHex || '#00f0ff'

  function createFrame(frame: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = 16
    canvas.height = 16
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false

    // Hair
    ctx.fillStyle = hair
    ctx.fillRect(4, 2, 8, 4)
    ctx.fillRect(3, 4, 2, 4)
    ctx.fillRect(11, 4, 2, 4)

    // Skin
    ctx.fillStyle = skin
    ctx.fillRect(5, 4, 6, 4)
    ctx.fillRect(6, 8, 4, 1)

    // Eyes
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(6, 5, 1, 1)
    ctx.fillRect(9, 5, 1, 1)

    // Shirt
    ctx.fillStyle = shirt
    ctx.fillRect(5, 9, 6, 4)
    ctx.fillRect(3, 9, 2, 3)
    ctx.fillRect(11, 9, 2, 3)

    // Hands
    ctx.fillStyle = skin
    ctx.fillRect(3, 12, 2, 1)
    ctx.fillRect(11, 12, 2, 1)

    // Pants & Legs
    ctx.fillStyle = pants
    if (frame === 0) {
      ctx.fillRect(5, 13, 2, 2)
      ctx.fillRect(9, 13, 2, 2)
    } else {
      ctx.fillRect(4, 13, 3, 2)
      ctx.fillRect(9, 13, 3, 2)
    }

    // Shoes
    ctx.fillStyle = '#05070e'
    if (frame === 0) {
      ctx.fillRect(5, 15, 2, 1)
      ctx.fillRect(9, 15, 2, 1)
    } else {
      ctx.fillRect(4, 15, 3, 1)
      ctx.fillRect(9, 15, 3, 1)
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.magFilter = THREE.NearestFilter
    tex.minFilter = THREE.NearestFilter
    tex.generateMipmaps = false
    return tex
  }

  return [createFrame(0), createFrame(1)]
}

interface ContributorAvatarData {
  name: string
  color: string
  homeDistrictId: string
  homePos: THREE.Vector3
  textures: [THREE.CanvasTexture, THREE.CanvasTexture]
  authoredCommitIndices: number[]
}

export const Avatars: React.FC<AvatarsProps> = ({ data, layout }) => {
  const { selectedContributor, setSelectedContributor } = useTimelineStore()

  // Calculate top 12 contributors & dominant home territory
  const avatarList = useMemo<ContributorAvatarData[]>(() => {
    return data.contributors.slice(0, 12).map((contrib, idx) => {
      // Find all commits authored by this contributor
      const authoredIndices: number[] = []
      const districtTally = new Map<string, number>()

      data.commits.forEach((commit, cIdx) => {
        if (commit.author === contrib.name) {
          authoredIndices.push(cIdx)
          commit.files.forEach((file) => {
            const b = layout.buildings.find((item) => item.path === file.path)
            if (b) {
              districtTally.set(b.districtId, (districtTally.get(b.districtId) || 0) + 1)
            }
          })
        }
      })

      // Find district with highest touches
      let dominantDistrictId = layout.districts[0]?.id || 'root'
      let maxTouches = -1
      districtTally.forEach((count, dId) => {
        if (count > maxTouches) {
          maxTouches = count
          dominantDistrictId = dId
        }
      })

      const district = layout.districts.find((d) => d.id === dominantDistrictId)
      const dx = district?.x || 0
      const dz = district?.z || 0

      // Home position on the district platform with slight radial spread
      const angle = (idx / 12) * Math.PI * 2
      const spread = layout.isSmallRepo ? 3.0 : 2.0
      const homePos = new THREE.Vector3(
        dx + Math.cos(angle) * spread,
        0.8,
        dz + Math.sin(angle) * spread
      )

      const textures = generatePixelAvatar(contrib.name, contrib.color)

      return {
        name: contrib.name,
        color: contrib.color,
        homeDistrictId: dominantDistrictId,
        homePos,
        textures,
        authoredCommitIndices: authoredIndices,
      }
    })
  }, [data, layout])

  return (
    <group>
      {avatarList.map((avatar) => (
        <AvatarSpriteItem
          key={avatar.name}
          avatar={avatar}
          data={data}
          layout={layout}
          isSelected={selectedContributor === avatar.name}
          onSelect={() =>
            setSelectedContributor(
              selectedContributor === avatar.name ? null : avatar.name
            )
          }
        />
      ))}
    </group>
  )
}

interface AvatarSpriteItemProps {
  avatar: ContributorAvatarData
  data: IngestedRepoData
  layout: CityLayout
  isSelected: boolean
  onSelect: () => void
}

const AvatarSpriteItem: React.FC<AvatarSpriteItemProps> = ({
  avatar,
  data,
  layout,
  isSelected,
  onSelect,
}) => {
  const isLandingOpen = useUIStore((s) => s.isLandingOpen)
  const spriteRef = useRef<THREE.Sprite>(null)
  const posRef = useRef(avatar.homePos.clone())
  const floatingTextRef = useRef<HTMLDivElement>(null)
  const floatingTextDataRef = useRef({ text: '', opacity: 0, y: 0 })

  useFrame((state, delta) => {
    if (!spriteRef.current) return

    const currentCommitFloat = useTimelineStore.getState().currentCommitIndex
    const currentFloor = Math.floor(currentCommitFloat)
    const commit = data.commits[currentFloor]

    const isCommitting = commit?.author === avatar.name

    // 1. Determine target position
    let targetPos = avatar.homePos
    let touchedCount = 0

    if (isCommitting && commit) {
      touchedCount = commit.files.length
      const firstTouched = commit.files[0]
      const b = layout.buildings.find((item) => item.path === firstTouched?.path)
      if (b) {
        // Target is slightly in front of the touched building
        targetPos = new THREE.Vector3(b.x + 0.6, 1.2, b.z + 0.6)
      }
    }

    // 2. Smooth walk easing
    posRef.current.lerp(targetPos, Math.min(1, delta * 7.5))

    const dist = posRef.current.distanceTo(targetPos)
    const isMoving = dist > 0.35

    // 2-frame walking bob
    const frame = isMoving ? Math.floor(state.clock.elapsedTime * 8) % 2 : 0
    const spriteMat = spriteRef.current.material
    spriteMat.map = avatar.textures[frame]

    const bobY = isMoving ? Math.abs(Math.sin(state.clock.elapsedTime * 14)) * 0.3 : 0
    const yPos = posRef.current.y + bobY

    spriteRef.current.position.set(posRef.current.x, yPos, posRef.current.z)

    // Hammer animation when at target building
    if (isCommitting && dist <= 0.45) {
      spriteRef.current.material.rotation = Math.sin(state.clock.elapsedTime * 20) * 0.25
      floatingTextDataRef.current = {
        text: `+${touchedCount}`,
        opacity: 1.0,
        y: 2.2,
      }
    } else {
      spriteRef.current.material.rotation = 0
    }

    // Floating +N text decay
    if (floatingTextRef.current) {
      const ft = floatingTextDataRef.current
      if (ft.opacity > 0) {
        ft.y += delta * 1.5
        ft.opacity = Math.max(0, ft.opacity - delta * 1.8)
        floatingTextRef.current.style.opacity = String(ft.opacity)
        floatingTextRef.current.style.transform = `translateY(-${(ft.y - 2.2) * 20}px)`
        floatingTextRef.current.textContent = ft.text
      } else {
        floatingTextRef.current.style.opacity = '0'
      }
    }

    // 3. Ghost mode: inactive after 15 commits of silence
    let lastAuthoredCommit = -1
    for (let i = avatar.authoredCommitIndices.length - 1; i >= 0; i--) {
      if (avatar.authoredCommitIndices[i] <= currentFloor) {
        lastAuthoredCommit = avatar.authoredCommitIndices[i]
        break
      }
    }

    const silenceCommits =
      lastAuthoredCommit === -1
        ? currentFloor
        : currentFloor - lastAuthoredCommit

    const isGhost = silenceCommits > 15
    const targetOpacity = isGhost ? 0.3 : isSelected ? 1.0 : 0.95
    spriteMat.opacity = THREE.MathUtils.lerp(spriteMat.opacity, targetOpacity, delta * 6)
  })

  const spriteSize = layout.isSmallRepo ? 2.8 : 2.0

  return (
    <group>
      <sprite
        ref={spriteRef}
        scale={[spriteSize, spriteSize, 1]}
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
      >
        <spriteMaterial
          map={avatar.textures[0]}
          transparent
          opacity={0.95}
          toneMapped={false}
        />
      </sprite>

      {/* Floating Pixel-Font Name Tag & Floating +N Hammer Notification */}
      <Html
        position={[avatar.homePos.x, 2.5, avatar.homePos.z]}
        center
        distanceFactor={24}
      >
        <div
          style={{
            display:
              isLandingOpen ||
              useUIStore.getState().isShareModalOpen ||
              useUIStore.getState().isRecordModalOpen ||
              useUIStore.getState().isHelpOpen
                ? 'none'
                : 'flex',
          }}
          className="flex-col items-center pointer-events-none select-none"
        >
            {/* Floating +N Hammer Count */}
            <div
              ref={floatingTextRef}
              style={{
                fontFamily: "'Press Start 2P', monospace",
                color: '#ffe600',
                textShadow: '0 0 8px #ff0055',
              }}
              className="text-[10px] font-black opacity-0 transition-opacity whitespace-nowrap mb-1"
            >
              +1
            </div>

            {/* Name Tag Badge */}
            <button
              type="button"
              onClick={onSelect}
              style={{
                fontFamily: "'Press Start 2P', monospace",
                borderColor: avatar.color,
                boxShadow: isSelected
                  ? `0 0 16px ${avatar.color}, inset 0 0 8px ${avatar.color}`
                  : `0 0 6px ${avatar.color}44`,
                color: isSelected ? '#ffffff' : avatar.color,
                backgroundColor: isSelected ? `${avatar.color}44` : '#070815e6',
              }}
              className="pointer-events-auto px-2 py-0.5 border text-[7px] tracking-tight rounded cursor-pointer transition active:scale-95 whitespace-nowrap shadow-lg backdrop-blur-sm"
            >
              {avatar.name.split(' ')[0]}
            </button>
          </div>
        </Html>
      </group>
  )
}
