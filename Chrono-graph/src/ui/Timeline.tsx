import React, { useEffect, useRef, useMemo } from 'react'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Sparkles,
  Calendar,
  User,
} from 'lucide-react'
import { useRepoStore, useTimelineStore, useUIStore, type TimelineSpeed } from '../store'

export const Timeline: React.FC = () => {
  const { data } = useRepoStore()
  const {
    playing,
    speed,
    togglePlay,
    setPlaying,
    setSpeed,
    setCommitIndex,
    stepForward,
    stepBackward,
  } = useTimelineStore()
  const { autoPaceDuration, setAutoPaceDuration, isCinematicMode } = useUIStore()

  const totalCommits = data?.commits.length || 0

  // DOM Refs for 60 FPS zero-overhead updates at 1000x
  const sliderRef = useRef<HTMLInputElement>(null)
  const tickerMsgRef = useRef<HTMLSpanElement>(null)
  const tickerDateRef = useRef<HTMLSpanElement>(null)
  const tickerShaRef = useRef<HTMLSpanElement>(null)
  const tickerAuthorRef = useRef<HTMLSpanElement>(null)
  const authorBadgeRef = useRef<HTMLSpanElement>(null)
  const progressFillRef = useRef<HTMLDivElement>(null)
  const commitCounterRef = useRef<HTMLSpanElement>(null)

  const lastCommitIntRef = useRef<number>(-1)

  // Transient store subscription: updates DOM directly without React re-renders
  useEffect(() => {
    if (!data || data.commits.length === 0) return

    const unsubscribe = useTimelineStore.subscribe((state) => {
      const idx = state.currentCommitIndex
      const intIdx = Math.min(data.commits.length - 1, Math.floor(idx))
      const pct = Math.min(100, (idx / Math.max(1, data.commits.length - 1)) * 100)

      if (sliderRef.current) {
        sliderRef.current.value = String(idx)
      }
      if (progressFillRef.current) {
        progressFillRef.current.style.width = `${pct}%`
      }
      if (commitCounterRef.current) {
        commitCounterRef.current.textContent = `${intIdx + 1} / ${data.commits.length}`
      }

      // Update ticker text only when integer commit changes
      if (intIdx !== lastCommitIntRef.current) {
        lastCommitIntRef.current = intIdx
        const commit = data.commits[intIdx]
        if (!commit) return

        if (tickerMsgRef.current) tickerMsgRef.current.textContent = commit.message
        if (tickerDateRef.current) {
          tickerDateRef.current.textContent = new Date(commit.date).toLocaleDateString()
        }
        if (tickerShaRef.current) {
          tickerShaRef.current.textContent = commit.sha.slice(0, 7)
        }
        if (tickerAuthorRef.current) {
          tickerAuthorRef.current.textContent = commit.author
        }
        if (authorBadgeRef.current) {
          const author = data.contributors.find((c) => c.name === commit.author)
          authorBadgeRef.current.style.backgroundColor = author?.color || '#00f0ff'
        }
      }
    })

    return () => unsubscribe()
  }, [data])

  // Keyboard controls: Space = play/pause, Arrows = step
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        setPlaying(false)
        stepForward(totalCommits)
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        setPlaying(false)
        stepBackward()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay, setPlaying, stepForward, stepBackward, totalCommits])

  // Pre-generate tick markers for the scrubber track
  const tickCount = Math.min(120, Math.max(20, totalCommits))
  const ticks = useMemo(() => {
    return Array.from({ length: tickCount }, (_, i) => i)
  }, [tickCount])

  if (!data || totalCommits === 0 || isCinematicMode) return null

  const initialCommit = data.commits[0]

  return (
    <div className="absolute bottom-5 left-0 right-0 z-20 flex flex-col items-center gap-2 px-4 pointer-events-none">
      {/* Ticker HUD Bar */}
      <div className="bg-[#090b18]/95 border border-[#2b2e56] backdrop-blur-xl px-5 py-2.5 rounded-2xl shadow-2xl flex items-center justify-between gap-4 max-w-4xl w-full pointer-events-auto transition">
        <div className="flex items-center gap-3 overflow-hidden text-xs">
          <div className="flex items-center gap-2 shrink-0">
            <span
              ref={authorBadgeRef}
              className="w-2.5 h-2.5 rounded-full shadow"
              style={{ backgroundColor: data.contributors[0]?.color || '#00f0ff' }}
            />
            <span
              ref={tickerAuthorRef}
              className="font-bold text-slate-100 flex items-center gap-1"
            >
              <User className="w-3.5 h-3.5 text-slate-400" />
              {initialCommit?.author || 'Unknown'}
            </span>
            <span
              ref={tickerShaRef}
              className="font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60 text-[10px]"
            >
              {initialCommit?.sha.slice(0, 7) || 'HEAD'}
            </span>
          </div>

          <span className="text-slate-500 font-mono">|</span>

          {/* Commit Message Ticker */}
          <span
            ref={tickerMsgRef}
            className="text-slate-200 font-mono text-xs truncate max-w-md"
          >
            {initialCommit?.message || 'Repository Timeline'}
          </span>
        </div>

        <div className="flex items-center gap-3 text-slate-400 text-[11px] font-mono shrink-0">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span ref={tickerDateRef}>
              {initialCommit ? new Date(initialCommit.date).toLocaleDateString() : ''}
            </span>
          </span>
          <span className="text-cyan-400 font-bold bg-[#141834] px-2 py-0.5 rounded border border-[#2c3364]">
            Commit <span ref={commitCounterRef}>1 / {totalCommits}</span>
          </span>
        </div>
      </div>

      {/* Main Playback & Scrubber Console */}
      <div className="bg-[#090b18]/95 border border-[#2b2e56] backdrop-blur-xl px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-5 max-w-4xl w-full pointer-events-auto">
        {/* "Play History" Primary Action Button */}
        <button
          type="button"
          onClick={() => {
            if (useTimelineStore.getState().currentCommitIndex >= totalCommits - 1) {
              setCommitIndex(0)
            }
            setPlaying(true)
          }}
          className="px-4 py-2 bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-amber-400 hover:brightness-110 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition active:scale-95 flex items-center gap-1.5 shrink-0"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >
          <Sparkles className="w-4 h-4" />
          Play History
        </button>

        {/* Step / Toggle Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setCommitIndex(0)}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 rounded-xl transition"
            title="Reset to first commit (Home)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false)
              stepBackward()
            }}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 rounded-xl transition"
            title="Step backward (Arrow Left)"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            className="p-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-bold rounded-xl shadow transition"
            title="Play / Pause (Space)"
          >
            {playing ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false)
              stepForward(totalCommits)
            }}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 rounded-xl transition"
            title="Step forward (Arrow Right)"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Scrubber with Commit Ticks */}
        <div className="flex-1 relative flex flex-col justify-center h-8">
          {/* Ticks Canvas Layer */}
          <div className="absolute inset-x-0 top-1.5 flex justify-between pointer-events-none opacity-40">
            {ticks.map((t) => (
              <span
                key={t}
                className="w-0.5 h-2 bg-slate-500 rounded-full"
              />
            ))}
          </div>

          {/* Progress fill bar */}
          <div className="absolute inset-x-0 h-1.5 bg-slate-800/90 rounded-full overflow-hidden pointer-events-none">
            <div
              ref={progressFillRef}
              className="h-full bg-gradient-to-r from-cyan-400 to-fuchsia-400 transition-[width] duration-75"
              style={{ width: '0%' }}
            />
          </div>

          {/* Interactive range input */}
          <input
            ref={sliderRef}
            type="range"
            min={0}
            max={Math.max(0, totalCommits - 1)}
            step={0.01}
            defaultValue={0}
            onChange={(e) => {
              setPlaying(false)
              setCommitIndex(parseFloat(e.target.value))
            }}
            className="relative z-10 w-full accent-cyan-400 cursor-pointer h-2 opacity-0 hover:opacity-40 transition"
          />
        </div>

        {/* Auto-Pace and Speed Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Auto-Pace Option Pills */}
          <div className="flex items-center gap-1 bg-[#131630] border border-[#2b305e] p-1 rounded-xl text-[10px] font-mono">
            <span className="text-[9px] text-slate-500 px-1 font-pixel hidden sm:inline">
              PACE
            </span>
            {([15, 30, 60] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setAutoPaceDuration(autoPaceDuration === d ? null : d)}
                className={`px-1.5 py-0.5 rounded font-pixel transition ${
                  autoPaceDuration === d
                    ? 'bg-amber-400 text-black shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={`Fit entire history into ${d} seconds (auto-paces based on commit size)`}
              >
                {d}s
              </button>
            ))}
          </div>

          {/* Speed Controls (1x, 10x, 100x, 1000x) */}
          <div className="flex items-center gap-1 bg-[#131630] border border-[#2b305e] p-1 rounded-xl text-xs font-mono">
            {([1, 10, 100, 1000] as TimelineSpeed[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setAutoPaceDuration(null)
                  setSpeed(s)
                }}
                className={`px-2 py-1 rounded-lg transition font-bold ${
                  speed === s && autoPaceDuration === null
                    ? 'bg-gradient-to-tr from-cyan-500 to-fuchsia-500 text-black shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
