import React, { useState } from 'react'
import { useRepoStore, useUIStore } from '../store'
import { Logo } from './Logo'
import { Terminal, Sparkles, KeyRound, ArrowRight, X, Play } from 'lucide-react'

interface PresetItem {
  id: string
  name: string
  ownerRepo: string
  desc: string
  tag: string
  color: string
  commits: string
}

const PRESETS: PresetItem[] = [
  {
    id: 'linux',
    name: 'LINUX KERNEL',
    ownerRepo: 'torvalds/linux',
    desc: 'The monolithic giant of operating systems',
    tag: 'C / OS',
    color: '#f59e0b',
    commits: '300 commits',
  },
  {
    id: 'react',
    name: 'REACT',
    ownerRepo: 'facebook/react',
    desc: 'Component declarative UI revolution',
    tag: 'TypeScript / UI',
    color: '#00f0ff',
    commits: '300 commits',
  },
  {
    id: 'redis',
    name: 'REDIS',
    ownerRepo: 'redis/redis',
    desc: 'In-memory data structure store',
    tag: 'C / Database',
    color: '#ef4444',
    commits: '250 commits',
  },
  {
    id: 'vue',
    name: 'VUE.JS',
    ownerRepo: 'vuejs/core',
    desc: 'Progressive reactive JavaScript framework',
    tag: 'TypeScript / Web',
    color: '#10b981',
    commits: '250 commits',
  },
  {
    id: 'geospatial_watershed',
    name: 'WATERSHED',
    ownerRepo: 'AdityaBanavali/Geospatial_watershed',
    desc: 'Python geospatial hydrology pipeline',
    tag: 'Python / Geo',
    color: '#8b5cf6',
    commits: '25 commits',
  },
  {
    id: 'sample',
    name: 'SAMPLE REPO',
    ownerRepo: 'chronograph/sample',
    desc: 'Synthetic multi-module playground',
    tag: 'Multi-lang',
    color: '#ec4899',
    commits: '300 commits',
  },
]

