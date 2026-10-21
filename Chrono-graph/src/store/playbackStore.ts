import { create } from 'zustand'

interface PlaybackState {
  currentCommitIndex: number
  isPlaying: boolean
  speed: number
  inspectedBuildingId: string | null

  // Actions
  setCommitIndex: (index: number) => void
  setPlaying: (playing: boolean) => void
  togglePlay: () => void
  setSpeed: (speed: number) => void
  stepNext: (totalCommits: number) => void
  stepPrev: () => void
  setInspectedBuildingId: (id: string | null) => void
  calculateDwellMs: (totalCommits: number) => number
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  currentCommitIndex: 0,
  isPlaying: false,
  speed: 1,
  inspectedBuildingId: null,

  setCommitIndex: (index: number) => set({ currentCommitIndex: Math.max(0, index) }),

  setPlaying: (playing: boolean) => set({ isPlaying: playing }),

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  setSpeed: (speed: number) => set({ speed }),

  stepNext: (totalCommits: number) => {
    const { currentCommitIndex } = get()
    if (currentCommitIndex < totalCommits - 1) {
      set({ currentCommitIndex: currentCommitIndex + 1 })
    } else {
      set({ isPlaying: false })
    }
  },

  stepPrev: () => {
    const { currentCommitIndex } = get()
    if (currentCommitIndex > 0) {
      set({ currentCommitIndex: currentCommitIndex - 1 })
    }
  },

  setInspectedBuildingId: (id: string | null) => set({ inspectedBuildingId: id }),

  calculateDwellMs: (totalCommits: number) => {
    const { speed } = get()
    // Auto-pace: 12-15s for small repos, min 400ms per commit
    const TARGET_DURATION_MS = 12500
    const MIN_DWELL_MS = 400
    const base = Math.max(MIN_DWELL_MS, TARGET_DURATION_MS / Math.max(1, totalCommits))
    return Math.round(base / speed)
  },
}))
