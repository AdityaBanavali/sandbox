import seedrandom from 'seedrandom'
import type { IngestedRepoData } from '../data/types'

export interface DistrictLayout {
  id: string
  name: string
  x: number
  z: number
  width: number
  depth: number
  color: string
  fileCount: number
}

export interface BuildingSlot {
  id: string
  path: string
  districtId: string
  x: number
  z: number
  size: number
  birthCommitIndex: number
  deathCommitIndex: number | null
  touchCommitIndices: number[]
  touchCount: number
}

export interface CityLayout {
  repo: string
  isSmallRepo: boolean
  districts: DistrictLayout[]
  buildings: BuildingSlot[]
  bounds: {
    minX: number
    maxX: number
    minZ: number
    maxZ: number
  }
}

const DISTRICT_PALETTE = [
  '#00f0ff', // Cyan
  '#ff0055', // Neon Pink
  '#ffe600', // Electric Yellow
  '#00ff66', // Matrix Green
  '#a855f7', // Violet
  '#ff7700', // Blaze Orange
  '#38bdf8', // Sky Blue
  '#f43f5e', // Cyber Rose
  '#10b981', // Emerald
  '#8b5cf6', // Indigo
  '#06b6d4', // Teal
  '#eab308', // Amber
  '#ec4899', // Hot Pink
  '#14b8a6', // Turquoise
]

export function getDistrictColorHSL(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i)
    hash |= 0
  }
  const hue = Math.abs(hash) % 360
  // Retro-synthwave vibrant saturation & lightness
  return `hsl(${hue}, 92%, 56%)`
}

interface FileHistoryMeta {
  path: string
  districtId: string
  birthCommitIndex: number
  deathCommitIndex: number | null
  touchCommitIndices: number[]
}

