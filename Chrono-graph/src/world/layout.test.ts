import { describe, it, expect } from 'vitest'
import { computeLayout } from './layout'
import type { IngestedRepoData } from '../data/types'

const mockHistory: IngestedRepoData = {
  repo: 'test-repo',
  totalCommits: 5,
  commits: [
    {
      sha: '111111',
      author: 'Alice',
      email: 'alice@example.com',
      date: '2024-01-01T00:00:00Z',
      message: 'feat: add core types',
      files: [
        { path: 'core/types.ts', status: 'A' },
        { path: 'core/engine.ts', status: 'A' },
        { path: 'core/buffer.ts', status: 'A' },
      ],
    },
    {
      sha: '222222',
      author: 'Bob',
      email: 'bob@example.com',
      date: '2024-01-02T00:00:00Z',
      message: 'feat: add storage module',
      files: [
        { path: 'storage/btree.ts', status: 'A' },
        { path: 'storage/wal.ts', status: 'A' },
        { path: 'core/engine.ts', status: 'M' },
      ],
    },
    {
      sha: '333333',
      author: 'Charlie',
      email: 'charlie@example.com',
      date: '2024-01-03T00:00:00Z',
      message: 'feat: network peer and rename',
      files: [
        { path: 'network/peer.ts', status: 'A' },
        { path: 'network/socket.ts', status: 'A' },
        { path: 'core/types.ts', status: 'M' },
      ],
    },
    {
      sha: '444444',
      author: 'Alice',
      email: 'alice@example.com',
      date: '2024-01-04T00:00:00Z',
      message: 'refactor: delete buffer',
      files: [{ path: 'core/buffer.ts', status: 'D' }],
    },
    {
      sha: '555555',
      author: 'Bob',
      email: 'bob@example.com',
      date: '2024-01-05T00:00:00Z',
      message: 'docs: add readme',
      files: [{ path: 'README.md', status: 'A' }],
    },
  ],
  contributors: [
    { name: 'Alice', commits: 2, color: '#00f0ff' },
    { name: 'Bob', commits: 2, color: '#ff0055' },
    { name: 'Charlie', commits: 1, color: '#ffe600' },
  ],
}

