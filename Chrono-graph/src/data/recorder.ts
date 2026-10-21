import { useTimelineStore } from '../store/timeline'
import { useUIStore } from '../store/uiStore'
import type { IngestedRepoData } from './types'

export interface RecordOptions {
  data: IngestedRepoData
  targetDurationSeconds?: number // 15 | 30 | 60 (default 30)
  onProgress?: (pct: number, status: string) => void
}

export async function recordHistoryVideo(options: RecordOptions): Promise<Blob> {
  const { data, targetDurationSeconds = 30, onProgress } = options
  const uiStore = useUIStore.getState()
  const timelineStore = useTimelineStore.getState()

  // Find 3D WebGL canvas
  const webglCanvas = document.querySelector('canvas')
  if (!webglCanvas) {
    throw new Error('WebGL Canvas element not found in DOM.')
  }

  // Calculate stats for intro/outro
  const totalCommits = data.commits.length
  const uniqueFiles = new Set<string>()
  data.commits.forEach((c) => c.files.forEach((f) => uniqueFiles.add(f.path)))
  const totalFiles = uniqueFiles.size

  const firstDate = new Date(data.commits[0]?.date || Date.now())
  const lastDate = new Date(data.commits[totalCommits - 1]?.date || Date.now())
  const diffYears = (lastDate.getTime() - firstDate.getTime()) / (365.25 * 24 * 3600 * 1000)
  const yearsText = diffYears < 0.9 ? `${Math.max(1, Math.round(diffYears * 12))} MONTHS` : `${Math.max(1, Math.round(diffYears))} YEARS`

  // 1080p Recording composite canvas
  const recCanvas = document.createElement('canvas')
  recCanvas.width = 1920
  recCanvas.height = 1080
  const ctx = recCanvas.getContext('2d', { alpha: false })!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // Determine supported mime type
  const mimeCandidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4;codecs=avc1',
    'video/mp4',
  ]
  const mimeType = mimeCandidates.find((type) => MediaRecorder.isTypeSupported(type)) || 'video/webm'

  const stream = recCanvas.captureStream(30)
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8_000_000, // 8 Mbps
  })

  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data)
    }
  }

  // Save previous UI state & activate cinematic mode
  const prevCinematic = uiStore.isCinematicMode
  const prevAutoPace = uiStore.autoPaceDuration
  uiStore.setCinematicMode(true)
  uiStore.setAutoPaceDuration((targetDurationSeconds as any) || 30)
  uiStore.setRecordingState(true, 'Rendering Intro Title Card...', 0)

  recorder.start(250)

  // Helper to draw CRT scanlines on composite
  function drawScanlines() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)'
    for (let y = 0; y < 1080; y += 4) {
      ctx.fillRect(0, y, 1920, 1.5)
    }
  }

  // --- PHASE 1: INTRO CARD (3.0 seconds @ 30 FPS = 90 frames) ---
  const introFrames = 90
  for (let f = 0; f < introFrames; f++) {
    onProgress?.(Math.round((f / introFrames) * 12), 'Rendering Intro Card...')
    uiStore.setRecordingState(true, 'Rendering Intro Card...', Math.round((f / introFrames) * 12))

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 1920, 1080)
    bgGrad.addColorStop(0, '#04050d')
    bgGrad.addColorStop(0.5, '#0a0d24')
    bgGrad.addColorStop(1, '#03040a')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, 1920, 1080)

    // Synthwave Grid Perspective Lines
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)'
    ctx.lineWidth = 1.5
    const gridOffset = (f * 3) % 60
    for (let x = 0; x < 1920; x += 60) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, 1080)
      ctx.stroke()
    }
    for (let y = gridOffset; y < 1080; y += 60) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(1920, y)
      ctx.stroke()
    }

    // Glowing Neon Border
    ctx.strokeStyle = '#00f0ff'
    ctx.lineWidth = 4
    ctx.strokeRect(60, 60, 1800, 960)

    // Tag badge
    ctx.fillStyle = '#ff0055'
    ctx.font = 'bold 22px "Press Start 2P", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('ARCADE GIT VISUALIZER', 960, 220)

    // Big Headline: "X YEARS OF <REPO> IN 30 SECONDS"
    ctx.fillStyle = '#00f0ff'
    ctx.font = 'bold 54px "Press Start 2P", monospace'
    const headline = `${yearsText} OF ${data.repo.toUpperCase()}`
    ctx.fillText(headline, 960, 360)

    ctx.fillStyle = '#ffe600'
    ctx.font = 'bold 36px "Press Start 2P", monospace'
    ctx.fillText(`IN ${targetDurationSeconds} SECONDS`, 960, 440)

    // Stats Bar
    const boxY = 560
    const boxW = 440
    const boxH = 160

    // Stat 1: Commits
    ctx.fillStyle = '#0f1433'
    ctx.fillRect(240, boxY, boxW, boxH)
    ctx.strokeStyle = '#00f0ff'
    ctx.strokeRect(240, boxY, boxW, boxH)
    ctx.fillStyle = '#00f0ff'
    ctx.font = 'bold 44px "Press Start 2P", monospace'
    ctx.fillText(`${totalCommits}`, 240 + boxW / 2, boxY + 75)
    ctx.fillStyle = '#94a3b8'
    ctx.font = '18px "Press Start 2P", monospace'
    ctx.fillText('COMMITS', 240 + boxW / 2, boxY + 125)

    // Stat 2: Contributors
    ctx.fillStyle = '#0f1433'
    ctx.fillRect(740, boxY, boxW, boxH)
    ctx.strokeStyle = '#ff0055'
    ctx.strokeRect(740, boxY, boxW, boxH)
    ctx.fillStyle = '#ff0055'
    ctx.font = 'bold 44px "Press Start 2P", monospace'
    ctx.fillText(`${data.contributors.length}`, 740 + boxW / 2, boxY + 75)
    ctx.fillStyle = '#94a3b8'
    ctx.font = '18px "Press Start 2P", monospace'
    ctx.fillText('CONTRIBUTORS', 740 + boxW / 2, boxY + 125)

    // Stat 3: Files
    ctx.fillStyle = '#0f1433'
    ctx.fillRect(1240, boxY, boxW, boxH)
    ctx.strokeStyle = '#ffe600'
    ctx.strokeRect(1240, boxY, boxW, boxH)
    ctx.fillStyle = '#ffe600'
    ctx.font = 'bold 44px "Press Start 2P", monospace'
    ctx.fillText(`${totalFiles}`, 1240 + boxW / 2, boxY + 75)
    ctx.fillStyle = '#94a3b8'
    ctx.font = '18px "Press Start 2P", monospace'
    ctx.fillText('FILES BUILT', 1240 + boxW / 2, boxY + 125)

    // Footer prompt
    ctx.fillStyle = '#38bdf8'
    ctx.font = '18px "Press Start 2P", monospace'
    ctx.fillText('INITIALIZING VOXEL CITY REPLAY ▶', 960, 880)

    drawScanlines()
    await new Promise((r) => setTimeout(r, 1000 / 30))
  }

  // --- PHASE 2: PLAYBACK REPLAY (Recorded in real-time) ---
  timelineStore.setCommitIndex(0)
  timelineStore.setPlaying(true)

  await new Promise<void>((resolve) => {
    const checkInterval = setInterval(() => {
      const curIdx = useTimelineStore.getState().currentCommitIndex
      const isStillPlaying = useTimelineStore.getState().playing
      const pct = Math.min(100, Math.round((curIdx / Math.max(1, totalCommits - 1)) * 100))
      const overallPct = Math.round(12 + pct * 0.76)

      onProgress?.(overallPct, `Recording Replay (${pct}%)...`)
      uiStore.setRecordingState(true, `Recording Replay (${pct}%)...`, overallPct)

      // Draw 3D scene from WebGL Canvas onto 1920x1080 composite
      try {
        ctx.drawImage(webglCanvas, 0, 0, 1920, 1080)
      } catch {
        // Continue if frame drawing encounters transient buffer lock
      }

      // Draw Cinematic Bottom Caption Overlay
      const curCommitIdx = Math.min(totalCommits - 1, Math.floor(curIdx))
      const curCommit = data.commits[curCommitIdx]
      const curYear = curCommit ? new Date(curCommit.date).getFullYear() : 2024
      const curDateStr = curCommit ? new Date(curCommit.date).toLocaleDateString() : ''

      // Bottom Banner Box
      ctx.fillStyle = 'rgba(7, 9, 24, 0.88)'
      ctx.fillRect(80, 920, 1760, 100)
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)'
      ctx.lineWidth = 2
      ctx.strokeRect(80, 920, 1760, 100)

      // Repo Name
      ctx.fillStyle = '#00f0ff'
      ctx.font = 'bold 24px "Press Start 2P", monospace'
      ctx.textAlign = 'left'
      ctx.fillText(data.repo.toUpperCase(), 120, 980)

      // Commit Sha & Author
      if (curCommit) {
        ctx.fillStyle = '#f43f5e'
        ctx.font = '16px "Press Start 2P", monospace'
        ctx.fillText(`AUTHOR: ${curCommit.author.slice(0, 18)}`, 820, 980)
      }

      // Current Year & Date
      ctx.textAlign = 'right'
      ctx.fillStyle = '#ffe600'
      ctx.font = 'bold 28px "Press Start 2P", monospace'
      ctx.fillText(`YEAR ${curYear} • ${curDateStr}`, 1800, 980)

      // Subtle Scanlines
      drawScanlines()

      if (!isStillPlaying || curIdx >= totalCommits - 1) {
        clearInterval(checkInterval)
        resolve()
      }
    }, 1000 / 30)
  })

  // --- PHASE 3: OUTRO CARD (2.5 seconds = 75 frames) ---
  const outroFrames = 75
  const topContributor = data.contributors[0]?.name || 'Community'

  for (let f = 0; f < outroFrames; f++) {
    const overallPct = Math.round(88 + (f / outroFrames) * 12)
    onProgress?.(overallPct, 'Rendering Outro Recap...')
    uiStore.setRecordingState(true, 'Rendering Outro Recap...', overallPct)

    const bgGrad = ctx.createLinearGradient(0, 0, 1920, 1080)
    bgGrad.addColorStop(0, '#04050d')
    bgGrad.addColorStop(0.5, '#120a24')
    bgGrad.addColorStop(1, '#03040a')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, 1920, 1080)

    // Border
    ctx.strokeStyle = '#d946ef'
    ctx.lineWidth = 4
    ctx.strokeRect(60, 60, 1800, 960)

    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffe600'
    ctx.font = 'bold 48px "Press Start 2P", monospace'
    ctx.fillText('METROPOLIS COMPLETE', 960, 320)

    ctx.fillStyle = '#00f0ff'
    ctx.font = 'bold 36px "Press Start 2P", monospace'
    ctx.fillText(data.repo.toUpperCase(), 960, 420)

    ctx.fillStyle = '#94a3b8'
    ctx.font = '20px "Press Start 2P", monospace'
    ctx.fillText(
      `${totalCommits} COMMITS • ${totalFiles} BUILDINGS • TOP AUTHOR: ${topContributor.toUpperCase()}`,
      960,
      560
    )

    ctx.fillStyle = '#ff0055'
    ctx.font = 'bold 24px "Press Start 2P", monospace'
    ctx.fillText('RENDERED WITH CHRONOGRAPH', 960, 740)

    drawScanlines()
    await new Promise((r) => setTimeout(r, 1000 / 30))
  }

  // --- FINALIZE RECORDING ---
  uiStore.setRecordingState(true, 'Encoding and Exporting Video...', 100)

  const videoBlob = await new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType })
      resolve(blob)
    }
    recorder.stop()
  })

  // Restore previous UI mode
  uiStore.setCinematicMode(prevCinematic)
  uiStore.setAutoPaceDuration(prevAutoPace)
  uiStore.setRecordingState(false, '', 0)

  // Trigger browser download
  const isMp4 = mimeType.includes('mp4')
  const ext = isMp4 ? 'mp4' : 'webm'
  const filename = `${data.repo.replace('/', '_')}_chronograph_1080p.${ext}`

  const url = URL.createObjectURL(videoBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10000)

  return videoBlob
}
