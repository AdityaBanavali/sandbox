import { create } from 'zustand'
import {
  loadHistory,
  getGitHubToken,
  setGitHubToken,
  subscribeRateLimit,
  type RateLimitState,
  type IngestedRepoData,
} from '../data'

interface RepoStoreState {
  data: IngestedRepoData | null
  isLoading: boolean
  progressMessage: string
  errorMessage: string | null
  token: string
  rateLimit: RateLimitState | null

  // Actions
  setToken: (token: string) => void
  setRateLimit: (rateLimit: RateLimitState) => void
  loadRepo: (input: string, forceRefresh?: boolean) => Promise<void>
  clearError: () => void
}

export const useRepoStore = create<RepoStoreState>((set) => {
  // Sync rate limit changes
  subscribeRateLimit((rateLimit) => {
    set({ rateLimit })
  })

  return {
    data: null,
    isLoading: false,
    progressMessage: '',
    errorMessage: null,
    token: getGitHubToken() || '',
    rateLimit: null,

    setToken: (token: string) => {
      setGitHubToken(token)
      set({ token })
    },

    setRateLimit: (rateLimit) => set({ rateLimit }),

    loadRepo: async (input: string, forceRefresh = false) => {
      set({ isLoading: true, errorMessage: null, progressMessage: 'Connecting...' })
      try {
        const data = await loadHistory(input, {
          forceRefresh,
          onProgress: (msg) => set({ progressMessage: msg }),
        })
        set({ data, isLoading: false, progressMessage: '' })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load repository'
        set({ isLoading: false, errorMessage: msg, progressMessage: '' })
      }
    },

    clearError: () => set({ errorMessage: null }),
  }
})
