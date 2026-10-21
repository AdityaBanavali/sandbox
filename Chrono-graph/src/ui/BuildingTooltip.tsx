import React from 'react'
import { useUIStore } from '../store'
import { FileCode, Flame, User, Box } from 'lucide-react'

export const BuildingTooltip: React.FC = () => {
  const hoveredBuilding = useUIStore((s) => s.hoveredBuilding)
  const isCinematicMode = useUIStore((s) => s.isCinematicMode)

  if (isCinematicMode || !hoveredBuilding) return null

  // Format filename and parent directory
  const parts = hoveredBuilding.path.split('/')
  const fileName = parts.pop() || hoveredBuilding.path
  const dirPath = parts.join('/')

  // Clamp position to avoid falling offscreen
  const x = Math.min(window.innerWidth - 240, Math.max(16, hoveredBuilding.screenX + 16))
  const y = Math.min(window.innerHeight - 180, Math.max(16, hoveredBuilding.screenY - 30))

  return (
    <div
      className="fixed z-40 pointer-events-none transition-all duration-75 ease-out select-none"
      style={{ left: `${x}px`, top: `${y}px` }}
    >
      <div className="relative bg-[#090b1c]/95 border border-cyan-400/80 rounded-xl p-3 shadow-[0_0_25px_rgba(0,240,255,0.35)] backdrop-blur-md flex flex-col gap-2 max-w-[280px] font-mono">
        {/* Retro scanline overlay */}
        <div className="crt-overlay absolute inset-0 rounded-xl" />

        {/* Header: District + touches rank */}
        <div className="flex items-center justify-between gap-2 border-b border-cyan-950 pb-1.5">
          <div className="flex items-center gap-1.5 text-[9px] font-pixel text-cyan-400 truncate">
            <Box className="w-3 h-3 text-cyan-400 flex-shrink-0" />
            <span className="truncate">{hoveredBuilding.districtName}</span>
          </div>
          <span className="text-[9px] px-1.5 py-0.5 bg-cyan-950 border border-cyan-700 text-cyan-300 font-pixel rounded flex items-center gap-1">
            <Flame className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
            {hoveredBuilding.touches}
          </span>
        </div>

        {/* File name and full path */}
        <div className="flex flex-col">
          <span className="font-bold text-xs text-slate-100 flex items-center gap-1.5 break-all">
            <FileCode className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            {fileName}
          </span>
          {dirPath && (
            <span className="text-[10px] text-slate-400 truncate mt-0.5">
              {dirPath}/
            </span>
          )}
        </div>

        {/* Author badge */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800">
          <span className="flex items-center gap-1 text-slate-500">
            <User className="w-3 h-3" />
            LAST AUTHOR:
          </span>
          <span className="text-fuchsia-300 font-semibold truncate ml-2">
            {hoveredBuilding.lastAuthor}
          </span>
        </div>
      </div>
    </div>
  )
}
