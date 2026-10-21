import React, { useState } from 'react'
import { useRepoStore } from '../store'
import { KeyRound, RefreshCw, AlertCircle, Sparkles, Database } from 'lucide-react'

export const HeaderBar: React.FC = () => {
  const {
    data,
    isLoading,
    progressMessage,
    errorMessage,
    token,
    rateLimit,
    setToken,
    loadRepo,
    clearError,
  } = useRepoStore()

  const [inputVal, setInputVal] = useState('')
  const [showTokenModal, setShowTokenModal] = useState(false)
  const [tokenInput, setTokenInput] = useState(token)

  const handleLoad = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputVal.trim()) {
      loadRepo(inputVal.trim())
    }
  }

  const handleSaveToken = () => {
    setToken(tokenInput)
    setShowTokenModal(false)
  }

  return (
    <header className="absolute top-0 left-0 right-0 z-20 p-4 pointer-events-none flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        {/* Logo & title */}
        <div className="flex items-center gap-3 bg-[#0c0d1c]/90 border border-[#2a2c4e] backdrop-blur-md px-4 py-2 rounded-xl pointer-events-auto shadow-xl">
          <div className="w-7 h-7 rounded bg-gradient-to-tr from-cyan-500 to-fuchsia-500 flex items-center justify-center font-black text-black text-sm tracking-tighter">
            CG
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-wider text-slate-100 flex items-center gap-1.5">
              CHRONO<span className="text-cyan-400">GRAPH</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-cyan-950 border border-cyan-800 text-cyan-400 rounded uppercase font-mono">
                3D VOXEL
              </span>
            </span>
            {data && (
              <span className="text-[11px] text-slate-400 font-mono">
                {data.repo} • {data.totalCommits} commits
              </span>
            )}
          </div>
        </div>

        {/* Repo Search & Sample Button */}
        <form
          onSubmit={handleLoad}
          className="flex items-center gap-2 bg-[#0c0d1c]/90 border border-[#2a2c4e] backdrop-blur-md px-3 py-1.5 rounded-xl pointer-events-auto shadow-xl"
        >
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="owner/repo or GitHub URL..."
            className="bg-[#14162c] text-slate-100 text-xs px-3 py-1.5 rounded-lg border border-[#30335e] focus:outline-none focus:border-cyan-400 w-60 placeholder:text-slate-500 font-mono"
          />
          <button
            type="submit"
            disabled={isLoading || !inputVal.trim()}
            className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-medium transition flex items-center gap-1.5 disabled:opacity-40"
          >
            {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Inspect'}
          </button>
          <button
            type="button"
            onClick={() => loadRepo('AdityaBanavali/Geospatial_watershed')}
            disabled={isLoading}
            className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-medium transition flex items-center gap-1.5 disabled:opacity-40"
            title="Preset: AdityaBanavali/Geospatial_watershed"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            Watershed
          </button>
          <button
            type="button"
            onClick={() => loadRepo('sample')}
            disabled={isLoading}
            className="px-3 py-1.5 bg-fuchsia-500/20 hover:bg-fuchsia-500/30 text-fuchsia-300 border border-fuchsia-500/40 rounded-lg text-xs font-medium transition flex items-center gap-1.5 disabled:opacity-40"
            title="Preset: Built-in 300 commit sample"
          >
            Sample
          </button>
        </form>

        {/* Rate Limit & PAT Token Button */}
        <div className="flex items-center gap-2 bg-[#0c0d1c]/90 border border-[#2a2c4e] backdrop-blur-md px-3 py-1.5 rounded-xl pointer-events-auto shadow-xl text-xs">
          {rateLimit ? (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono ${
                rateLimit.remaining < 10
                  ? 'bg-rose-950/80 border border-rose-700 text-rose-300'
                  : 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
              }`}
              title={`API Limit: ${rateLimit.remaining}/${rateLimit.limit} remaining. Resets at ${new Date(rateLimit.reset).toLocaleTimeString()}`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>
                {rateLimit.remaining}/{rateLimit.limit}
              </span>
            </div>
          ) : (
            <div className="text-slate-400 font-mono px-2 py-1 text-[11px]">
              Rate Limit: 60/hr
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowTokenModal(true)}
            className={`p-1.5 rounded-lg border transition ${
              token
                ? 'border-emerald-600/50 bg-emerald-950/50 text-emerald-300 hover:bg-emerald-900/50'
                : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title={token ? 'GitHub Personal Access Token set' : 'Configure GitHub Personal Access Token'}
          >
            <KeyRound className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Loading Progress Indicator */}
      {isLoading && (
        <div className="self-center bg-[#0d0f22]/95 border border-cyan-500/40 text-cyan-300 px-4 py-1.5 rounded-full text-xs font-mono flex items-center gap-2 shadow-2xl backdrop-blur pointer-events-auto animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
          <span>{progressMessage || 'Processing git timeline...'}</span>
        </div>
      )}

      {/* Error banner */}
      {errorMessage && (
        <div className="self-center bg-rose-950/95 border border-rose-600 text-rose-200 px-4 py-2 rounded-xl text-xs max-w-xl flex items-center justify-between gap-3 shadow-2xl backdrop-blur pointer-events-auto">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={clearError}
            className="text-rose-400 hover:text-rose-100 font-bold px-1.5 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* PAT Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center pointer-events-auto p-4">
          <div className="bg-[#0f1124] border border-[#2a2c4e] rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-cyan-400" />
                GitHub Personal Access Token (PAT)
              </h3>
              <button
                onClick={() => setShowTokenModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Without a token, GitHub limits unauthenticated requests to 60/hr. Adding a read-only token
              boosts the limit to 5,000/hr. The token is saved only in your browser&apos;s localStorage.
            </p>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="bg-[#161834] text-slate-100 text-xs px-3 py-2 rounded-lg border border-[#30335e] focus:outline-none focus:border-cyan-400 font-mono"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setTokenInput('')
                  setToken('')
                  setShowTokenModal(false)
                }}
                className="px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-950/40 rounded-lg transition"
              >
                Clear Token
              </button>
              <button
                type="button"
                onClick={handleSaveToken}
                className="px-4 py-1.5 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-black rounded-lg transition"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
