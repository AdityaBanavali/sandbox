import React, { useEffect, useState } from 'react'
import { X, Keyboard, HelpCircle } from 'lucide-react'

export interface ControlsHelpProps {
  isOpen?: boolean
  onClose?: () => void
}

export const ControlsHelp: React.FC<ControlsHelpProps> = ({
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
}) => {
  const [internalOpen, setInternalOpen] = useState(false)

  // Show once automatically on first load (persisted via localStorage)
  useEffect(() => {
    const hasSeen = localStorage.getItem('chronograph_help_seen')
    if (!hasSeen) {
      setInternalOpen(true)
      localStorage.setItem('chronograph_help_seen', 'true')
    }
  }, [])

  // Global hotkeys: 'h' or '?' toggles help overlay, 'Escape' closes it
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if (e.key === 'h' || e.key === 'H' || e.key === '?') {
        e.preventDefault()
        if (controlledOnClose && controlledIsOpen !== undefined) {
          // If controlled, toggle outside
        } else {
          setInternalOpen((prev) => !prev)
        }
      } else if (e.key === 'Escape') {
        if (internalOpen) {
          setInternalOpen(false)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [internalOpen, controlledIsOpen, controlledOnClose])

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen
  const handleClose = controlledOnClose || (() => setInternalOpen(false))

  if (!isOpen) return null

  const shortcuts = [
    { key: 'Space', desc: 'Play / Pause timeline playback' },
    { key: '← / →', desc: 'Step backward / forward 1 commit' },
    { key: 'Esc', desc: 'Exit Drone Mode / Close modal panels' },
    { key: 'D', desc: 'Toggle Cinematic Drone Mode' },
    { key: 'R', desc: 'Reset camera to default isometric view' },
    { key: 'M', desc: 'Toggle sound effects & synth ambience' },
    { key: 'H / ?', desc: 'Toggle this Controls Help overlay' },
    { key: 'Click', desc: 'Select building or district island' },
    { key: 'Drag', desc: 'Orbit 3D camera / Scrubber seek' },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#030408]/85 backdrop-blur-md font-mono select-none"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-md bg-[#090b1c] border-2 border-cyan-500/60 rounded-2xl p-6 shadow-[0_0_50px_rgba(0,240,255,0.3)] text-slate-100 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-cyan-400">
            <Keyboard className="w-5 h-5 text-cyan-400" />
            <span className="font-pixel text-xs tracking-wider">CONTROLS & SHORTCUTS</span>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="flex flex-col gap-2.5">
          {shortcuts.map(({ key, desc }) => (
            <div
              key={key}
              className="flex items-center justify-between gap-4 py-1.5 px-2.5 rounded-lg bg-[#0e122b]/60 border border-slate-800/80"
            >
              <kbd className="px-2 py-1 bg-[#1a1f46] border border-cyan-500/40 rounded text-cyan-300 font-pixel text-[10px] min-w-[50px] text-center shadow-inner">
                {key}
              </kbd>
              <span className="text-xs text-slate-300 text-right">{desc}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono">
          <span className="flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
            Press <strong className="text-cyan-300">H</strong> anytime to toggle
          </span>
          <button
            onClick={handleClose}
            className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-black font-pixel text-[10px] rounded-lg transition"
          >
            GOT IT
          </button>
        </div>
      </div>
    </div>
  )
}