interface Rect {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

function checkRectOverlap(r1: Rect, r2: Rect): boolean {
  return !(
    r1.maxX <= r2.minX ||
    r1.minX >= r2.maxX ||
    r1.maxZ <= r2.minZ ||
    r1.minZ >= r2.maxZ
  )
}

export function computeLayout(history: IngestedRepoData): CityLayout {
  const rng = seedrandom(history.repo || 'chronograph')

  // 1. Gather all files and trace full lifecycle & touches
  const fileMap = new Map<string, FileHistoryMeta>()

  history.commits.forEach((commit, commitIdx) => {
    commit.files.forEach((fileChange) => {
      const { path, status, oldPath } = fileChange
      if (!path) return

      // Handle rename: mark oldPath as deleted at this commit
      if (status === 'R' && oldPath && fileMap.has(oldPath)) {
        const oldEntry = fileMap.get(oldPath)!
        oldEntry.deathCommitIndex = commitIdx
      }

      if (status === 'D') {
        if (fileMap.has(path)) {
          const entry = fileMap.get(path)!
          entry.deathCommitIndex = commitIdx
          if (!entry.touchCommitIndices.includes(commitIdx)) {
            entry.touchCommitIndices.push(commitIdx)
          }
        }
        return
      }

      // Add or Modify
      const districtId = path.includes('/') ? path.split('/')[0] : 'root'
      if (!fileMap.has(path)) {
        fileMap.set(path, {
          path,
          districtId,
          birthCommitIndex: commitIdx,
          deathCommitIndex: null,
          touchCommitIndices: [commitIdx],
        })
      } else {
        const entry = fileMap.get(path)!
        // If file was previously deleted and recreated
        if (entry.deathCommitIndex !== null) {
          entry.deathCommitIndex = null
        }
        if (!entry.touchCommitIndices.includes(commitIdx)) {
          entry.touchCommitIndices.push(commitIdx)
        }
      }
    })
  })

  // 2. Group files by top-level district
  const districtFilesMap = new Map<string, FileHistoryMeta[]>()
  fileMap.forEach((meta) => {
    if (!districtFilesMap.has(meta.districtId)) {
      districtFilesMap.set(meta.districtId, [])
    }
    districtFilesMap.get(meta.districtId)!.push(meta)
  })

  // Sort files within each district alphabetically so subdirectories cluster together
  districtFilesMap.forEach((files) => {
    files.sort((a, b) => a.path.localeCompare(b.path))
  })

  // Sort districts by file count descending (largest at center)
  const sortedDistricts = Array.from(districtFilesMap.entries()).sort(
    (a, b) => b[1].length - a[1].length
  )

  // Shuffle color palette deterministically
  const colors = [...DISTRICT_PALETTE]
  for (let i = colors.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[colors[i], colors[j]] = [colors[j], colors[i]]
  }

  // 3. Grid sizing constants: scale up dramatically when repo is small
  const isSmallRepo = history.commits.length < 150 || fileMap.size < 80
  const BUILDING_SIZE = isSmallRepo ? 2.6 : 1.4
  const CELL_SIZE = isSmallRepo ? 3.4 : 2.0
  const DISTRICT_PADDING = isSmallRepo ? 3.2 : 2.0
  const DISTRICT_GAP = isSmallRepo ? 7.0 : 5.0

  interface PreDistrict {
    id: string
    name: string
    files: FileHistoryMeta[]
    cols: number
    rows: number
    width: number
    depth: number
    color: string
  }

  const preDistricts: PreDistrict[] = sortedDistricts.map(([name, files]) => {
    const fileCount = files.length
    // Aspect ratio roughly 1:1 to 4:3
    const cols = Math.max(1, Math.ceil(Math.sqrt(fileCount * 1.2)))
    const rows = Math.max(1, Math.ceil(fileCount / cols))
    const width = cols * CELL_SIZE + DISTRICT_PADDING * 2
    const depth = rows * CELL_SIZE + DISTRICT_PADDING * 2
    const color = getDistrictColorHSL(name)

    return {
      id: `district_${name}`,
      name,
      files,
      cols,
      rows,
      width,
      depth,
      color,
    }
  })

  // 4. Spiral packing for districts to prevent overlap
  const placedRects: Rect[] = []
  const districts: DistrictLayout[] = []
  const buildings: BuildingSlot[] = []

  preDistricts.forEach((pd, dIndex) => {
    let centerX = 0
    let centerZ = 0

    if (dIndex === 0) {
      // First district sits at the origin
      centerX = 0
      centerZ = 0
    } else {
      // Spiral search outward
      let theta = (dIndex * 1.5) % (Math.PI * 2)
      let radius = 6
      const angleStep = 0.15
      const radiusStep = 0.35
      let placed = false

      while (!placed && radius < 2000) {
        theta += angleStep
        radius += radiusStep * (angleStep / (Math.PI * 2))

        const candidateX = Math.round(Math.cos(theta) * radius * 10) / 10
        const candidateZ = Math.round(Math.sin(theta) * radius * 10) / 10

        const candidateRect: Rect = {
          minX: candidateX - pd.width / 2 - DISTRICT_GAP / 2,
          maxX: candidateX + pd.width / 2 + DISTRICT_GAP / 2,
          minZ: candidateZ - pd.depth / 2 - DISTRICT_GAP / 2,
          maxZ: candidateZ + pd.depth / 2 + DISTRICT_GAP / 2,
        }

        const collides = placedRects.some((existing) =>
          checkRectOverlap(candidateRect, existing)
        )

        if (!collides) {
          centerX = candidateX
          centerZ = candidateZ
          placed = true
        }
      }
    }

    const rect: Rect = {
      minX: centerX - pd.width / 2 - DISTRICT_GAP / 2,
      maxX: centerX + pd.width / 2 + DISTRICT_GAP / 2,
      minZ: centerZ - pd.depth / 2 - DISTRICT_GAP / 2,
      maxZ: centerZ + pd.depth / 2 + DISTRICT_GAP / 2,
    }
    placedRects.push(rect)

    districts.push({
      id: pd.id,
      name: pd.name,
      x: centerX,
      z: centerZ,
      width: pd.width,
      depth: pd.depth,
      color: pd.color,
      fileCount: pd.files.length,
    })

    // 5. Place buildings within district grid
    const innerStartX = centerX - (pd.cols * CELL_SIZE) / 2 + CELL_SIZE / 2
    const innerStartZ = centerZ - (pd.rows * CELL_SIZE) / 2 + CELL_SIZE / 2

    pd.files.forEach((fileMeta, fIdx) => {
      const col = fIdx % pd.cols
      const row = Math.floor(fIdx / pd.cols)

      const bx = innerStartX + col * CELL_SIZE
      const bz = innerStartZ + row * CELL_SIZE

      buildings.push({
        id: `building_${fileMeta.path}`,
        path: fileMeta.path,
        districtId: pd.id,
        x: Math.round(bx * 100) / 100,
        z: Math.round(bz * 100) / 100,
        size: BUILDING_SIZE,
        birthCommitIndex: fileMeta.birthCommitIndex,
        deathCommitIndex: fileMeta.deathCommitIndex,
        touchCommitIndices: fileMeta.touchCommitIndices,
        touchCount: fileMeta.touchCommitIndices.length,
      })
    })
  })

  // 6. Calculate total city bounds
  let minX = 0
  let maxX = 0
  let minZ = 0
  let maxZ = 0

  if (districts.length > 0) {
    minX = Math.min(...districts.map((d) => d.x - d.width / 2))
    maxX = Math.max(...districts.map((d) => d.x + d.width / 2))
    minZ = Math.min(...districts.map((d) => d.z - d.depth / 2))
    maxZ = Math.max(...districts.map((d) => d.z + d.depth / 2))
  }

  return {
    repo: history.repo,
    isSmallRepo,
    districts,
    buildings,
    bounds: { minX, maxX, minZ, maxZ },
  }
}
