import React, { useState, useEffect } from 'react'
import { useRepoStore, useTimelineStore, useUIStore } from '../store'
import { AvatarIcon } from './AvatarIcon'
import { Logo } from './Logo'
import {
  Users,
  Layers,
  RotateCcw,
  Search,
  ChevronDown,
  ChevronUp,
  Video,
  Film,
  Share2,
  X,
  HelpCircle,
} from 'lucide-react'

export const HUDOverlay: React.FC<{ onOpenHelp?: () => void }> = ({ onOpenHelp }) => {
  const { data, rateLimit } = useRepoStore()
  const { selectedContributor, setSelectedContributor } = useTimelineStore()
  const {
    setLandingOpen,
    resetCamera,
    isCinematicMode,
    setCinematicMode,
    setShareModalOpen,
    setRecordModalOpen,
  } = useUIStore()

  const [currentDateStr, setCurrentDateStr] = useState('')
  const [currentCommitNum, setCurrentCommitNum] = useState(0)
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(true)
  const [isLegendOpen, setIsLegendOpen] = useState(false)

  // Direct subscription to timeline store for zero React re-render overhead on high speed
  useEffect(() => {
    if (!data || data.commits.length === 0) return

    const unsub = useTimelineStore.subscribe((state) => {
      const idx = Math.min(data.commits.length - 1, Math.floor(state.currentCommitIndex))
      const commit = data.commits[idx]
      if (commit) {
        setCurrentCommitNum(idx + 1)
        setCurrentDateStr(commit.date.slice(0, 10))
      }
    })

    // Init
    const initialIdx = Math.min(
      data.commits.length - 1,
      Math.floor(useTimelineStore.getState().currentCommitIndex)
    )
    if (data.commits[initialIdx]) {
      setCurrentCommitNum(initialIdx + 1)
      setCurrentDateStr(data.commits[initialIdx].date.slice(0, 10))
    }

    return () => unsub()
  }, [data])

  if (!data || isCinematicMode) return null

  // Calculate folder districts & colors for legend
  const folderCounts: Record<string, number> = {}
  data.commits.forEach((c) => {
    c.files.forEach((f) => {
      const parts = f.path.split('/')
      const folder = parts.length > 1 ? parts[0] : 'root'
      folderCounts[folder] = (folderCounts[folder] || 0) + 1
    })
  })

  const topFolders = Object.entries(folderCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  // Hash folder to color matching layout.ts
  const getFolderColor = (folder: string) => {
    let hash = 0
    for (let i = 0; i < folder.length; i++) {
      hash = (hash << 5) - hash + folder.charCodeAt(i)
      hash |= 0
    }
    const hue = Math.abs(hash) % 360
    return `hsl(${hue}, 85%, 55%)`
  }

  return (
    <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none z-30 flex flex-col justify-between gap-4 font-mono select-none">
      {/* Top Bar Navigation & Stats */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        {/* Left: Arcade HUD Badge */}
        <div className="flex flex-col gap-2 pointer-events-auto">
          <div className="flex items-center gap-2.5 bg-[#080a18]/90 border border-[#2b2f56] backdrop-blur-md px-3.5 py-2 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.6)]">
            <button
              onClick={() => setLandingOpen(true)}
              className="group flex items-center gap-2 text-left hover:opacity-90 transition"
              title="Open Repository Switcher"
            >
              {/* Static mini ChronoGraph Logo */}
              <div className="p-0.5 group-hover:scale-105 transition-transform">
                <Logo size={28} animated={false} />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-pixel text-xs text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-400">
                    {data.repo}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 bg-cyan-950/80 border border-cyan-800 text-cyan-400 font-pixel rounded">
                    VOXEL
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                  <span className="text-cyan-300">
                    COMMITS: {currentCommitNum} / {data.totalCommits}
                  </span>
                  <span>•</span>
                  <span className="text-amber-400">{currentDateStr || '...'}</span>
                </div>
              </div>
            </button>

            <div className="h-7 w-px bg-slate-800 mx-1" />

            {/* Quick Actions */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setLandingOpen(true)}
                className="px-2.5 py-1.5 bg-[#121633] hover:bg-cyan-950/60 border border-slate-700 hover:border-cyan-500/60 text-cyan-300 rounded-lg text-[10px] font-pixel transition flex items-center gap-1"
                title="Change Repository"
              >
                <Search className="w-3 h-3" />
                REPO
              </button>
              <button
                onClick={() => setRecordModalOpen(true)}
                className="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-700/80 hover:border-rose-500 text-rose-300 rounded-lg text-[10px] font-pixel transition flex items-center gap-1 shadow-[0_0_10px_rgba(244,63,94,0.3)]"
                title="Export 1080p Video"
              >
                <Video className="w-3 h-3 fill-rose-400" />
                REC
              </button>

              {/* Drone Mode Toggle / Exit */}
              {isCinematicMode ? (
                <button
                  onClick={() => setCinematicMode(false)}
                  className="px-2.5 py-1.5 bg-rose-600/90 hover:bg-rose-500 border border-rose-400 text-black font-pixel text-[10px] rounded-lg transition flex items-center gap-1 shadow-[0_0_15px_rgba(244,63,94,0.6)] animate-pulse"
                  title="Exit Drone Mode (Esc)"
                >
                  <X className="w-3 h-3 stroke-[3]" />
                  EXIT DRONE (Esc)
                </button>
              ) : (
                <button
                  onClick={() => setCinematicMode(true)}
                  className="px-2.5 py-1.5 bg-fuchsia-950/60 hover:bg-fuchsia-900/80 border border-fuchsia-700/80 hover:border-fuchsia-500 text-fuchsia-300 rounded-lg text-[10px] font-pixel transition flex items-center gap-1"
                  title="Toggle Drone Mode (D)"
                >
                  <Film className="w-3 h-3" />
                  DRONE
                </button>
              )}

              <button
                onClick={() => setShareModalOpen(true)}
                className="p-1.5 bg-[#121633] hover:bg-cyan-950/60 border border-slate-700 hover:border-cyan-500/60 text-cyan-300 rounded-lg transition"
                title="Share & Copy LinkedIn Caption"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => resetCamera()}
                className="p-1.5 bg-[#121633] hover:bg-slate-800 border border-slate-700 hover:border-slate-500 text-slate-300 rounded-lg transition"
                title="Reset Camera View (R)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onOpenHelp}
                className="p-1.5 bg-[#121633] hover:bg-cyan-950/60 border border-slate-700 hover:border-cyan-500/60 text-cyan-300 rounded-lg transition"
                title="Controls & Shortcuts (H or ?)"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Folder / Language Legend Dropdown */}
          <div className="pointer-events-auto">
            <button
              onClick={() => setIsLegendOpen(!isLegendOpen)}
              className="flex items-center gap-1.5 px-3 py-1 bg-[#080a18]/85 border border-[#2b2f56] rounded-lg text-[10px] text-slate-300 hover:text-cyan-400 transition"
            >
              <Layers className="w-3 h-3 text-cyan-400" />
              <span>DISTRICT LEGEND</span>
              {isLegendOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {isLegendOpen && (
              <div className="mt-1.5 p-2.5 bg-[#080a18]/95 border border-[#2b2f56] backdrop-blur-md rounded-xl flex flex-col gap-1.5 shadow-xl max-w-xs">
                <span className="text-[9px] font-pixel text-slate-400">DISTRICT / FOLDER:</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {topFolders.map(([folder, count]) => {
                    const col = getFolderColor(folder)
                    return (
                      <div
                        key={folder}
                        className="flex items-center gap-1.5 text-[10px] text-slate-300 truncate"
                        title={`${folder}: ${count} touches`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: col, boxShadow: `0 0 6px ${col}` }}
                        />
                        <span className="truncate">{folder}/</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Top Contributors Arcade Leaderboard */}
        <div className="flex flex-col items-end gap-2 pointer-events-auto">
          <div className="bg-[#080a18]/90 border border-[#2b2f56] backdrop-blur-md rounded-xl p-2.5 shadow-[0_0_20px_rgba(0,0,0,0.6)] w-56 sm:w-64 transition-all">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <div className="flex items-center gap-1.5 text-fuchsia-400 font-pixel text-[10px]">
                <Users className="w-3.5 h-3.5" />
                TOP AUTHORS
              </div>
              <button
                onClick={() => setIsLeaderboardOpen(!isLeaderboardOpen)}
                className="text-slate-400 hover:text-slate-200"
              >
                {isLeaderboardOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>

            {isLeaderboardOpen && (
              <div className="flex flex-col gap-1 mt-2 max-h-56 overflow-y-auto pr-1">
                {data.contributors.slice(0, 8).map((author, rank) => {
                  const isSelected = selectedContributor === author.name
                  return (
                    <button
                      key={author.name}
                      onClick={() =>
                        setSelectedContributor(isSelected ? null : author.name)
                      }
                      className={`flex items-center justify-between p-1.5 rounded-lg text-left transition w-full ${
                        isSelected
                          ? 'bg-fuchsia-950/70 border border-fuchsia-500/80'
                          : 'hover:bg-[#121633] border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-[9px] font-pixel text-slate-500 w-3 text-right">
                          {rank + 1}
                        </span>
                        <div className="w-5 h-5 flex items-center justify-center bg-[#151936] rounded border border-slate-700/80 flex-shrink-0">
                          <AvatarIcon
                            name={author.name}
                            shirtColor={author.color}
                            size={16}
                          />
                        </div>
                        <span className="text-[11px] text-slate-200 font-mono truncate">
                          {author.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-pixel text-cyan-400 ml-2">
                        {author.commits}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Rate Limit Badge */}
          {rateLimit && (
            <div className="bg-[#080a18]/80 border border-slate-800 px-2.5 py-1 rounded-lg text-[9px] text-slate-400 flex items-center gap-1.5">
              <span>API LIMIT:</span>
              <span
                className={`font-bold ${
                  rateLimit.remaining < 10
                    ? 'text-rose-400'
                    : rateLimit.remaining < 30
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {rateLimit.remaining}/{rateLimit.limit}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
