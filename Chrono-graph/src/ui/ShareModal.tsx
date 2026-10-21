import React, { useState } from 'react'
import { useRepoStore, useTimelineStore, useUIStore } from '../store'
import { Share2, Copy, Check, X } from 'lucide-react'

export const ShareModal: React.FC = () => {
  const { data } = useRepoStore()
  const { isShareModalOpen, setShareModalOpen } = useUIStore()
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedLinkedin, setCopiedLinkedin] = useState(false)

  if (!isShareModalOpen || !data) return null

  const currentCommitIdx = Math.floor(useTimelineStore.getState().currentCommitIndex)
  const totalCommits = data.totalCommits || 1
  const tProgress = (currentCommitIdx / Math.max(1, totalCommits - 1)).toFixed(2)

  // Construct share URL
  const baseUrl = window.location.origin + window.location.pathname
  const shareUrl = `${baseUrl}?repo=${encodeURIComponent(data.repo)}&t=${tProgress}`

  // Calculate stats for LinkedIn caption
  const uniqueFiles = new Set<string>()
  data.commits.forEach((c) => c.files.forEach((f) => uniqueFiles.add(f.path)))
  const filesCount = uniqueFiles.size

  const firstDate = new Date(data.commits[0]?.date || Date.now())
  const lastDate = new Date(data.commits[totalCommits - 1]?.date || Date.now())
  const diffYears = (lastDate.getTime() - firstDate.getTime()) / (365.25 * 24 * 3600 * 1000)
  const yearsText = diffYears < 0.9 ? `${Math.max(1, Math.round(diffYears * 12))} months` : `${Math.max(1, Math.round(diffYears))} years`

  const topContributors = data.contributors
    .slice(0, 3)
    .map((c) => c.name)
    .join(', ')

  // Formatted LinkedIn post caption
  const linkedInCaption = `🏙️ What does ${yearsText} of git history look like as a 3D retro voxel city?

I just explored the codebase evolution of "${data.repo}" using ChronoGraph:
📊 ${totalCommits} commits rendered as living voxel towers
📁 ${filesCount} files across distinct territory islands
👥 ${data.contributors.length} top contributors (led by ${topContributors})

Watch the repository grow from first commit to today in 3D:
👉 ${shareUrl}

#GitHub #OpenSource #DataVisualization #SoftwareEngineering #Threejs #Web3D #ChronoGraph`

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleCopyLinkedIn = () => {
    navigator.clipboard.writeText(linkedInCaption)
    setCopiedLinkedin(true)
    setTimeout(() => setCopiedLinkedin(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#030408]/90 backdrop-blur-md select-none font-mono">
      {/* Scanline overlay */}
      <div className="crt-overlay absolute inset-0 z-10" />

      <div className="relative z-20 w-full max-w-xl bg-[#090b1c] border-2 border-cyan-500/60 rounded-2xl p-6 shadow-[0_0_50px_rgba(0,240,255,0.25)] flex flex-col gap-5 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Share2 className="w-5 h-5 text-cyan-400" />
            <div>
              <span className="font-pixel text-xs text-slate-100">
                SHARE REPOSITORY VIEW
              </span>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                Timestamp progress: {Math.round(parseFloat(tProgress) * 100)}% ({currentCommitIdx + 1} / {totalCommits})
              </p>
            </div>
          </div>

          <button
            onClick={() => setShareModalOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shareable Link Input */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-pixel text-cyan-400">
            DIRECT SHAREABLE URL:
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 bg-[#10132a] border border-[#2b305c] text-xs text-slate-200 px-3 py-2.5 rounded-xl font-mono select-all focus:outline-none"
            />
            <button
              onClick={handleCopyLink}
              className="px-4 py-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 font-pixel text-[10px] rounded-xl transition flex items-center gap-1.5 shrink-0"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  COPIED!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  COPY
                </>
              )}
            </button>
          </div>
        </div>

        {/* LinkedIn Post Generator */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-pixel text-[#38bdf8] flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 fill-current text-sky-400" viewBox="0 0 24 24">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.64a1.66 1.66 0 1 0 0 3.32 1.66 1.66 0 0 0 0-3.32Z" />
              </svg>
              LINKEDIN POST CAPTION:
            </label>
            <span className="text-[9px] text-slate-500 font-mono">
              Auto-generated with stats
            </span>
          </div>

          <textarea
            readOnly
            rows={6}
            value={linkedInCaption}
            className="w-full bg-[#10132a] border border-[#2b305c] text-[11px] text-slate-300 p-3 rounded-xl font-mono focus:outline-none resize-none leading-relaxed"
          />

          <button
            onClick={handleCopyLinkedIn}
            className="w-full py-2.5 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white font-pixel text-[10px] rounded-xl shadow-lg transition flex items-center justify-center gap-2 active:scale-98"
          >
            {copiedLinkedin ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                LINKEDIN CAPTION COPIED TO CLIPBOARD!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                COPY LINKEDIN CAPTION
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
