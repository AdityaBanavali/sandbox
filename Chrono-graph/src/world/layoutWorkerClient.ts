import type { IngestedRepoData } from '../data/types'
import { computeLayout, type CityLayout } from './layout'

let workerInstance: Worker | null = null

function getWorker(): Worker | null {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return null
  if (!workerInstance) {
    try {
      workerInstance = new Worker(new URL('./layoutWorker.ts', import.meta.url), {
        type: 'module',
      })
    } catch {
      workerInstance = null
    }
  }
  return workerInstance
}

export async function computeLayoutAsync(data: IngestedRepoData): Promise<CityLayout> {
  const worker = getWorker()
  if (!worker) {
    return computeLayout(data)
  }

  return new Promise<CityLayout>((resolve, reject) => {
    const id = Math.random().toString(36).substring(2, 9)
    const onMessage = (e: MessageEvent) => {
      if (e.data && e.data.id === id) {
        worker.removeEventListener('message', onMessage)
        if (e.data.error) {
          reject(new Error(e.data.error))
        } else {
          resolve(e.data.layout)
        }
      }
    }
    worker.addEventListener('message', onMessage)
    worker.postMessage({ id, data })
  })
}