export const LandingScreen: React.FC = () => {
  const { data, loadRepo, isLoading, token, setToken } = useRepoStore()
  const { isLandingOpen, setLandingOpen } = useUIStore()

  const [inputVal, setInputVal] = useState('')
  const [tokenVal, setTokenVal] = useState(token)
  const [showTokenSettings, setShowTokenSettings] = useState(false)
  const [errorNotice, setErrorNotice] = useState<string | null>(null)

  // If repo is loaded and landing is not toggled open, hide it
  if (data && !isLandingOpen) {
    return null
  }

  const handleLaunch = async (targetRepo: string) => {
    if (!targetRepo.trim()) return
    setErrorNotice(null)
    try {
      await loadRepo(targetRepo.trim())
      setLandingOpen(false)
    } catch (err: unknown) {
      setErrorNotice(err instanceof Error ? err.message : 'Failed to launch repository')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleLaunch(inputVal)
  }

  const handleSaveToken = () => {
    setToken(tokenVal.trim())
    setShowTokenSettings(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 overflow-y-auto bg-[#030408]/92 backdrop-blur-xl">
      {/* Glitchy Neon Retro Synthwave Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-40">
        <div
          className="absolute inset-0 animate-grid-scroll"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(0, 240, 255, 0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(217, 70, 239, 0.15) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            transform: 'perspective(500px) rotateX(55deg) translateY(-20%)',
            transformOrigin: 'top center',
            height: '200%',
          }}
        />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-r from-cyan-500/20 via-fuchsia-500/20 to-purple-600/20 blur-[120px] rounded-full" />
      </div>

      {/* CRT scanline layer */}
      <div className="crt-overlay absolute inset-0 z-10" />

      {/* Main Container Card */}
      <div className="relative z-20 w-full max-w-4xl bg-[#090b17]/95 border-2 border-cyan-500/40 rounded-2xl p-6 md:p-8 shadow-[0_0_50px_rgba(0,240,255,0.2)] flex flex-col gap-6 text-slate-100">
        {/* Dismiss Button if data is already loaded */}
        {data && (
          <button
            onClick={() => setLandingOpen(false)}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-cyan-300 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500/50 rounded-lg transition"
            title="Return to City"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header / Big Retro Title with Animated Voxel Logo */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-400/40 text-cyan-300 text-[10px] font-pixel tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
            ARCADE GIT VOXEL VISUALIZER
          </div>

          <Logo size={84} animated={true} showWordmark={true} className="my-1 justify-center" />

          <p className="text-xs sm:text-sm text-slate-400 max-w-lg font-mono">
            Watch repositories morph into living voxel metropolises as their git history unfolds.
          </p>
        </div>

        {/* Custom Input Bar */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <label className="text-[11px] font-pixel text-cyan-400 tracking-wider flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5" />
            ENTER GITHUB REPOSITORY:
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="e.g. torvalds/linux or https://github.com/facebook/react"
                className="w-full bg-[#101326] border-2 border-[#2b305c] focus:border-cyan-400 focus:outline-none focus:box-glow-cyan text-slate-100 placeholder:text-slate-600 px-4 py-3 rounded-xl font-mono text-xs sm:text-sm transition"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !inputVal.trim()}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-pixel text-xs tracking-wider rounded-xl transition flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,240,255,0.4)] disabled:opacity-40"
            >
              LAUNCH <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          {errorNotice && (
            <p className="text-xs text-rose-400 font-mono mt-1 bg-rose-950/40 border border-rose-800/60 p-2 rounded-lg">
              {errorNotice}
            </p>
          )}
        </form>

        {/* Presets Grid */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-pixel text-fuchsia-400 tracking-wider">
              SELECT PRESET REPOSITORY:
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              Fast load (pre-ingested)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleLaunch(preset.id)}
                disabled={isLoading}
                className="group relative text-left p-3.5 rounded-xl bg-[#101328]/80 hover:bg-[#161a38] border border-[#272b52] hover:border-cyan-400/70 transition flex flex-col justify-between gap-2.5 overflow-hidden shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-pixel text-[11px] text-slate-200 group-hover:text-cyan-300 transition">
                    {preset.name}
                  </div>
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold"
                    style={{
                      backgroundColor: `${preset.color}22`,
                      color: preset.color,
                      border: `1px solid ${preset.color}55`,
                    }}
                  >
                    {preset.tag}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 font-mono line-clamp-1">
                  {preset.desc}
                </p>

                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-slate-800/80 pt-2">
                  <span>{preset.commits}</span>
                  <span className="text-cyan-400 group-hover:translate-x-1 transition flex items-center gap-1">
                    Play <Play className="w-2.5 h-2.5 fill-current" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Options & Token Settings */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs font-mono">
          <button
            type="button"
            onClick={() => setShowTokenSettings(!showTokenSettings)}
            className="flex items-center gap-1.5 text-slate-400 hover:text-cyan-400 transition"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>GitHub PAT Token {token ? '(Active ✓)' : '(Optional)'}</span>
          </button>

          <div className="text-[11px] text-slate-500 flex items-center gap-4">
            <span>Client-side only</span>
            <span>•</span>
            <span>60 FPS Instanced Voxels</span>
          </div>
        </div>

        {/* Collapsible Token input drawer */}
        {showTokenSettings && (
          <div className="p-3 rounded-xl bg-[#0e1022] border border-amber-500/30 flex flex-col sm:flex-row gap-2 items-center">
            <input
              type="password"
              value={tokenVal}
              onChange={(e) => setTokenVal(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx (Stored locally in your browser)"
              className="flex-1 bg-[#14162e] border border-slate-700 text-xs text-slate-200 px-3 py-2 rounded-lg font-mono focus:outline-none focus:border-amber-400 w-full"
            />
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleSaveToken}
                className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black font-pixel text-[10px] rounded-lg transition flex-1 sm:flex-none"
              >
                SAVE
              </button>
              {token && (
                <button
                  type="button"
                  onClick={() => {
                    setToken('')
                    setTokenVal('')
                  }}
                  className="px-3 py-2 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 font-pixel text-[10px] rounded-lg transition"
                >
                  CLEAR
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
