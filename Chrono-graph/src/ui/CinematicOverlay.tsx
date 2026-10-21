import React, { useEffect, useState } from 'react'
import { useRepoStore, useTimelineStore, useUIStore } from '../store'
import { X, Clapperboard, Loader2 } from 'lucide-react'

export const CinematicOverlay: React.FC = () => {
  const { data } = useRepoStore()
  const {
    isCinematicMode,
    setCinematicMode,
    isRecording,
    recordingStatus,
    recordingProgress,
  } = useUIStore()

  const [currentCommitInfo, setCurrentCommitInfo] = useState<{
    date: string
    year: number
    author: string
    index: number
  } | null>(null)

  // Direct subscription to timeline store
  useEffect(() => {
    if (!data || data.commits.length === 0) return

    const unsub = useTimelineStore.subscribe((state) => {
      const idx = Math.min(data.commits.length - 1, Math.floor(state.currentCommitIndex))
      const c = data.commits[idx]
      if (c) {
        const d = new Date(c.date)
        setCurrentCommitInfo({
          date: d.toLocaleDateString(),
          year: d.getFullYear(),
          author: c.author,
          index: idx + 1,
        })
      }
    })

    const initialIdx = Math.min(
      data.commits.length - 1,
      Math.floor(useTimelineStore.getState().currentCommitIndex)
    )
    const c = data.commits[initialIdx]
    if (c) {
      const d = new Date(c.date)
      setCurrentCommitInfo({
        date: d.toLocaleDateString(),
        year: d.getFullYear(),
        author: c.author,
        index: initialIdx + 1,
      })
    }

    return () => unsub()
  }, [data])

  // ESC key exits cinematic mode (if not recording)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCinematicMode && !isRecording) {
        setCinematicMode(false)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isCinematicMode, isRecording, setCinematicMode])

  if (!isCinematicMode && !isRecording) return null
  if (!data || !currentCommitInfo) return null

  return (
    <div className="fixed inset-0 z-40 pointer-events-none select-none flex flex-col justify-between p-6 font-mono">
      {/* Top Banner (Recording Progress or Cinematic Badge) */}
      <div className="flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-[#090b1c]/85 border border-cyan-500/40 backdrop-blur-md shadow-[0_0_20px_rgba(0,240,255,0.2)]">
          <Clapperboard className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="font-pixel text-[10px] text-cyan-300 tracking-wider">
            CINEMATIC DRONE MODE
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            • Auto-Orbit Camera
          </span>
        </div>

        {/* Exit Button (disabled during recording) */}
        {!isRecording ? (
          <button
            onClick={() => setCinematicMode(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-500 border border-rose-400 text-black font-pixel text-[10px] backdrop-blur-md transition shadow-[0_0_15px_rgba(244,63,94,0.6)] animate-pulse"
            title="Exit Drone Mode (Esc)"
          >
            <X className="w-3.5 h-3.5 stroke-[3]" />
            EXIT DRONE (Esc)
          </button>
        ) : (
          /* Live Recording Indicator */
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-rose-950/90 border border-rose-500 text-rose-300 font-pixel text-[10px] shadow-[0_0_20px_rgba(244,63,94,0.4)]">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            REC 1080P • {recordingProgress}%
          </div>
        )}
      </div>

      {/* Recording Progress Status Bar (if recording) */}
      {isRecording && (
        <div className="self-center w-full max-w-md bg-[#090b1c]/95 border border-rose-500/70 backdrop-blur-xl p-3 rounded-2xl shadow-2xl flex flex-col gap-2 pointer-events-auto">
          <div className="flex items-center justify-between text-xs text-rose-300 font-pixel">
            <span className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {recordingStatus || 'Recording In Progress...'}
            </span>
            <span>{recordingProgress}%</span>
          </div>
          <div className="w-full h-2 bg-[#04050d] rounded-full overflow-hidden border border-rose-900">
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-amber-400 transition-all duration-150"
              style={{ width: `${recordingProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Bottom Cinematic Caption Banner */}
      <div className="self-center w-full max-w-4xl bg-[#070918]/90 border border-cyan-500/50 backdrop-blur-xl px-6 py-3.5 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.8)] flex items-center justify-between gap-6 pointer-events-auto">
        {/* Repo & Author */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="font-pixel text-sm text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-400">
              {data.repo.toUpperCase()}
            </span>
            <span className="text-[11px] text-slate-400 font-mono mt-0.5">
              COMMIT {currentCommitInfo.index} / {data.totalCommits} •{' '}
              <span className="text-cyan-300">{currentCommitInfo.author}</span>
            </span>
          </div>
        </div>

        {/* Year Counter Badge */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-amber-950/40 border border-amber-500/50 flex flex-col items-end">
            <span className="text-[9px] font-pixel text-amber-400 tracking-wider">
              TIMELINE
            </span>
            <span className="font-pixel text-sm text-amber-300">
              {currentCommitInfo.year}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
            {currentCommitInfo.date}
          </span>
        </div>
      </div>
    </div>
  )
}
