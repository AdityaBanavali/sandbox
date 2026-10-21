export interface GitFileChange {
  path: string;
  status: string; // 'M' | 'A' | 'D' | 'R' | 'U' | '??'
  staged: boolean;
}

export interface DetailedGitStatus {
  branch: string;
  isClean: boolean;
  ahead: number;
  behind: number;
  staged: GitFileChange[];
  unstaged: GitFileChange[];
  untracked: string[];
  conflicted: string[];
}

export interface GitBranch {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
  commitHash: string;
  commitMessage: string;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  relativeTime: string;
  date: string;
  message: string;
  parents: string[];
}

export interface GitStash {
  index: number;
  name: string;
  branch: string;
  message: string;
  relativeTime: string;
}

export interface GitBlame {
  commitHash: string;
  authorName: string;
  authorEmail: string;
  relativeTime: string;
  lineNumber: number;
  lineContent: string;
  summary: string;
}

export interface ConflictBlock {
  id: string;
  startLine: number;
  middleLine: number;
  endLine: number;
  currentLabel: string;
  currentContent: string;
  incomingLabel: string;
  incomingContent: string;
}
