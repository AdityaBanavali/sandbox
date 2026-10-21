import React from 'react'
import { useUIStore } from '../store'
import { X, Layers, Flame, FileCode, Users, ZoomIn, RotateCcw } from 'lucide-react'

export const DistrictSidePanel: React.FC = () => {
  const { selectedDistrict, setSelectedDistrict, focusCamera, resetCamera, isCinematicMode } =
    useUIStore()

  if (isCinematicMode || !selectedDistrict) return null

  const handleZoomAgain = () => {
    focusCamera(
      [selectedDistrict.centerX, 0, selectedDistrict.centerZ],
      [
        selectedDistrict.centerX,
        Math.max(16, selectedDistrict.width * 1.1),
        selectedDistrict.centerZ + Math.max(22, selectedDistrict.depth * 1.3),
      ]
    )
  }

  return (
    <div className="fixed top-16 right-4 bottom-24 z-40 w-80 sm:w-96 flex flex-col pointer-events-auto select-none transition-transform animate-in slide-in-from-right duration-200">
      <div className="relative flex-1 bg-[#090b1c]/95 border-2 rounded-2xl p-4 sm:p-5 shadow-[0_0_40px_rgba(0,0,0,0.8)] backdrop-blur-xl flex flex-col gap-4 overflow-hidden"
        style={{
          borderColor: `${selectedDistrict.color}88`,
          boxShadow: `0 0 30px ${selectedDistrict.color}22`,
        }}
      >
        {/* CRT Scanline */}
        <div className="crt-overlay absolute inset-0 rounded-2xl" />

        {/* Header */}
        <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-4 h-4 rounded-sm flex-shrink-0"
              style={{
                backgroundColor: selectedDistrict.color,
                boxShadow: `0 0 10px ${selectedDistrict.color}`,
              }}
            />
            <div>
              <span className="font-pixel text-xs text-slate-100 flex items-center gap-2">
                {selectedDistrict.name}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                DISTRICT TERRITORY
              </span>
            </div>
          </div>

          <button
            onClick={() => setSelectedDistrict(null)}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition"
            title="Close Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* District Metrics Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="bg-[#10132a] border border-slate-800 p-2.5 rounded-xl flex flex-col gap-1">
            <span className="text-[10px] text-slate-500 font-pixel flex items-center gap-1">
              <Layers className="w-3 h-3 text-cyan-400" />
              BUILDINGS
            </span>
            <span className="text-base font-bold text-cyan-300">
              {selectedDistrict.fileCount}
            </span>
          </div>

          <div className="bg-[#10132a] border border-slate-800 p-2.5 rounded-xl flex flex-col gap-1">
            <span className="text-[10px] text-slate-500 font-pixel flex items-center gap-1">
              <Flame className="w-3 h-3 text-amber-400" />
              TOUCHES
            </span>
            <span className="text-base font-bold text-amber-400">
              {selectedDistrict.totalTouches}
            </span>
          </div>
        </div>

        {/* Top District Authors */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-pixel text-fuchsia-400 flex items-center gap-1.5">
            <Users className="w-3 h-3" />
            TERRITORY AUTHORS
          </span>
          <div className="flex flex-col gap-1.5 bg-[#10132a]/80 border border-slate-800/80 p-2 rounded-xl max-h-36 overflow-y-auto">
            {selectedDistrict.topContributors.length > 0 ? (
              selectedDistrict.topContributors.map((c, i) => (
                <div
                  key={c.name}
                  className="flex items-center justify-between text-xs font-mono text-slate-300"
                >
                  <span className="truncate flex items-center gap-1.5">
                    <span className="text-[9px] font-pixel text-slate-500">{i + 1}.</span>
                    {c.name}
                  </span>
                  <span className="text-[10px] font-pixel text-cyan-400">
                    {c.count} touches
                  </span>
                </div>
              ))
            ) : (
              <span className="text-xs text-slate-500 font-mono">No commit details</span>
            )}
          </div>
        </div>

        {/* Files Sample */}
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          <span className="text-[10px] font-pixel text-cyan-400 flex items-center gap-1.5">
            <FileCode className="w-3 h-3" />
            DISTRICT FILES ({selectedDistrict.recentFiles.length})
          </span>
          <div className="flex-1 overflow-y-auto bg-[#10132a]/80 border border-slate-800/80 p-2 rounded-xl flex flex-col gap-1 font-mono text-[11px] text-slate-300">
            {selectedDistrict.recentFiles.map((file) => (
              <div
                key={file}
                className="truncate py-0.5 hover:text-cyan-300 transition"
                title={file}
              >
                • {file}
              </div>
            ))}
          </div>
        </div>

        {/* Camera Control Footer Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
          <button
            onClick={handleZoomAgain}
            className="flex-1 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 rounded-xl text-[10px] font-pixel transition flex items-center justify-center gap-1.5"
          >
            <ZoomIn className="w-3.5 h-3.5" />
            FOCUS CAMERA
          </button>
          <button
            onClick={() => resetCamera()}
            className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-pixel transition flex items-center gap-1.5"
            title="Reset to Full City"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
