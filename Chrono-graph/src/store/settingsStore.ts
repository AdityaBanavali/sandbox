import { create } from 'zustand'
import { sound } from '../data/sound'

export type QualityPreset = 'low' | 'med' | 'high'

export interface SettingsState {
  quality: QualityPreset
  bloom: boolean
  shadows: boolean
  maxAvatars: number
  dpr: number
  soundEnabled: boolean
  reducedMotion: boolean

  // Actions
  setQuality: (quality: QualityPreset) => void
  toggleSound: () => void
  setSoundEnabled: (enabled: boolean) => void
  setReducedMotion: (enabled: boolean) => void
  toggleReducedMotion: () => void
}

const SETTINGS_KEY = 'chronograph_settings_v1'

function autoDetectQuality(): QualityPreset {
  if (typeof navigator === 'undefined') return 'high'
  const cores = navigator.hardwareConcurrency || 4
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  if (isMobile || cores <= 4) return 'med'
  if (cores <= 2) return 'low'
  return 'high'
}

function autoDetectReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function loadPersistedSettings(): Partial<SettingsState> {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

const initialQuality = (loadPersistedSettings().quality as QualityPreset) || autoDetectQuality()
const initialReducedMotion = loadPersistedSettings().reducedMotion ?? autoDetectReducedMotion()

const qualityConfigs: Record<QualityPreset, { bloom: boolean; shadows: boolean; maxAvatars: number; dpr: number }> = {
  low: { bloom: false, shadows: false, maxAvatars: 3, dpr: 1 },
  med: { bloom: true, shadows: false, maxAvatars: 6, dpr: 1.5 },
  high: { bloom: true, shadows: true, maxAvatars: 12, dpr: typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1.5) : 1.5 },
}

export const useSettingsStore = create<SettingsState>((set, get) => {
  const config = qualityConfigs[initialQuality]

  return {
    quality: initialQuality,
    bloom: config.bloom,
    shadows: config.shadows,
    maxAvatars: config.maxAvatars,
    dpr: config.dpr,
    soundEnabled: false, // Off by default
    reducedMotion: initialReducedMotion,

    setQuality: (quality: QualityPreset) => {
      const cfg = qualityConfigs[quality]
      set({
        quality,
        bloom: cfg.bloom,
        shadows: cfg.shadows,
        maxAvatars: cfg.maxAvatars,
        dpr: cfg.dpr,
      })
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...get(), quality }))
      } catch {}
    },

    toggleSound: () => {
      const next = !get().soundEnabled
      sound.setMuted(!next)
      set({ soundEnabled: next })
    },

    setSoundEnabled: (enabled: boolean) => {
      sound.setMuted(!enabled)
      set({ soundEnabled: enabled })
    },

    setReducedMotion: (enabled: boolean) => {
      set({ reducedMotion: enabled })
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...get(), reducedMotion: enabled }))
      } catch {}
    },

    toggleReducedMotion: () => {
      const next = !get().reducedMotion
      set({ reducedMotion: next })
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...get(), reducedMotion: next }))
      } catch {}
    },
  }
})
