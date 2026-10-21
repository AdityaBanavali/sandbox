export type FileChangeStatus = 'A' | 'M' | 'D' | 'R' | string

export interface FileChange {
  path: string
  status: FileChangeStatus
  oldPath?: string
}

export interface CommitRecord {
  sha: string
  author: string
  email?: string
  date: string
  message: string
  files: FileChange[]
}

export interface Contributor {
  name: string
  commits: number
  color: string
}

export interface IngestedRepoData {
  repo: string
  totalCommits: number
  commits: CommitRecord[]
  contributors: Contributor[]
}
