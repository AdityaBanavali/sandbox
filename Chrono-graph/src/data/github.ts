import { getCachedRepo, setCachedRepo } from './cache'
import type { CommitRecord, FileChange, IngestedRepoData } from './types'

const TOKEN_KEY = 'chronograph_github_pat'
const PALETTE = [
  '#00f0ff',
  '#ff0055',
  '#ffe600',
  '#00ff66',
  '#a855f7',
  '#ff7700',
  '#38bdf8',
  '#f43f5e',
  '#10b981',
  '#8b5cf6',
  '#06b6d4',
  '#eab308',
]

export interface RateLimitState {
  limit: number
  remaining: number
  reset: number
}

let currentRateLimit: RateLimitState | null = null
const rateLimitListeners = new Set<(state: RateLimitState) => void>()

export function getRateLimitState(): RateLimitState | null {
  return currentRateLimit
}

export function subscribeRateLimit(listener: (state: RateLimitState) => void): () => void {
  rateLimitListeners.add(listener)
  if (currentRateLimit) listener(currentRateLimit)
  return () => rateLimitListeners.delete(listener)
}

function updateRateLimitFromHeaders(headers: Headers) {
  const limitStr = headers.get('x-ratelimit-limit')
  const remainingStr = headers.get('x-ratelimit-remaining')
  const resetStr = headers.get('x-ratelimit-reset')

  if (limitStr && remainingStr) {
    currentRateLimit = {
      limit: parseInt(limitStr, 10),
      remaining: parseInt(remainingStr, 10),
      reset: resetStr ? parseInt(resetStr, 10) * 1000 : Date.now() + 3600000,
    }
    rateLimitListeners.forEach((fn) => fn(currentRateLimit!))
  }
}

export function getGitHubToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) || null
  } catch {
    return null
  }
}

export function setGitHubToken(token: string | null): void {
  try {
    if (!token) {
      localStorage.removeItem(TOKEN_KEY)
    } else {
      localStorage.setItem(TOKEN_KEY, token.trim())
    }
  } catch {
    // localStorage disabled
  }
}

export function parseGitHubRepo(input: string): { owner: string; repo: string } {
  const raw = input.trim().replace(/\/+$/, '')
  // Match owner/repo
  const clean = raw
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/^git@github\.com:/i, '')
    .replace(/^github\.com\//i, '')
    .replace(/\.git$/i, '')

  const parts = clean.split('/')
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return { owner: parts[0], repo: parts[1] }
  }

  throw new Error(`Invalid GitHub repository format: "${input}". Use "owner/repo" or full GitHub URL.`)
}

async function githubFetch(url: string): Promise<Response> {
  const token = getGitHubToken()
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(url, { headers })
  updateRateLimitFromHeaders(res.headers)

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`GitHub repository not found or is private (404).`)
    }
    if (res.status === 403 || res.status === 429) {
      const resetTime = currentRateLimit?.reset ? new Date(currentRateLimit.reset).toLocaleTimeString() : 'later'
      throw new Error(`GitHub API rate limit exceeded. Resets at ${resetTime}. Add a Personal Access Token (PAT) to increase limits.`)
    }
    if (res.status === 401) {
      throw new Error(`Invalid GitHub Personal Access Token (401). Please check or remove your token.`)
    }
    throw new Error(`GitHub API error (${res.status}): ${res.statusText}`)
  }

  return res
}

function parseLastPage(linkHeader: string | null): number | null {
  if (!linkHeader) return null
  const match = linkHeader.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/)
  return match ? parseInt(match[1], 10) : null
}

interface RawGhCommit {
  sha: string
  commit: {
    author?: { name?: string; email?: string; date?: string }
    message?: string
  }
  author?: { login?: string }
}

interface RawGhCommitDetail {
  files?: Array<{
    filename: string
    status: string
    previous_filename?: string
  }>
}

interface RawGhTreeItem {
  path: string
  type: string
}