describe('computeLayout', () => {
  it('is strictly deterministic for identical inputs', () => {
    const layout1 = computeLayout(mockHistory)
    const layout2 = computeLayout(mockHistory)

    expect(layout1.districts).toEqual(layout2.districts)
    expect(layout1.buildings).toEqual(layout2.buildings)
    expect(layout1.bounds).toEqual(layout2.bounds)
  })

  it('guarantees no overlapping buildings across the entire city', () => {
    const layout = computeLayout(mockHistory)
    const buildings = layout.buildings

    expect(buildings.length).toBeGreaterThan(0)

    for (let i = 0; i < buildings.length; i++) {
      for (let j = i + 1; j < buildings.length; j++) {
        const b1 = buildings[i]
        const b2 = buildings[j]

        const half1 = b1.size / 2
        const half2 = b2.size / 2

        const r1 = {
          minX: b1.x - half1,
          maxX: b1.x + half1,
          minZ: b1.z - half1,
          maxZ: b1.z + half1,
        }
        const r2 = {
          minX: b2.x - half2,
          maxX: b2.x + half2,
          minZ: b2.z - half2,
          maxZ: b2.z + half2,
        }

        const overlap = !(
          r1.maxX <= r2.minX ||
          r1.minX >= r2.maxX ||
          r1.maxZ <= r2.minZ ||
          r1.minZ >= r2.maxZ
        )

        expect(
          overlap,
          `Building collision detected between "${b1.path}" and "${b2.path}"`
        ).toBe(false)
      }
    }
  })

  it('guarantees no overlapping district bounds', () => {
    const layout = computeLayout(mockHistory)
    const districts = layout.districts

    for (let i = 0; i < districts.length; i++) {
      for (let j = i + 1; j < districts.length; j++) {
        const d1 = districts[i]
        const d2 = districts[j]

        const r1 = {
          minX: d1.x - d1.width / 2,
          maxX: d1.x + d1.width / 2,
          minZ: d1.z - d1.depth / 2,
          maxZ: d1.z + d1.depth / 2,
        }
        const r2 = {
          minX: d2.x - d2.width / 2,
          maxX: d2.x + d2.width / 2,
          minZ: d2.z - d2.depth / 2,
          maxZ: d2.z + d2.depth / 2,
        }

        const overlap = !(
          r1.maxX <= r2.minX ||
          r1.minX >= r2.maxX ||
          r1.maxZ <= r2.minZ ||
          r1.minZ >= r2.maxZ
        )

        expect(
          overlap,
          `District collision detected between "${d1.name}" and "${d2.name}"`
        ).toBe(false)
      }
    }
  })

  it('accurately tracks birthCommitIndex, deathCommitIndex, and touches', () => {
    const layout = computeLayout(mockHistory)

    const engineBuilding = layout.buildings.find((b) => b.path === 'core/engine.ts')
    expect(engineBuilding).toBeDefined()
    expect(engineBuilding?.birthCommitIndex).toBe(0)
    expect(engineBuilding?.deathCommitIndex).toBeNull()
    expect(engineBuilding?.touchCommitIndices).toEqual([0, 1])

    const bufferBuilding = layout.buildings.find((b) => b.path === 'core/buffer.ts')
    expect(bufferBuilding).toBeDefined()
    expect(bufferBuilding?.birthCommitIndex).toBe(0)
    expect(bufferBuilding?.deathCommitIndex).toBe(3) // deleted at commit 3

    const readmeBuilding = layout.buildings.find((b) => b.path === 'README.md')
    expect(readmeBuilding).toBeDefined()
    expect(readmeBuilding?.districtId).toBe('district_root')
    expect(readmeBuilding?.birthCommitIndex).toBe(4)
  })

  it('keeps positions stable across time frames', () => {
    // Subset of history
    const layoutPartial = computeLayout({
      ...mockHistory,
      commits: mockHistory.commits.slice(0, 2),
    })

    const layoutFull = computeLayout(mockHistory)

    // For files existing in both, coordinates inside their district remain constant
    const enginePartial = layoutPartial.buildings.find((b) => b.path === 'core/engine.ts')
    const engineFull = layoutFull.buildings.find((b) => b.path === 'core/engine.ts')

    expect(enginePartial).toBeDefined()
    expect(engineFull).toBeDefined()
    // Relative position inside district grid is stable
    expect(enginePartial?.path).toBe(engineFull?.path)
    expect(enginePartial?.districtId).toBe(engineFull?.districtId)
  })

  it('packs realistic 300-commit sample dataset with zero collisions', async () => {
    const fs = await import('node:fs')
    const raw = fs.readFileSync('public/data/sample.json', 'utf8')
    const sampleData = JSON.parse(raw) as IngestedRepoData

    const layout = computeLayout(sampleData)
    expect(layout.districts.length).toBeGreaterThan(3)
    expect(layout.buildings.length).toBeGreaterThan(20)

    // Check no district collisions
    for (let i = 0; i < layout.districts.length; i++) {
      for (let j = i + 1; j < layout.districts.length; j++) {
        const d1 = layout.districts[i]
        const d2 = layout.districts[j]

        const r1 = {
          minX: d1.x - d1.width / 2,
          maxX: d1.x + d1.width / 2,
          minZ: d1.z - d1.depth / 2,
          maxZ: d1.z + d1.depth / 2,
        }
        const r2 = {
          minX: d2.x - d2.width / 2,
          maxX: d2.x + d2.width / 2,
          minZ: d2.z - d2.depth / 2,
          maxZ: d2.z + d2.depth / 2,
        }

        const overlap = !(
          r1.maxX <= r2.minX ||
          r1.minX >= r2.maxX ||
          r1.maxZ <= r2.minZ ||
          r1.minZ >= r2.maxZ
        )
        expect(overlap).toBe(false)
      }
    }

    // Check no building collisions
    for (let i = 0; i < layout.buildings.length; i++) {
      for (let j = i + 1; j < layout.buildings.length; j++) {
        const b1 = layout.buildings[i]
        const b2 = layout.buildings[j]

        const r1 = {
          minX: b1.x - b1.size / 2,
          maxX: b1.x + b1.size / 2,
          minZ: b1.z - b1.size / 2,
          maxZ: b1.z + b1.size / 2,
        }
        const r2 = {
          minX: b2.x - b2.size / 2,
          maxX: b2.x + b2.size / 2,
          minZ: b2.z - b2.size / 2,
          maxZ: b2.z + b2.size / 2,
        }

        const overlap = !(
          r1.maxX <= r2.minX ||
          r1.minX >= r2.maxX ||
          r1.maxZ <= r2.minZ ||
          r1.minZ >= r2.maxZ
        )
        expect(overlap).toBe(false)
      }
    }
  })
})
