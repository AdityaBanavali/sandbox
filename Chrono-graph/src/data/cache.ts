import type { IngestedRepoData } from './types'

const DB_NAME = 'chronograph_db'
const DB_VERSION = 1
const STORE_NAME = 'repo_cache'

interface CacheEntry {
  key: string
  data: IngestedRepoData
  timestamp: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported in this environment.'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function getCachedRepo(key: string): Promise<IngestedRepoData | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(key.toLowerCase())

      req.onsuccess = () => {
        const result = req.result as CacheEntry | undefined
        resolve(result ? result.data : null)
      }
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn('IndexedDB read failed:', err)
    return null
  }
}

export async function setCachedRepo(key: string, data: IngestedRepoData): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const entry: CacheEntry = {
        key: key.toLowerCase(),
        data,
        timestamp: Date.now(),
      }
      const req = store.put(entry)

      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn('IndexedDB write failed:', err)
  }
}

export async function clearCachedRepo(key: string): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.delete(key.toLowerCase())

      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn('IndexedDB delete failed:', err)
  }
}
