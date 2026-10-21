import React, { useEffect } from 'react'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  GitCommit,
  User,
  Calendar,
  FileCode,
} from 'lucide-react'
import { useRepoStore, usePlaybackStore } from '../store'

export const TimelineControls: React.FC = () => {
  const { data } = useRepoStore()
  const {
    currentCommitIndex,
    isPlaying,
    speed,
    togglePlay,
    setPlaying,
    setSpeed,
    stepNext,
    stepPrev,
    setCommitIndex,
    calculateDwellMs,
  } = usePlaybackStore()

  const totalCommits = data?.commits.length || 0
  const currentCommit = data?.commits[currentCommitIndex]

  // Auto-pace playback loop with minimum dwell enforcement
  useEffect(() => {
    if (!isPlaying || totalCommits === 0) return

    const dwellMs = calculateDwellMs(totalCommits)
    const timer = setTimeout(() => {
      stepNext(totalCommits)
    }, dwellMs)

    return () => clearTimeout(timer)
  }, [isPlaying, currentCommitIndex, totalCommits, calculateDwellMs, stepNext])

  if (!data || totalCommits === 0) return null

  const author = currentCommit?.author || 'Unknown'
  const authorInfo = data.contributors.find((c) => c.name === author)
  const authorColor = authorInfo?.color || '#00f0ff'

  return (
    <div className="absolute bottom-6 left-0 right-0 z-20 flex flex-col items-center gap-3 px-4 pointer-events-none">
      {/* Current Commit HUD Card */}
      {currentCommit && (
        <div className="bg-[#0b0c1c]/95 border border-[#2a2c4e] backdrop-blur-lg px-5 py-3 rounded-2xl shadow-2xl flex flex-col gap-2 max-w-2xl w-full pointer-events-auto transition">
          <div className="flex items-center justify-between text-xs gap-3">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: authorColor }}
              />
              <span className="font-semibold text-slate-100 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {author}
              </span>
              <span className="font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60 text-[11px]">
                {currentCommit.sha.slice(0, 7)}
              </span>
            </div>
            <div className="flex items-center gap-3 text-slate-400 text-[11px] font-mono">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(currentCommit.date).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <FileCode className="w-3 h-3" />
                {currentCommit.files.length} file{currentCommit.files.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          <p className="text-slate-200 text-xs font-mono truncate">
            {currentCommit.message}
          </p>
        </div>
      )}

      {/* Main Playback Bar */}
      <div className="bg-[#0b0c1c]/95 border border-[#2a2c4e] backdrop-blur-lg px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-5 max-w-3xl w-full pointer-events-auto">
        {/* Playback action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setCommitIndex(0)}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 rounded-xl transition"
            title="Reset to first commit"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={stepPrev}
            disabled={currentCommitIndex === 0}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 rounded-xl transition disabled:opacity-30"
            title="Step backward"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            className="p-3 bg-gradient-to-tr from-cyan-500 to-fuchsia-500 hover:brightness-110 text-black font-bold rounded-xl shadow-lg transition active:scale-95"
            title={isPlaying ? 'Pause timeline' : 'Play history'}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={() => stepNext(totalCommits)}
            disabled={currentCommitIndex >= totalCommits - 1}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 rounded-xl transition disabled:opacity-30"
            title="Step forward"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Timeline Scrubber */}
        <div className="flex-1 flex flex-col gap-1">
          <div className="flex justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1 text-cyan-400 font-bold">
              <GitCommit className="w-3.5 h-3.5" />
              Commit {currentCommitIndex + 1} / {totalCommits}
            </span>
            <span>
              {Math.round(((currentCommitIndex + 1) / totalCommits) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(0, totalCommits - 1)}
            value={currentCommitIndex}
            onChange={(e) => {
              setPlaying(false)
              setCommitIndex(parseInt(e.target.value, 10))
            }}
            className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
          />
        </div>

        {/* Speed Controls */}
        <div className="flex items-center gap-1 bg-[#14162e] border border-[#2c2f54] p-1 rounded-xl shrink-0 text-xs font-mono">
          {[0.5, 1, 2, 4].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              className={`px-2 py-1 rounded-lg transition ${
                speed === s
                  ? 'bg-cyan-500 text-black font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
