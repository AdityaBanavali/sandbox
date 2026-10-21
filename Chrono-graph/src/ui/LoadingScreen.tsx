import React, { useEffect, useState } from 'react'
import { useRepoStore } from '../store'
import { Logo } from './Logo'
import { Loader2, ShieldAlert } from 'lucide-react'

export const LoadingScreen: React.FC = () => {
  const { isLoading, progressMessage, errorMessage, rateLimit, clearError } = useRepoStore()
  const [fakeStep, setFakeStep] = useState(0)

  // 8-bit animated step ticker while loading
  useEffect(() => {
    if (!isLoading) {
      setFakeStep(0)
      return
    }
    const interval = setInterval(() => {
      setFakeStep((s) => (s + 1) % 12)
    }, 180)
    return () => clearInterval(interval)
  }, [isLoading])

  if (!isLoading && !errorMessage) return null

  const isRateLimited = errorMessage?.includes('rate limit') || (rateLimit && rateLimit.remaining === 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#030408]/90 backdrop-blur-md select-none font-mono">
      {/* Scanline CRT overlay */}
      <div className="crt-overlay absolute inset-0 z-10" />

      <div className="relative z-20 w-full max-w-lg bg-[#090b1c] border-2 border-cyan-500/60 rounded-2xl p-6 shadow-[0_0_50px_rgba(0,240,255,0.3)] flex flex-col gap-5 text-slate-100">
        {/* Error State */}
        {errorMessage ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-rose-400 font-pixel text-xs">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <span>INGESTION ERROR</span>
            </div>

            <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-xl text-xs text-rose-200">
              {errorMessage}
            </div>

            {isRateLimited && (
              <p className="text-[11px] text-amber-300">
                Tip: GitHub allows 60 req/hr unauthenticated. Add a Personal Access Token in the top bar or launch presets (Linux, React, Redis, Vue) to bypass limits.
              </p>
            )}

            <button
              onClick={clearError}
              className="mt-2 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-black font-pixel text-xs rounded-xl transition"
            >
              DISMISS
            </button>
          </div>
        ) : (
          /* Loading State */
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Logo size={36} animated={true} loading={true} />
                <span className="font-pixel text-xs text-cyan-400 text-glow-cyan animate-pulse">
                  PARSING REPO VOXELS...
                </span>
              </div>
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
            </div>

            <p className="text-xs text-slate-300 min-h-[20px] font-mono">
              {progressMessage || 'Initializing GitHub pipeline...'}
            </p>

            {/* 8-bit Stepped Progress Bar */}
            <div className="flex items-center gap-1.5 p-2 bg-[#04050d] border border-cyan-900 rounded-xl">
              {Array.from({ length: 12 }).map((_, idx) => {
                const isActive = idx <= fakeStep
                return (
                  <div
                    key={idx}
                    className={`h-4 flex-1 rounded-xs transition-colors duration-100 ${
                      isActive
                        ? 'bg-cyan-400 shadow-[0_0_8px_#00f0ff]'
                        : 'bg-[#151936]'
                    }`}
                  />
                )
              })}
            </div>

            {/* Rate Limit Info */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800 pt-3">
              <span>GITHUB API CALLS:</span>
              {rateLimit ? (
                <span className="font-bold text-amber-400">
                  {rateLimit.remaining} / {rateLimit.limit} remaining
                </span>
              ) : (
                <span className="text-slate-500">Connecting...</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
