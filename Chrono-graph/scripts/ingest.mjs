#!/usr/bin/env node
import { spawn, execSync } from 'node:child_process'
import { createWriteStream, mkdirSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import readline from 'node:readline'

const PALETTE = [
  '#00f0ff', // Cyber cyan
  '#ff0055', // Hot neon pink
  '#ffe600', // Electric yellow
  '#00ff66', // Neo green
  '#a855f7', // Electric purple
  '#ff7700', // Blaze orange
  '#38bdf8', // Sky blue
  '#f43f5e', // Cyber rose
  '#10b981', // Emerald
  '#8b5cf6', // Violet
  '#06b6d4', // Bright teal
  '#eab308', // Amber
]

function printUsage() {
  console.error(`Usage: node scripts/ingest.mjs <path-to-local-git-clone> <out.json> [--max-commits N]`)
  process.exit(1)
}

const args = process.argv.slice(2)
if (args.length < 2) {
  printUsage()
}

let repoPath = ''
let outPath = ''
let maxCommits = null

for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  if (arg.startsWith('--max-commits=')) {
    maxCommits = parseInt(arg.split('=')[1], 10)
  } else if (arg === '--max-commits') {
    maxCommits = parseInt(args[++i], 10)
  } else if (!repoPath) {
    repoPath = arg
  } else if (!outPath) {
    outPath = arg
  }
}

if (!repoPath || !outPath) {
  printUsage()
}

const targetDir = resolve(repoPath)
const targetOut = resolve(outPath)
mkdirSync(dirname(targetOut), { recursive: true })

const repoName = basename(targetDir)

// Verify git repo
try {
  execSync('git rev-parse --is-inside-work-tree', { cwd: targetDir, stdio: 'ignore' })
} catch {
  console.error(`Error: "${targetDir}" is not a valid git repository.`)
  process.exit(1)
}

// Get non-merge commit count
let totalGitCommits = 0
try {
  const countStr = execSync('git rev-list --count --no-merges HEAD', {
    cwd: targetDir,
    encoding: 'utf8',
  }).trim()
  totalGitCommits = parseInt(countStr, 10) || 0
} catch (err) {
  console.error(`Failed to count commits: ${err.message}`)
  process.exit(1)
}

if (totalGitCommits === 0) {
  console.error('No commits found in repository.')
  process.exit(1)
}

// Determine sampling set if maxCommits is specified
let sampleIndices = null
let plannedCommitCount = totalGitCommits

if (maxCommits && maxCommits > 0 && maxCommits < totalGitCommits) {
  sampleIndices = new Set()
  for (let i = 0; i < maxCommits; i++) {
    const idx = Math.round((i * (totalGitCommits - 1)) / (maxCommits - 1))
    sampleIndices.add(idx)
  }
  plannedCommitCount = sampleIndices.size
}

console.log(`Ingesting "${repoName}" (${totalGitCommits} total commits, exporting ${plannedCommitCount})...`)

const outStream = createWriteStream(targetOut, { encoding: 'utf8' })
outStream.write(`{\n  "repo": ${JSON.stringify(repoName)},\n  "totalCommits": ${plannedCommitCount},\n  "commits": [\n`)

const gitProcess = spawn(
  'git',
  [
    'log',
    '--reverse',
    '--no-merges',
    '--name-status',
    '--date=iso-strict',
    '--pretty=format:__COMMIT__\x1f%H\x1f%an\x1f%ae\x1f%aI\x1f%s',
  ],
  {
    cwd: targetDir,
    stdio: ['ignore', 'pipe', 'inherit'],
  }
)

const rl = readline.createInterface({
  input: gitProcess.stdout,
  crlfDelay: Infinity,
})

let commitIndex = -1
let currentCommit = null
let writtenCommits = 0
const authorCounts = new Map()

const isIgnored = (p) => /^(node_modules\/|venv\/|\.venv\/|\.git\/)/i.test(p)

function flushCurrentCommit() {
  if (!currentCommit) return

  const keep = sampleIndices ? sampleIndices.has(commitIndex) : true
  if (keep) {
    const jsonStr = JSON.stringify(currentCommit)
    if (writtenCommits > 0) {
      outStream.write(',\n    ' + jsonStr)
    } else {
      outStream.write('    ' + jsonStr)
    }
    writtenCommits++

    const author = currentCommit.author || 'Unknown'
    authorCounts.set(author, (authorCounts.get(author) || 0) + 1)
  }
  currentCommit = null
}

rl.on('line', (line) => {
  const trimmed = line.trim()
  if (!trimmed) return

  if (trimmed.startsWith('__COMMIT__\x1f')) {
    flushCurrentCommit()
    commitIndex++

    const parts = trimmed.split('\x1f')
    currentCommit = {
      sha: parts[1] || '',
      author: parts[2] || 'Anonymous',
      date: parts[4] || '',
      message: parts[5] || '',
      files: [],
    }
    return
  }

  if (currentCommit) {
    const parts = trimmed.split(/\t+/)
    const rawStatus = parts[0]
    if (!rawStatus) return

    if (rawStatus.startsWith('R')) {
      const oldPath = parts[1]
      const path = parts[2] || parts[1]
      if (!isIgnored(path)) {
        currentCommit.files.push({
          path,
          status: 'R',
          oldPath,
        })
      }
    } else if (rawStatus.startsWith('C')) {
      const path = parts[2] || parts[1]
      if (!isIgnored(path)) {
        currentCommit.files.push({
          path,
          status: 'A',
        })
      }
    } else {
      const status = rawStatus[0]
      const path = parts[1]
      if (path && !isIgnored(path)) {
        currentCommit.files.push({
          path,
          status,
        })
      }
    }
  }
})

rl.on('close', () => {
  flushCurrentCommit()

  // Build top 12 contributors
  const sortedAuthors = Array.from(authorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)

  const contributors = sortedAuthors.map(([name, commits], index) => ({
    name,
    commits,
    color: PALETTE[index % PALETTE.length],
  }))

  outStream.write('\n  ],\n  "contributors": ' + JSON.stringify(contributors, null, 4) + '\n}\n', () => {
    outStream.end()
    console.log(`Ingest complete -> ${targetOut} (${writtenCommits} commits, ${contributors.length} top contributors).`)
  })
})

gitProcess.on('error', (err) => {
  console.error(`Git process failed: ${err.message}`)
  process.exit(1)
})
