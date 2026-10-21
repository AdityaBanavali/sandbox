import React, { useState } from 'react'
import { useRepoStore, useUIStore } from '../store'
import { recordHistoryVideo } from '../data/recorder'
import { Video, Film, Clock, Sparkles, X, Download, Loader2 } from 'lucide-react'

export const RecordModal: React.FC = () => {
  const { data } = useRepoStore()
  const {
    isRecordModalOpen,
    setRecordModalOpen,
    autoPaceDuration,
    setAutoPaceDuration,
    isRecording,
    recordingStatus,
    recordingProgress,
  } = useUIStore()

  const [selectedDuration, setSelectedDuration] = useState<15 | 30 | 60>(
    (autoPaceDuration as 15 | 30 | 60) || 30
  )
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!isRecordModalOpen || !data) return null

  const handleStartRecording = async () => {
    setErrorMsg(null)
    setAutoPaceDuration(selectedDuration)
    try {
      await recordHistoryVideo({
        data,
        targetDurationSeconds: selectedDuration,
      })
      setRecordModalOpen(false)
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Recording failed to complete')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#030408]/90 backdrop-blur-md select-none font-mono">
      {/* Scanline overlay */}
      <div className="crt-overlay absolute inset-0 z-10" />

      <div className="relative z-20 w-full max-w-lg bg-[#090b1c] border-2 border-rose-500/60 rounded-2xl p-6 shadow-[0_0_50px_rgba(244,63,94,0.25)] flex flex-col gap-5 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
              <Video className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <span className="font-pixel text-xs text-slate-100">
                EXPORT 1080P CINEMATIC VIDEO
              </span>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                WebM / MP4 • Canvas Stream • 30 FPS Stable
              </p>
            </div>
          </div>

          {!isRecording && (
            <button
              onClick={() => setRecordModalOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Recording in Progress State */}
        {isRecording ? (
          <div className="flex flex-col gap-4 py-4">
            <div className="flex items-center justify-between text-xs font-pixel text-rose-400">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {recordingStatus || 'Recording video...'}
              </span>
              <span>{recordingProgress}%</span>
            </div>

            <div className="w-full h-3 bg-[#04050d] rounded-full overflow-hidden border border-rose-900">
              <div
                className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 transition-all duration-200"
                style={{ width: `${recordingProgress}%` }}
              />
            </div>

            <p className="text-[11px] text-slate-400 font-mono text-center">
              Please keep this browser window focused while frames are captured.
            </p>
          </div>
        ) : (
          /* Pre-record Options */
          <div className="flex flex-col gap-4">
            {/* Auto-pace Target Duration */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-pixel text-rose-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                AUTO-PACE TARGET DURATION:
              </label>

              <div className="grid grid-cols-3 gap-2">
                {[15, 30, 60].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setSelectedDuration(sec as 15 | 30 | 60)}
                    className={`py-2.5 px-3 rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                      selectedDuration === sec
                        ? 'bg-rose-950/60 border-rose-500 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                        : 'bg-[#10132a] border-[#25294e] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="font-pixel text-xs">{sec}s</span>
                    <span className="text-[9px] font-mono text-slate-500">
                      {sec === 15 ? 'Fast Teaser' : sec === 30 ? 'Recommended' : 'Detailed'}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                Speed adapts dynamically: slows down during high-commit spikes and speeds through quiet stretches.
              </p>
            </div>

            {/* Features Included List */}
            <div className="bg-[#10132a] border border-[#25294e] p-3 rounded-xl flex flex-col gap-2 text-xs">
              <span className="font-pixel text-[10px] text-slate-300">
                INCLUDED IN VIDEO:
              </span>
              <div className="flex flex-col gap-1.5 text-[11px] text-slate-400 font-mono">
                <span className="flex items-center gap-1.5 text-cyan-300">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  Intro card: &quot;X Years of {data.repo} in {selectedDuration}s&quot;
                </span>
                <span className="flex items-center gap-1.5 text-fuchsia-300">
                  <Film className="w-3.5 h-3.5 text-fuchsia-400" />
                  Cinematic auto-orbit camera with dramatic fly-bys
                </span>
                <span className="flex items-center gap-1.5 text-amber-300">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Bottom caption: Repo name + timeline year counter
                </span>
                <span className="flex items-center gap-1.5 text-emerald-300">
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  Outro card with final stats recap
                </span>
              </div>
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-400 bg-rose-950/40 p-2 rounded-lg border border-rose-800">
                {errorMsg}
              </p>
            )}

            {/* Start Button */}
            <button
              onClick={handleStartRecording}
              className="w-full py-3 bg-gradient-to-r from-rose-600 via-fuchsia-600 to-amber-500 hover:brightness-110 text-black font-pixel text-xs tracking-wider rounded-xl shadow-[0_0_25px_rgba(244,63,94,0.4)] transition active:scale-98 flex items-center justify-center gap-2"
            >
              <Video className="w-4 h-4 fill-current" />
              START RECORDING (1080P)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
