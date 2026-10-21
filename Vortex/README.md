<div align="center">

# ⚡ Vortex IDE
### The High-Performance, AI-Native Desktop Code Editor

[![Tauri v2](https://img.shields.io/badge/Tauri-v2.11-24C8D8?style=flat-square&logo=tauri&logoColor=white)](https://tauri.app/)
[![React 19](https://img.shields.io/badge/React-v19.1-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Rust-1.80+-DEA584?style=flat-square&logo=rust&logoColor=black)](https://www.rust-lang.org/)
[![Monaco Editor](https://img.shields.io/badge/Monaco-VS%20Code%20Core-blue?style=flat-square&logo=visualstudiocode&logoColor=white)](https://microsoft.github.io/monaco-editor/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4.3-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple?style=flat-square)](LICENSE)

<p align="center">
  A lightning-fast, privacy-first desktop code editor built on <b>Tauri v2</b> and <b>Rust</b>, featuring the industry-standard <b>Monaco Editor</b> core, deep <b>Git version control</b>, and an autonomous <b>Google Gemini AI coding engine</b>.
</p>

</div>

---

## 🌟 Core Pillars & Key Features

### 🧠 1. AI-Native Coding Engine
- **Vortex Copilot & Multi-Thread Chat**: Interactive sidebar and bottom console drawers with saved session histories for effortless pair programming.
- **Context-Aware Assistance**: Automatically feeds active file paths and open code context into Gemini prompts.
- **"Insert at Cursor" One-Click Actions**: Injects AI-generated code blocks directly into your active Monaco cursor position with zero manual copy-pasting.
- **"New File" Generation**: Instantly spin up new documents from generated code blocks with detected language modes.
- **Native Rust HTTP Bridge**: Bypasses browser CORS and WebKit network sandbox limitations by dispatching model requests through Tauri's native `reqwest` client.
- **Custom API Key Vault & Multi-Model Fallback Engine**: Local secure storage for personal Gemini API keys with automatic rotation between `gemini-3.6-flash` (thinking model) and `gemini-3.7-flash`.

### 🌿 2. Deep Git & Version Control Integration
- **Source Control Sidebar**:
  - Organized accordions for **Staged Changes**, **Changes (Unstaged)**, **Untracked Files**, and **Merge Conflicts**.
  - Individual and bulk stage (`+`), unstage (`-`), and discard (`🗑️`) actions.
  - Collapsible **Stash Drawer** (`push`, `pop`, `apply`, `drop`).
  - Real-time **Remote Sync** status with ahead/behind commit indicators (`↑ X  ↓ Y`).
- **AI Conventional Commit Generator**: One-click magic wand (`✨`) that analyzes staged unified git diffs and automatically writes standardized commit messages.
- **Interactive Branch Manager**: Dedicated modal to search, switch (`HEAD`), create new branches (`-b`), and delete local branches.
- **Visual Commit History Graph**: Interactive timeline graph displaying commit hashes, copyable SHA badges, author info, relative time, and full commit messages.
- **Merge Conflict Resolution Helper**: Automatically identifies `<<<<<<< HEAD`, `=======`, `>>>>>>>` markers and provides inline banners:
  - *Accept Current Change*
  - *Accept Incoming Change*
  - *Accept Both Changes*
  - *AI Smart Resolve* (intelligently reconciles conflicting blocks using Gemini).
- **Inline Git Blame Ghost Text**: Real-time git blame annotations rendered directly at the cursor line in Monaco Editor.

### 💻 3. Monaco Editor Core & Layout
- **Multi-Tab Document Editing**: Open, close, reorder, and switch between multiple active files simultaneously.
- **Split-View Canvas**: Split editor panes horizontally or vertically with independent cursor states and tabs.
- **Interactive Breadcrumb Navigation**: Clickable directory/file paths directly above each editor pane.
- **Rich Syntax Highlighting & Language Detection**: Out-of-the-box language servers for TypeScript, JavaScript, Rust, Python, JSON, Markdown, HTML, CSS, and Shell scripts.
- **Code Minimap & Diagnostics**: Toggleable minimap overview with error and warning indicators.
- **Workspace State Persistence**: Auto-saves active tabs, split views, terminal states, and theme preferences to local storage.

### 🖥️ 4. Integrated Terminal Panel
- **Native Shell Emulator**: Built-in interactive console powered by Tauri backend command execution.
- **Real-Time Build Stream Formatter**: Intelligent ANSI sequence stripping, exit-code classification, and emerald green syntax highlighting for Cargo and Vite compilation milestones.
- **Interactive Resizable Drawer**: Fluid drag-to-resize drawer handle with double-click reset.

### 🔍 5. Workspace Search & Navigation
- **Global Search & Replace**: Instant full-text search across the repository with Regex, Case Matching, and Whole Word filters.
- **Command Palette (`Cmd+P` / `Ctrl+P`)**: Fast fuzzy finder to search files, trigger IDE actions, and switch settings on the fly.
- **Dynamic File Tree Explorer**: Fast directory traversal with folder expansion, create file, create folder, rename, and delete actions.

### 🎨 6. Modern Glassmorphism & Theme Engine
- Curated modern color palettes:
  - **Vortex Dark**: Sleek obsidian dark mode with electric purple accents.
  - **VS Code Modern**: Industry-standard dark palette with classic blue accents.
  - **Midnight Obsidian**: Ultra-minimalist true black with cyan highlights.
  - **Vortex Light**: High-contrast, clean light mode.
- Customizable editor font size (11px–18px), tab size (2 or 4 spaces), and word wrap toggles.

---

## 🏗️ Architecture & Project Structure

```text
Vortex/
├── src/
│   ├── components/
│   │   ├── chat/              # AI Chat sessions, code block actions, markdown renderer
│   │   ├── commandPalette/    # Quick-open file and action palette
│   │   ├── editor/            # Monaco editor wrapper, split container, tabs, breadcrumbs
│   │   ├── explorer/          # Directory file tree
│   │   ├── git/               # Source control, branch manager, commit graph, conflict resolver
│   │   ├── layout/            # Activity bar, resizable sidebar, status bar, bottom panel
│   │   ├── search/            # Global workspace search and replace
│   │   ├── settings/          # Theme selector, editor preferences, API key vault
│   │   └── terminal/          # Shell emulator with ANSI & cargo milestone parsing
│   ├── services/
│   │   ├── aiService.ts       # Gemini API client, native Tauri fallback, key vault
│   │   ├── gitService.ts      # Git IPC bridge, diff parser, AI commit generator
│   │   ├── tauriBridge.ts     # Filesystem, shell command, workspace IPC wrappers
│   │   ├── themeService.ts    # Monaco theme definitions and editor palettes
│   │   └── storageService.ts  # Workspace state persistence
│   ├── types/                 # TypeScript interfaces for editor, git, chat, and themes
│   ├── App.tsx                # Master IDE application state & layout orchestrator
│   └── index.css              # Glassmorphic CSS tokens, scrollbars, blame styling
├── src-tauri/
│   ├── src/
│   │   ├── main.rs            # Desktop application entrypoint
│   │   └── lib.rs             # Native Rust commands (fs, git, shell, LLM reqwest)
│   ├── Cargo.toml             # Rust dependencies (tauri, tokio, reqwest, serde, regex)
│   └── tauri.conf.json        # Tauri v2 desktop window & bundle configuration
├── package.json
└── tsconfig.json
```

---

## 🚀 Quick Start & Development

### Prerequisites
Make sure you have the following installed on your machine:
- **Node.js** (v18+ recommended)
- **pnpm** (or `npm` / `yarn`)
- **Rust Toolchain**: Install via [rustup.rs](https://rustup.rs/)
- **Tauri Prerequisites**: Refer to [Tauri v2 Prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS (macOS Xcode Command Line Tools, Linux WebKit libraries, or Windows C++ build tools).

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/vortex.git
cd vortex
```

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Run in Desktop Development Mode
Launches the Vite dev server and Tauri desktop window with hot-reloading:
```bash
pnpm tauri dev
```

### 4. Run Frontend Only (Browser Preview)
```bash
pnpm dev
```

### 5. Build Desktop Production Bundle
```bash
pnpm tauri build
```
The compiled native binaries (`.dmg` on macOS, `.appimage`/`.deb` on Linux, `.msi`/`.exe` on Windows) will be output to `src-tauri/target/release/bundle/`.

---

## ⌨️ Essential Keyboard Shortcuts

| Shortcut (macOS / Windows) | Action |
|---|---|
| <kbd>Cmd</kbd> / <kbd>Ctrl</kbd> + <kbd>P</kbd> | Quick-Open Command Palette / File Search |
| <kbd>Cmd</kbd> / <kbd>Ctrl</kbd> + <kbd>`</kbd> | Toggle Bottom Terminal & AI Console Panel |
| <kbd>Cmd</kbd> / <kbd>Ctrl</kbd> + <kbd>S</kbd> | Save Active File to Disk |
| <kbd>Cmd</kbd> / <kbd>Ctrl</kbd> + <kbd>Enter</kbd> | Commit Staged Git Changes |
| <kbd>Cmd</kbd> / <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>E</kbd> | Focus File Explorer |
| <kbd>Cmd</kbd> / <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd> | Focus Global Workspace Search |
| <kbd>Cmd</kbd> / <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>G</kbd> | Focus Source Control (Git) |
| <kbd>Esc</kbd> | Close Modal (Branch Manager, Commit Graph, Command Palette) |

---

## 🛡️ License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
