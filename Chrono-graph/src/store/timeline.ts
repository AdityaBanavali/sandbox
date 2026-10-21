import { create } from 'zustand'

export type TimelineSpeed = 1 | 10 | 100 | 1000

interface TimelineState {
  currentCommitIndex: number
  playing: boolean
  speed: TimelineSpeed
  earthquakeIntensity: number
  selectedContributor: string | null

  // Actions
  setCommitIndex: (index: number) => void
  setPlaying: (playing: boolean) => void
  togglePlay: () => void
  setSpeed: (speed: TimelineSpeed) => void
  stepForward: (totalCommits: number) => void
  stepBackward: () => void
  triggerEarthquake: () => void
  setEarthquakeIntensity: (intensity: number) => void
  setSelectedContributor: (name: string | null) => void
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  currentCommitIndex: 0,
  playing: false,
  speed: 1,
  earthquakeIntensity: 0,
  selectedContributor: null,

  setCommitIndex: (index: number) => {
    set({ currentCommitIndex: Math.max(0, index) })
  },

  setPlaying: (playing: boolean) => set({ playing }),

  togglePlay: () => set((state) => ({ playing: !state.playing })),

  setSpeed: (speed: TimelineSpeed) => set({ speed }),

  stepForward: (totalCommits: number) => {
    const { currentCommitIndex } = get()
    const next = Math.min(totalCommits - 1, Math.floor(currentCommitIndex + 1))
    set({ currentCommitIndex: next })
  },

  stepBackward: () => {
    const { currentCommitIndex } = get()
    const prev = Math.max(0, Math.ceil(currentCommitIndex - 1))
    set({ currentCommitIndex: prev })
  },

  triggerEarthquake: () => set({ earthquakeIntensity: 1.0 }),

  setEarthquakeIntensity: (intensity: number) => set({ earthquakeIntensity: intensity }),

  setSelectedContributor: (name: string | null) => set({ selectedContributor: name }),
}))
