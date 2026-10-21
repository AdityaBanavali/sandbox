#!/usr/bin/env node
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const AUTHORS = [
  { name: 'Ada Lovelace', email: 'ada@chrono.dev', color: '#00f0ff', weight: 80 },
  { name: 'Linus Torvalds', email: 'linus@chrono.dev', color: '#ffe600', weight: 65 },
  { name: 'Margaret Hamilton', email: 'margaret@chrono.dev', color: '#00ff66', weight: 50 },
  { name: 'Satoshi Nakamoto', email: 'satoshi@chrono.dev', color: '#ff0055', weight: 40 },
  { name: 'Alan Turing', email: 'alan@chrono.dev', color: '#a855f7', weight: 35 },
  { name: 'Grace Hopper', email: 'grace@chrono.dev', color: '#ff7700', weight: 20 },
  { name: 'Ken Thompson', email: 'ken@chrono.dev', color: '#38bdf8', weight: 10 },
]

const MODULES = {
  core: ['types.ts', 'engine.ts', 'dispatcher.ts', 'buffer.ts', 'allocator.ts', 'events.ts', 'constants.ts'],
  storage: ['wal.ts', 'btree.ts', 'pager.ts', 'disk.ts', 'cache.ts', 'transaction.ts', 'compact.ts'],
  network: ['peer.ts', 'socket.ts', 'protocol.ts', 'handshake.ts', 'rpc.ts', 'codec.ts', 'stream.ts'],
  crypto: ['hash.ts', 'merkle.ts', 'cipher.ts', 'keys.ts', 'signature.ts'],
  cli: ['main.ts', 'config.ts', 'commands.ts', 'formatter.ts', 'args.ts'],
  docs: ['architecture.md', 'protocol.md', 'storage-spec.md', 'benchmarks.md', 'README.md'],
  tests: ['core.test.ts', 'storage.test.ts', 'network.test.ts', 'crypto.test.ts', 'e2e.test.ts'],
}

const MESSAGES = [
  'feat(core): initial memory pool allocator',
  'fix(storage): resolve WAL replay edge case on unclean shutdown',
  'perf(storage): optimize B-tree node split routine',
  'feat(network): implement multiplexed stream protocol',
  'refactor(crypto): migrate sha256 to vectorized SIMD routines',
  'test(storage): add concurrent transaction stress tests',
  'fix(network): handle peer timeout during handshake exchange',
  'feat(cli): add telemetry inspect command',
  'docs(architecture): document zero-copy buffer architecture',
  'feat(core): dynamic worker thread auto-scaling',
  'perf(network): zero-copy frame parsing for RPC batches',
  'refactor(storage): separate page cache from raw disk I/O',
  'fix(crypto): correct Merkle tree root computation on leaf deletion',
  'feat(core): implement lock-free ring buffer for logging',
  'chore(tests): increase randomized fuzzing iterations',
  'fix(cli): parse custom config flags gracefully',
  'perf(core): reduce allocations inside hot dispatch loop',
  'feat(storage): add online database compaction worker',
  'docs(protocol): clarify frame sequence numbers and ack timeout',
  'refactor(core): migrate internal events to typed event bus',
  'feat(network): introduce UDP transport fallback',
  'fix(storage): fix latch contention under heavy insert workloads',
]

function randomSha() {
  const chars = '0123456789abcdef'
  let s = ''
  for (let i = 0; i < 40; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

// Build cumulative repository files
const activeFiles = new Set()
const commits = []
const authorCounts = new Map()

let timestamp = new Date('2024-01-10T09:00:00Z').getTime()

for (let i = 1; i <= 300; i++) {
  timestamp += Math.floor(1000 * 60 * (15 + Math.random() * 240)) // +15 to 255 mins per commit
  const dateIso = new Date(timestamp).toISOString()

  // Pick author based on weighted random
  const totalWeight = AUTHORS.reduce((acc, a) => acc + a.weight, 0)
  let rnd = Math.random() * totalWeight
  let author = AUTHORS[0]
  for (const a of AUTHORS) {
    if (rnd < a.weight) {
      author = a
      break
    }
    rnd -= a.weight
  }
  authorCounts.set(author.name, (authorCounts.get(author.name) || 0) + 1)

  const modNames = Object.keys(MODULES)
  const chosenMod = modNames[Math.floor(Math.random() * modNames.length)]
  const candidateFiles = MODULES[chosenMod]
  const chosenFile = candidateFiles[Math.floor(Math.random() * candidateFiles.length)]
  const filePath = `${chosenMod}/${chosenFile}`

  const fileChanges = []
  if (!activeFiles.has(filePath)) {
    // Add file
    activeFiles.add(filePath)
    fileChanges.push({ path: filePath, status: 'A' })
  } else {
    // 85% modify, 10% touch secondary file, 5% rename
    fileChanges.push({ path: filePath, status: 'M' })

    if (Math.random() < 0.25) {
      const secFile = candidateFiles[Math.floor(Math.random() * candidateFiles.length)]
      const secPath = `${chosenMod}/${secFile}`
      if (activeFiles.has(secPath) && secPath !== filePath) {
        fileChanges.push({ path: secPath, status: 'M' })
      }
    }

    if (Math.random() < 0.05 && i > 50) {
      const oldRenamed = `${chosenMod}/legacy_${Math.floor(Math.random() * 10)}.ts`
      if (activeFiles.has(oldRenamed)) {
        activeFiles.delete(oldRenamed)
        fileChanges.push({ path: filePath, status: 'R', oldPath: oldRenamed })
      }
    }
  }

  const msgPrefix = MESSAGES[i % MESSAGES.length]
  const message = `${msgPrefix} (#${100 + i})`

  commits.push({
    sha: randomSha(),
    author: author.name,
    email: author.email,
    date: dateIso,
    message,
    files: fileChanges,
  })
}

const contributors = AUTHORS.map((a) => ({
  name: a.name,
  commits: authorCounts.get(a.name) || 0,
  color: a.color,
})).sort((a, b) => b.commits - a.commits)

const outData = {
  repo: 'hyper-engine',
  totalCommits: commits.length,
  commits,
  contributors,
}

const dest = resolve('public/data/sample.json')
mkdirSync(resolve('public/data'), { recursive: true })
writeFileSync(dest, JSON.stringify(outData, null, 2), 'utf8')
console.log(`Generated sample dataset with ${commits.length} commits at ${dest}`)
