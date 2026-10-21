import { computeLayout } from './layout'
import type { IngestedRepoData } from '../data/types'

self.onmessage = (e: MessageEvent<{ id: string; data: IngestedRepoData }>) => {
  const { id, data } = e.data
  try {
    const layout = computeLayout(data)
    self.postMessage({ id, layout, error: null })
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Layout worker computation failed'
    self.postMessage({ id, layout: null, error })
  }
}