export async function fetchGitHubRepoHistory(
  owner: string,
  repo: string,
  options?: {
    onProgress?: (msg: string) => void
    maxCommits?: number
  }
): Promise<IngestedRepoData> {
  const progress = options?.onProgress || (() => {})
  const maxCommits = options?.maxCommits || 600

  // 1. Repo metadata
  progress(`Fetching ${owner}/${repo} metadata...`)
  const repoRes = await githubFetch(`https://api.github.com/repos/${owner}/${repo}`)
  const repoData = await repoRes.json()
  const defaultBranch = repoData.default_branch || 'main'

  if (repoData.size === 0) {
    throw new Error(`Repository "${owner}/${repo}" is empty.`)
  }

  // 2. File tree
  progress(`Fetching repository file tree...`)
  let treeFiles: string[] = []
  try {
    const treeRes = await githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`
    )
    const treeData = (await treeRes.json()) as { tree: RawGhTreeItem[] }
    treeFiles = (treeData.tree || [])
      .filter((item) => item.type === 'blob')
      .map((item) => item.path)
  } catch (err) {
    console.warn('Could not fetch recursive git tree:', err)
  }

  // 3. Commits list
  progress(`Scanning commit history...`)
  const firstPageRes = await githubFetch(
    `https://api.github.com/repos/${owner}/${repo}/commits?per_page=100&page=1`
  )
  const lastPage = parseLastPage(firstPageRes.headers.get('link')) || 1
  const firstPageCommits = (await firstPageRes.json()) as RawGhCommit[]

  let allRawCommits: RawGhCommit[] = [...firstPageCommits]

  // If repo is small (< 150 commits), fetch all remaining pages directly without sampling
  if (lastPage > 1) {
    const isSmallRepo = lastPage <= 2 && firstPageCommits.length === 100

    if (isSmallRepo) {
      for (let p = 2; p <= lastPage; p++) {
        progress(`Fetching commit page ${p} of ${lastPage}...`)
        try {
          const pRes = await githubFetch(
            `https://api.github.com/repos/${owner}/${repo}/commits?per_page=100&page=${p}`
          )
          const pCommits = (await pRes.json()) as RawGhCommit[]
          allRawCommits.push(...pCommits)
        } catch (err) {
          console.warn(`Failed to fetch page ${p}:`, err)
        }
      }
    } else {
      // Sample pages evenly up to ceil(maxCommits / 100) pages
      const maxPages = Math.min(Math.ceil(maxCommits / 100), lastPage)
      const pageNumbersToFetch: number[] = []

      for (let i = 1; i < maxPages; i++) {
        const page = 1 + Math.round((i * (lastPage - 1)) / (maxPages - 1))
        if (!pageNumbersToFetch.includes(page) && page > 1) {
          pageNumbersToFetch.push(page)
        }
      }

      for (const page of pageNumbersToFetch) {
        progress(`Fetching commit page ${page} of ${lastPage}...`)
        try {
          const pRes = await githubFetch(
            `https://api.github.com/repos/${owner}/${repo}/commits?per_page=100&page=${page}`
          )
          const pCommits = (await pRes.json()) as RawGhCommit[]
          allRawCommits.push(...pCommits)
        } catch (err) {
          console.warn(`Failed to fetch page ${page}:`, err)
        }
      }
    }
  }

  if (allRawCommits.length === 0) {
    throw new Error(`No commits found in ${owner}/${repo}.`)
  }

  // Deduplicate and reverse chronologically (oldest first)
  const seenShas = new Set<string>()
  const uniqueCommits: RawGhCommit[] = []
  for (const c of allRawCommits) {
    if (!seenShas.has(c.sha)) {
      seenShas.add(c.sha)
      uniqueCommits.push(c)
    }
  }

  uniqueCommits.sort((a, b) => {
    const da = a.commit.author?.date ? new Date(a.commit.author.date).getTime() : 0
    const db = b.commit.author?.date ? new Date(b.commit.author.date).getTime() : 0
    return da - db
  })

  const isSmallRepo = uniqueCommits.length < 150

  // Sample down if exceeds maxCommits (skip if small repo)
  let sampledCommits = uniqueCommits
  if (!isSmallRepo && uniqueCommits.length > maxCommits) {
    sampledCommits = []
    for (let i = 0; i < maxCommits; i++) {
      const idx = Math.round((i * (uniqueCommits.length - 1)) / (maxCommits - 1))
      sampledCommits.push(uniqueCommits[idx])
    }
  }

  // 4. File touch inspection: if small repo (< 150 commits), fetch ALL commit details
  const detailTargetCount = isSmallRepo ? sampledCommits.length : Math.min(40, sampledCommits.length)
  const detailIndices = new Set<number>()
  for (let i = 0; i < detailTargetCount; i++) {
    const idx = isSmallRepo
      ? i
      : Math.round((i * (sampledCommits.length - 1)) / Math.max(detailTargetCount - 1, 1))
    detailIndices.add(idx)
  }

  progress(
    isSmallRepo
      ? `Fetching full details for all ${sampledCommits.length} commits...`
      : `Fetching detailed diffs for ${detailIndices.size} milestone commits...`
  )
  const detailedMap = new Map<string, FileChange[]>()

  // Fetch in concurrency chunks of 5
  const detailCommitsList = Array.from(detailIndices).map((idx) => sampledCommits[idx])
  const CHUNK_SIZE = 5
  for (let i = 0; i < detailCommitsList.length; i += CHUNK_SIZE) {
    const chunk = detailCommitsList.slice(i, i + CHUNK_SIZE)
    if (isSmallRepo) {
      progress(`Fetching diffs (${i + 1}/${detailCommitsList.length})...`)
    }
    await Promise.all(
      chunk.map(async (c) => {
        try {
          const detailRes = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/commits/${c.sha}`)
          const detailData = (await detailRes.json()) as RawGhCommitDetail
          if (detailData.files && detailData.files.length > 0) {
            const files: FileChange[] = detailData.files.map((f) => ({
              path: f.filename,
              status: f.status === 'added' ? 'A' : f.status === 'removed' ? 'D' : f.status === 'renamed' ? 'R' : 'M',
              oldPath: f.previous_filename,
            }))
            detailedMap.set(c.sha, files)
          }
        } catch {
          // ignore individual commit diff failure
        }
      })
    )
  }

  // 5. Procedural inference for remaining commits
  progress(`Generating procedural city timeline...`)
  const introducedFiles = new Set<string>()
  const authorTally = new Map<string, number>()

  // Group tree files by top directory
  const filesByDirectory = new Map<string, string[]>()
  treeFiles.forEach((f) => {
    const dir = f.includes('/') ? f.split('/')[0] : 'root'
    if (!filesByDirectory.has(dir)) filesByDirectory.set(dir, [])
    filesByDirectory.get(dir)!.push(f)
  })
  const topDirs = Array.from(filesByDirectory.keys())

  const finalCommits: CommitRecord[] = sampledCommits.map((c, commitIndex) => {
    const authorName = c.commit.author?.name || c.author?.login || 'Anonymous'
    const email = c.commit.author?.email || ''
    const date = c.commit.author?.date || new Date().toISOString()
    const message = c.commit.message?.split('\n')[0] || 'Commit'

    authorTally.set(authorName, (authorTally.get(authorName) || 0) + 1)

    // Check if we have exact fetched details
    if (detailedMap.has(c.sha)) {
      const realFiles = detailedMap.get(c.sha)!
      realFiles.forEach((rf) => introducedFiles.add(rf.path))
      return {
        sha: c.sha,
        author: authorName,
        email,
        date,
        message,
        files: realFiles,
      }
    }

    // Procedural distribution: match message words against directories/files or pseudo-random selection
    const msgLower = message.toLowerCase()
    let chosenFiles: string[] = []

    // Check if message references any known directory
    const matchedDir = topDirs.find((d) => msgLower.includes(d.toLowerCase()))
    const pool = matchedDir ? filesByDirectory.get(matchedDir)! : treeFiles

    if (pool.length > 0) {
      const count = 1 + (commitIndex % 3)
      for (let k = 0; k < count; k++) {
        const fileIdx = (commitIndex * 7 + k * 13) % pool.length
        chosenFiles.push(pool[fileIdx])
      }
    } else {
      chosenFiles.push(`src/module_${commitIndex % 10}.ts`)
    }

    const files: FileChange[] = chosenFiles.map((path) => {
      if (!introducedFiles.has(path)) {
        introducedFiles.add(path)
        return { path, status: 'A' }
      }
      return { path, status: 'M' }
    })

    return {
      sha: c.sha,
      author: authorName,
      email,
      date,
      message,
      files,
    }
  })

  // 6. Contributors
  const topContributors = Array.from(authorTally.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, commits], index) => ({
      name,
      commits,
      color: PALETTE[index % PALETTE.length],
    }))

  const result: IngestedRepoData = {
    repo: `${owner}/${repo}`,
    totalCommits: finalCommits.length,
    commits: finalCommits,
    contributors: topContributors,
  }

  // Cache in IndexedDB
  await setCachedRepo(`${owner}/${repo}`, result)
  progress(`Loaded ${finalCommits.length} commits for ${owner}/${repo}`)
  return result
}

export interface LoadHistoryOptions {
  forceRefresh?: boolean
  onProgress?: (msg: string) => void
  maxCommits?: number
}

export async function loadHistory(
  input: string,
  options?: LoadHistoryOptions
): Promise<IngestedRepoData> {
  const trimmed = input.trim()

  // Preset mapping for built-in datasets
  const lower = trimmed.toLowerCase()
  const presets: Record<string, string> = {
    linux: '/data/linux.json',
    'preset:linux': '/data/linux.json',
    'torvalds/linux': '/data/linux.json',
    react: '/data/react.json',
    'preset:react': '/data/react.json',
    'facebook/react': '/data/react.json',
    redis: '/data/redis.json',
    'preset:redis': '/data/redis.json',
    'redis/redis': '/data/redis.json',
    vue: '/data/vue.json',
    'preset:vue': '/data/vue.json',
    'vuejs/vue': '/data/vue.json',
    'vuejs/core': '/data/vue.json',
    geospatial_watershed: '/data/geospatial_watershed.json',
    'adityabanavali/geospatial_watershed': '/data/geospatial_watershed.json',
    'https://github.com/adityabanavali/geospatial_watershed': '/data/geospatial_watershed.json',
    'preset:geospatial': '/data/geospatial_watershed.json',
  }

  if (presets[lower]) {
    const url = presets[lower]
    options?.onProgress?.(`Loading preset dataset (${url})...`)
    const res = await fetch(url)
    if (res.ok) {
      const data = (await res.json()) as IngestedRepoData
      options?.onProgress?.(`Loaded ${data.repo} (${data.totalCommits} commits)`)
      return data
    }
  }

  // Sample or JSON file route
  if (trimmed === 'sample' || trimmed === '' || trimmed.endsWith('.json') || trimmed.startsWith('/')) {
    const url = trimmed === 'sample' || trimmed === '' ? '/data/sample.json' : trimmed
    options?.onProgress?.(`Loading local dataset (${url})...`)
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Failed to load dataset at "${url}" (${res.status} ${res.statusText})`)
    }
    const data = (await res.json()) as IngestedRepoData
    options?.onProgress?.(`Loaded ${data.repo} (${data.totalCommits} commits)`)
    return data
  }

  // GitHub repository route
  const { owner, repo } = parseGitHubRepo(trimmed)
  const repoKey = `${owner}/${repo}`

  if (!options?.forceRefresh) {
    const cached = await getCachedRepo(repoKey)
    if (cached) {
      options?.onProgress?.(`Loaded ${repoKey} from IndexedDB cache (${cached.totalCommits} commits)`)
      return cached
    }
  }

  return fetchGitHubRepoHistory(owner, repo, options)
}
