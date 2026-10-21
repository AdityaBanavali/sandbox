import { invoke } from '@tauri-apps/api/core';
import type { FsTreeNode, GitStatus, SearchFileResult, ShellResult } from '../types/editor';

// Check if running inside Tauri desktop app
export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

// In-memory fallback files for standalone browser preview
const MOCK_FILES: Record<string, string> = {
  'src/App.tsx': `import React from 'react';\n// Vortex AI-native IDE entrypoint\nexport function App() {\n  return <div>Welcome to Vortex</div>;\n}\n`,
  'src/main.rs': `// Rust Backend entrypoint\nfn main() {\n    println!("Vortex Engine Initialized.");\n}\n`,
  'src/index.css': `@import "tailwindcss";\n\nbody {\n  margin: 0;\n  background: #0b0b0d;\n  color: #e4e4e7;\n}\n`,
  'package.json': `{\n  "name": "vortex",\n  "version": "0.1.0",\n  "type": "module",\n  "dependencies": {\n    "react": "^19.1.0"\n  }\n}\n`,
  'README.md': `# Vortex IDE\n\nAn AI-Native desktop code editor powered by Tauri, React, and Monaco.\n\n## Features\n- Multi-tab document editor\n- Integrated terminal\n- Global search & replace\n- Command palette\n`,
  'crates/vortex-core/src/lib.rs': `pub fn init() -> Result<(), String> {\n    Ok(())\n}\n`,
};

