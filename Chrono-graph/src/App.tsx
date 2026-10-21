import { useEffect, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  HUDOverlay,
  BuildingTooltip,
  DistrictSidePanel,
  LandingScreen,
  LoadingScreen,
  Timeline,
  CinematicOverlay,
  ShareModal,
  RecordModal,
  ControlsHelp,
} from './ui'
import { CityScene } from './world'
import { useRepoStore, useTimelineStore, useUIStore } from './store'
import { useSettingsStore } from './store/settingsStore'

export default function App() {
  const { loadRepo, data } = useRepoStore()
  const { setCommitIndex } = useTimelineStore()
  const {
    isCinematicMode,
    setCinematicMode,
    toggleCinematicMode,
    resetCamera,
    isHelpOpen,
    setHelpOpen,
  } = useUIStore()
  const { toggleSound } = useSettingsStore()

  // Global hotkeys: Esc exit drone, D toggle drone, R reset camera, M toggle sound, H/? help
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if (e.key === 'Escape') {
        if (isCinematicMode) {
          e.preventDefault()
          setCinematicMode(false)
        } else if (isHelpOpen) {
          e.preventDefault()
          setHelpOpen(false)
        }
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault()
        toggleCinematicMode()
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        resetCamera()
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        toggleSound()
      } else if (e.key === 'h' || e.key === 'H' || e.key === '?') {
        e.preventDefault()
        setHelpOpen(!isHelpOpen)
      }
    }

    window.addEventListener('keydown', handleGlobalKey)
    return () => window.removeEventListener('keydown', handleGlobalKey)
  }, [isCinematicMode, setCinematicMode, toggleCinematicMode, resetCamera, toggleSound, isHelpOpen, setHelpOpen])

  // Parse shareable URL query params on load: ?repo=owner/repo&t=0.4
  useEffect(() => {
    if (!data) {
      const params = new URLSearchParams(window.location.search)
      const repoParam = params.get('repo')
      if (repoParam) {
        loadRepo(repoParam)
      } else {
        loadRepo('sample')
      }
    }
  }, [data, loadRepo])

  // Sync commit index from URL progress param ?t=0.4 or default to HEAD
  useEffect(() => {
    if (data && data.commits.length > 0) {
      const params = new URLSearchParams(window.location.search)
      const tParam = params.get('t')
      if (tParam != null) {
        const floatT = parseFloat(tParam)
        if (!isNaN(floatT)) {
          const targetIdx = Math.min(
            data.commits.length - 1,
            Math.max(0, Math.floor(floatT * (data.commits.length - 1)))
          )
          setCommitIndex(targetIdx)
          return
        }
      }
      setCommitIndex(data.commits.length - 1)
    }
  }, [data, setCommitIndex])

  // Expose stores for inspection/testing in dev
  useEffect(() => {
    if (import.meta.env.DEV) {
      ;(window as any).__UI_STORE__ = useUIStore
      ;(window as any).__REPO_STORE__ = useRepoStore
      ;(window as any).__TIMELINE_STORE__ = useTimelineStore
    }
  }, [])

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#04050b]">
      {/* Top HUD with repo name, leaderboard, district legend, REC, DRONE, SHARE */}
      <HUDOverlay onOpenHelp={() => setHelpOpen(true)} />

      {/* 3D Voxel World */}
      <Canvas
        camera={{ position: [50, 60, 50], fov: 38 }}
        gl={{ antialias: true, alpha: false, stencil: false, depth: true, preserveDrawingBuffer: true }}
      >
        <Suspense fallback={null}>
          {data && <CityScene data={data} />}
        </Suspense>
      </Canvas>

      {/* Hover Tooltip on Buildings */}
      <BuildingTooltip />

      {/* District Stats Side Panel (on click) */}
      <DistrictSidePanel />

      {/* Timeline Controls */}
      <Timeline />

      {/* Cinematic Mode Overlay (Drone Camera Caption Banner) */}
      <CinematicOverlay />

      {/* Share View & LinkedIn Caption Modal */}
      <ShareModal />

      {/* 1080p Video Recording Modal */}
      <RecordModal />

      {/* Controls Help Overlay */}
      <ControlsHelp isOpen={isHelpOpen} onClose={() => setHelpOpen(false)} />

      {/* Landing Screen */}
      <LandingScreen />

      {/* 8-bit Loading Screen */}
      <LoadingScreen />
    </div>
  )
}
