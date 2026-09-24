import { invoke } from '@tauri-apps/api/core';
import { isTauriEnvironment } from './tauriBridge';
import { AiService } from './aiService';
import type {
  DetailedGitStatus,
  GitBranch,
  GitCommit,
  GitStash,
  GitBlame,
} from '../types/git';

export const GitService = {
  async getDetailedStatus(cwd?: string): Promise<DetailedGitStatus> {
    if (isTauriEnvironment()) {
      try {
        return await invoke<DetailedGitStatus>('get_detailed_git_status', { cwd: cwd || null });
      } catch (err) {
        console.warn('Tauri get_detailed_git_status failed:', err);
      }
    }

    // Browser fallback
    return {
      branch: 'master',
      isClean: false,
      ahead: 1,
      behind: 0,
      staged: [
        { path: 'src-tauri/src/lib.rs', status: 'M', staged: true },
      ],
      unstaged: [
        { path: 'src/App.tsx', status: 'M', staged: false },
      ],
      untracked: ['src/components/git/BranchManagerModal.tsx'],
      conflicted: [],
    };
  },

  async stagePath(path: string, cwd?: string): Promise<void> {
    if (isTauriEnvironment()) {
      await invoke('git_stage_path', { path, cwd: cwd || null });
      return;
    }
    console.log(`[Mock Git] Staged: ${path}`);
  },

  async unstagePath(path: string, cwd?: string): Promise<void> {
    if (isTauriEnvironment()) {
      await invoke('git_unstage_path', { path, cwd: cwd || null });
      return;
    }
    console.log(`[Mock Git] Unstaged: ${path}`);
  },

  async discardPath(path: string, isUntracked = false, cwd?: string): Promise<void> {
    if (isTauriEnvironment()) {
      await invoke('git_discard_path', { path, isUntracked, cwd: cwd || null });
      return;
    }
    console.log(`[Mock Git] Discarded: ${path}`);
  },

  async commit(message: string, cwd?: string): Promise<string> {
    if (isTauriEnvironment()) {
      return await invoke<string>('git_commit', { message, cwd: cwd || null });
    }
    console.log(`[Mock Git] Commit: ${message}`);
    return `[master abc1234] ${message}`;
  },

  async getDiff(stagedOnly = false, path?: string, cwd?: string): Promise<string> {
    if (isTauriEnvironment()) {
      try {
        return await invoke<string>('git_get_diff', {
          stagedOnly,
          path: path || null,
          cwd: cwd || null,
        });
      } catch (err) {
        console.warn('Tauri git_get_diff failed:', err);
        return '';
      }
    }
    return `diff --git a/file.ts b/file.ts\n--- a/file.ts\n+++ b/file.ts\n@@ -1,3 +1,3 @@\n-old code\n+new code\n`;
  },

  async getBranches(cwd?: string): Promise<GitBranch[]> {
    if (isTauriEnvironment()) {
      try {
        const raw = await invoke<any[]>('git_get_branches', { cwd: cwd || null });
        return raw.map((b) => ({
          name: b.name,
          isCurrent: b.is_current,
          isRemote: b.is_remote,
          commitHash: b.commit_hash,
          commitMessage: b.commit_message,
        }));
      } catch (err) {
        console.warn('Tauri git_get_branches failed:', err);
      }
    }
    return [
      { name: 'master', isCurrent: true, isRemote: false, commitHash: 'e0c2a5d', commitMessage: 'feat(core): initial commit' },
      { name: 'feat/phase-3-git', isCurrent: false, isRemote: false, commitHash: 'fa8201b', commitMessage: 'feat(git): add version control ui' },
      { name: 'origin/master', isCurrent: false, isRemote: true, commitHash: 'e0c2a5d', commitMessage: 'feat(core): initial commit' },
    ];
  },

  async checkoutBranch(branch: string, isNew = false, cwd?: string): Promise<string> {
    if (isTauriEnvironment()) {
      return await invoke<string>('git_checkout', { branch, isNew, cwd: cwd || null });
    }
    return `Switched to branch '${branch}'`;
  },

  async deleteBranch(branch: string, force = false, cwd?: string): Promise<string> {
    if (isTauriEnvironment()) {
      return await invoke<string>('git_delete_branch', { branch, force, cwd: cwd || null });
    }
    return `Deleted branch ${branch}`;
  },

  async getLog(limit = 30, cwd?: string): Promise<GitCommit[]> {
    if (isTauriEnvironment()) {
      try {
        const raw = await invoke<any[]>('git_get_log', { limit, cwd: cwd || null });
        return raw.map((c) => ({
          hash: c.hash,
          shortHash: c.short_hash,
          authorName: c.author_name,
          authorEmail: c.author_email,
          relativeTime: c.relative_time,
          date: c.date,
          message: c.message,
          parents: c.parents || [],
        }));
      } catch (err) {
        console.warn('Tauri git_get_log failed:', err);
      }
    }
    return [
      {
        hash: 'e0c2a5d1d0442a718d1105afc8da0aa2914ee03c',
        shortHash: 'e0c2a5d',
        authorName: 'Aditya Banavali',
        authorEmail: 'aditya@vortex.dev',
        relativeTime: '2 hours ago',
        date: 'Sun Sep 6 00:09:29 2026',
        message: 'feat(core): initial commit for Vortex IDE Phase 1 & 2',
        parents: [],
      },
    ];
  },

  async getStashes(cwd?: string): Promise<GitStash[]> {
    if (isTauriEnvironment()) {
      try {
        const raw = await invoke<any[]>('git_get_stashes', { cwd: cwd || null });
        return raw.map((s) => ({
          index: s.index,
          name: s.name,
          branch: s.branch,
          message: s.message,
          relativeTime: s.relative_time,
        }));
      } catch (err) {
        console.warn('Tauri git_get_stashes failed:', err);
      }
    }
    return [];
  },

  async stashOp(
    op: 'push' | 'pop' | 'apply' | 'drop' | 'clear',
    message?: string,
    index?: number,
    cwd?: string
  ): Promise<string> {
    if (isTauriEnvironment()) {
      return await invoke<string>('git_stash_op', {
        op,
        message: message || null,
        index: index !== undefined ? index : null,
        cwd: cwd || null,
      });
    }
    return `Stash ${op} executed successfully`;
  },

  async getBlameLine(filePath: string, line: number, cwd?: string): Promise<GitBlame | null> {
    if (isTauriEnvironment()) {
      try {
        const raw = await invoke<any>('git_get_blame_line', {
          filePath,
          line,
          cwd: cwd || null,
        });
        if (!raw) return null;
        return {
          commitHash: raw.commit_hash,
          authorName: raw.author_name,
          authorEmail: raw.author_email,
          relativeTime: raw.relative_time,
          lineNumber: raw.line_number,
          lineContent: raw.line_content,
          summary: raw.summary,
        };
      } catch (err) {
        return null;
      }
    }
    return {
      commitHash: 'e0c2a5d',
      authorName: 'Aditya Banavali',
      authorEmail: 'aditya@vortex.dev',
      relativeTime: '1 hour ago',
      lineNumber: line,
      lineContent: '',
      summary: 'feat(core): initial commit',
    };
  },

  async syncRemote(op: 'pull' | 'push' | 'fetch' | 'sync', cwd?: string): Promise<string> {
    if (isTauriEnvironment()) {
      return await invoke<string>('git_sync_remote', { op, cwd: cwd || null });
    }
    return `Git ${op} completed`;
  },

  async generateAiCommitMessage(diffContent: string): Promise<string> {
    const truncatedDiff = diffContent.length > 5000 ? diffContent.slice(0, 5000) + '\n...(truncated)' : diffContent;

    const prompt = `You are an expert software developer writing a Git commit message following the Conventional Commits specification (e.g. feat:, fix:, refactor:, chore:, docs:, style:, test:).
Analyze the following Git diff and output ONLY the commit message in 1 or 2 lines.
Do NOT output markdown blocks, explanations, quotes, or conversational filler.
Prefix with the appropriate type and scope if relevant.

Diff:
\`\`\`diff
${truncatedDiff}
\`\`\``;

    const result = await AiService.sendPrompt(prompt);
    let msg = result.text.trim();
    // Strip possible markdown fences if returned
    msg = msg.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    return msg;
  },
};