export const TauriBridge = {
  async getWorkspaceTree(customPath?: string): Promise<FsTreeNode[]> {
    if (isTauriEnvironment()) {
      try {
        const raw = await invoke<any[]>('read_dir_tree', { path: customPath || null });
        const mapNode = (n: any): FsTreeNode => ({
          name: n.name,
          path: n.path,
          isDir: n.is_dir,
          children: n.children ? n.children.map(mapNode) : undefined,
        });
        return raw.map(mapNode);
      } catch (err) {
        console.warn('Tauri read_dir_tree failed, using fallback:', err);
      }
    }

    // Return fallback tree
    return [
      {
        name: 'src',
        path: 'src',
        isDir: true,
        children: [
          { name: 'App.tsx', path: 'src/App.tsx', isDir: false },
          { name: 'main.rs', path: 'src/main.rs', isDir: false },
          { name: 'index.css', path: 'src/index.css', isDir: false },
        ],
      },
      {
        name: 'crates',
        path: 'crates',
        isDir: true,
        children: [
          {
            name: 'vortex-core',
            path: 'crates/vortex-core',
            isDir: true,
            children: [
              {
                name: 'src',
                path: 'crates/vortex-core/src',
                isDir: true,
                children: [
                  { name: 'lib.rs', path: 'crates/vortex-core/src/lib.rs', isDir: false },
                ],
              },
            ],
          },
        ],
      },
      { name: 'package.json', path: 'package.json', isDir: false },
      { name: 'README.md', path: 'README.md', isDir: false },
    ];
  },

  async readFile(filePath: string): Promise<string> {
    if (isTauriEnvironment()) {
      try {
        return await invoke<string>('read_file_content', { path: filePath });
      } catch (err) {
        console.warn(`Tauri read_file_content failed for ${filePath}:`, err);
      }
    }

    return MOCK_FILES[filePath] || `// Content of ${filePath}\nconsole.log("Loaded ${filePath}");\n`;
  },

  async writeFile(filePath: string, content: string): Promise<void> {
    if (isTauriEnvironment()) {
      try {
        await invoke('write_file_content', { path: filePath, content });
        return;
      } catch (err) {
        console.warn(`Tauri write_file_content failed for ${filePath}:`, err);
      }
    }

    MOCK_FILES[filePath] = content;
  },

  async createFile(filePath: string): Promise<void> {
    if (isTauriEnvironment()) {
      try {
        await invoke('create_file', { path: filePath });
        return;
      } catch (err) {
        console.warn(`Tauri create_file failed for ${filePath}:`, err);
      }
    }
    MOCK_FILES[filePath] = '';
  },

  async createDirectory(dirPath: string): Promise<void> {
    if (isTauriEnvironment()) {
      try {
        await invoke('create_directory', { path: dirPath });
        return;
      } catch (err) {
        console.warn(`Tauri create_directory failed for ${dirPath}:`, err);
      }
    }
  },

  async deleteEntry(entryPath: string): Promise<void> {
    if (isTauriEnvironment()) {
      try {
        await invoke('delete_entry', { path: entryPath });
        return;
      } catch (err) {
        console.warn(`Tauri delete_entry failed for ${entryPath}:`, err);
      }
    }
    delete MOCK_FILES[entryPath];
  },

  async renameEntry(oldPath: string, newPath: string): Promise<void> {
    if (isTauriEnvironment()) {
      try {
        await invoke('rename_entry', { oldPath, newPath });
        return;
      } catch (err) {
        console.warn(`Tauri rename_entry failed:`, err);
      }
    }
    if (MOCK_FILES[oldPath] !== undefined) {
      MOCK_FILES[newPath] = MOCK_FILES[oldPath];
      delete MOCK_FILES[oldPath];
    }
  },

  async executeShell(command: string, cwd?: string): Promise<ShellResult> {
    if (isTauriEnvironment()) {
      try {
        const res = await invoke<any>('execute_shell_command', { command, cwd: cwd || null });
        return {
          stdout: res.stdout,
          stderr: res.stderr,
          exitCode: res.exit_code,
          durationMs: res.duration_ms,
        };
      } catch (err: any) {
        return {
          stdout: '',
          stderr: String(err?.message || err),
          exitCode: 1,
          durationMs: 0,
        };
      }
    }

    // Mock shell execution for browser development
    const lower = command.trim().toLowerCase();
    if (lower === 'clear') {
      return { stdout: '', stderr: '', exitCode: 0, durationMs: 5 };
    }
    if (lower.startsWith('git branch') || lower === 'git status') {
      return {
        stdout: `On branch main\nYour branch is up to date with 'origin/main'.\n\nChanges not staged for commit:\n  modified:   src/App.tsx\n`,
        stderr: '',
        exitCode: 0,
        durationMs: 45,
      };
    }
    if (lower.startsWith('cargo check')) {
      return {
        stdout: `    Checking custom-cursor-app v0.1.0\n    Finished dev [unoptimized + debuginfo] target(s) in 0.85s\n`,
        stderr: '',
        exitCode: 0,
        durationMs: 850,
      };
    }
    if (lower.startsWith('pnpm dev') || lower.startsWith('npm run dev')) {
      return {
        stdout: `> vortex@0.1.0 dev\n> vite\n\n  VITE v8.2.2  ready in 210 ms\n  ➜  Local:   http://localhost:1420/\n`,
        stderr: '',
        exitCode: 0,
        durationMs: 210,
      };
    }
    if (lower === 'ls' || lower === 'ls -la') {
      return {
        stdout: `total 48\ndrwxr-xr-x   src\ndrwxr-xr-x   crates\n-rw-r--r--   package.json\n-rw-r--r--   README.md\n`,
        stderr: '',
        exitCode: 0,
        durationMs: 12,
      };
    }
    if (lower.startsWith('echo ')) {
      return {
        stdout: command.substring(5).trim() + '\n',
        stderr: '',
        exitCode: 0,
        durationMs: 8,
      };
    }

    return {
      stdout: `[vortex-shell] Executed: ${command}\nProcess exited with status 0\n`,
      stderr: '',
      exitCode: 0,
      durationMs: 30,
    };
  },

  async getGitStatus(cwd?: string): Promise<GitStatus> {
    if (isTauriEnvironment()) {
      try {
        const res = await invoke<any>('get_git_status', { cwd: cwd || null });
        return {
          branch: res.branch || 'main',
          isClean: res.is_clean ?? true,
          changedFiles: res.changed_files || [],
        };
      } catch (err) {
        console.warn('Tauri get_git_status failed:', err);
      }
    }

    return {
      branch: 'main',
      isClean: false,
      changedFiles: ['src/App.tsx', 'src-tauri/src/lib.rs'],
    };
  },

  async searchWorkspace(
    query: string,
    options: { rootPath?: string; isRegex?: boolean; matchCase?: boolean; matchWord?: boolean }
  ): Promise<SearchFileResult[]> {
    if (isTauriEnvironment()) {
      try {
        const raw = await invoke<any[]>('search_workspace_files', {
          query,
          rootPath: options.rootPath || null,
          isRegex: options.isRegex ?? false,
          matchCase: options.matchCase ?? false,
          matchWord: options.matchWord ?? false,
        });

        return raw.map((item) => ({
          path: item.path,
          fileName: item.file_name,
          matches: item.matches.map((m: any) => ({
            lineNumber: m.line_number,
            lineContent: m.line_content,
            matchStart: m.match_start,
            matchEnd: m.match_end,
          })),
        }));
      } catch (err) {
        console.warn('Tauri search_workspace_files failed, using fallback:', err);
      }
    }

    // Mock search for browser
    const results: SearchFileResult[] = [];
    if (!query.trim()) return results;

    for (const [path, content] of Object.entries(MOCK_FILES)) {
      const lines = content.split('\n');
      const matches = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let idx = -1;
        if (options.matchCase) {
          idx = line.indexOf(query);
        } else {
          idx = line.toLowerCase().indexOf(query.toLowerCase());
        }
        if (idx >= 0) {
          matches.push({
            lineNumber: i + 1,
            lineContent: line,
            matchStart: idx,
            matchEnd: idx + query.length,
          });
        }
      }
      if (matches.length > 0) {
        results.push({
          path,
          fileName: path.split('/').pop() || path,
          matches,
        });
      }
    }

    return results;
  },

  async getWorkspaceRoot(): Promise<string> {
    if (isTauriEnvironment()) {
      try {
        return await invoke<string>('get_current_workspace_dir');
      } catch (err) {
        console.warn('Tauri get_current_workspace_dir failed:', err);
      }
    }
    return '/workspace/vortex';
  },
};
