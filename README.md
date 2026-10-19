<div align="center">

# ⚡ SANDBOX // Cybernetic Developer Hub

### Autonomous Engineering Playground, Machine Vision Portals & Developer Tooling

[![Projects: 5](https://img.shields.io/badge/Nodes-5%20Active%20Systems-00f0ff?style=flat-square&logo=git&logoColor=white)](https://github.com/AdityaBanavali/sandbox)
[![License: MIT](https://img.shields.io/badge/License-MIT-00ff66?style=flat-square)](LICENSE)
[![Dashboard: Cyberpunk](https://img.shields.io/badge/Dashboard-Cyberpunk%20HUD-9d4edd?style=flat-square)](index.html)
[![Tech: C99 / C11](https://img.shields.io/badge/C-C99%20%2F%20C11-00599C?style=flat-square&logo=c&logoColor=white)](txtedit/)
[![Tech: Next.js 16](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Tech: Tauri v2](https://img.shields.io/badge/Tauri-v2-24C8D8?style=flat-square&logo=tauri&logoColor=white)](https://tauri.app/)
[![Tech: FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Tech: Gemini AI](https://img.shields.io/badge/AI-Google%20Gemini-4285F4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev/)

<p align="center">
  A curated monorepo featuring computer vision portals, desktop IDEs, low-level piece table text engines, code architecture visualizers, and interactive documentation hubs — unified under a sleek <b>Cyberpunk Root Dashboard</b>.
</p>

[🖥️ Root Dashboard](#-root-dashboard) • [📦 Systems Directory](#-systems-directory) • [🚀 Quick Start](#-quick-start) • [🏛️ Repository Layout](#-repository-layout) • [📄 License](#-license)

</div>

---

## 🖥️ Root Dashboard

The repository includes a standalone, zero-dependency **Cyberpunk Telemetry Dashboard** located at [`index.html`](index.html).

### ✨ Dashboard Highlights:
- **Cyberpunk HUD Aesthetics**: Obsidian void theme with electric cyan (`#00f0ff`), matrix emerald (`#00ff66`), plasma violet (`#9d4edd`), amber alert (`#ffbe0b`), and neo-blue glowing borders.
- **Dynamic 60fps Matrix Canvas**: Background streaming Japanese Katakana and hexadecimal glyphs with CRT scanlines and cyber grid overlay.
- **System Telemetry Bar**: Live UTC system clock, node status indicators, and repository shortcuts.
- **Real-Time Search & Category Filters**: Instant filtering across Vision, Desktop IDE, DevTools, Web Platforms, and Systems Programming.
- **Quick-Run Terminal Runner**: One-click local CLI command loader with instant clipboard copy.

#### Launching the Dashboard:
```bash
# Option 1: Open directly in your default browser
open index.html

# Option 2: Serve over a local HTTP server
npx serve .
```

---

## 📦 Systems Directory

| Node | System | Primary Stack | Category | Status |
| :---: | :--- | :--- | :--- | :--- |
| **`SYS-01`** | [**Matrix-rain**](./Matrix-rain/) | MediaPipe Vision, HTML5 Canvas 2D, WASM | Vision & AI | 🟢 `LIVE IN BROWSER` |
| **`SYS-02`** | [**Vortex**](./Vortex/) | Tauri v2, Rust, React 19, Monaco, Gemini | Desktop IDE | 🟣 `DESKTOP APP` |
| **`SYS-03`** | [**CodeVisualizer**](./codevisualizer/) | React Flow, FastAPI, Python AST, Monaco | DevTools | 🔵 `FULLSTACK TOOL` |
| **`SYS-04`** | [**TechRef**](./techref/) | Next.js 16, TypeScript, OpenAPI 3.0, Tailwind v4 | Web & API | 🟡 `NEXT.JS HUB` |
| **`SYS-05`** | [**txtedit**](./txtedit/) | Pure C (C99/C11), Piece Table, REPL | Systems & Editors | 🔴 `CLI ENGINE` |

---

### 🟢 1. Matrix-rain (`./Matrix-rain`)
> **Gesture-Controlled Real-Time Matrix Code Rain Portal**

An interactive digital portal that streams the iconic falling Matrix digital rain between your hands in real time using webcam input.

- **Computer Vision**: Powered by Google MediaPipe GPU-accelerated `HandLandmarker` tracking 21 skeletal landmarks per hand.
- **Dual-Pinch Spawning**: Detects simultaneous pinch gestures (thumb + index) to dynamically stretch, position, and resize the portal in 3D space.
- **Canvas 2D Rendering**: Cascading Japanese Katakana and alphanumeric streams with glowing stream heads and fading phosphor tails.
- **Privacy First**: 100% on-device processing via WebAssembly and WebGL — zero video data leaves your browser.
- **Zero Build Step**: Runs directly in any modern browser without installation.

```bash
cd Matrix-rain
npx serve
# Open http://localhost:3000
```

---

### 🟣 2. Vortex (`./Vortex`)
> **High-Performance, AI-Native Desktop Code Editor**

A desktop code editor built on **Tauri v2** and **Rust**, engineered with the industry-standard **Monaco Editor** core, deep Git integration, and an autonomous **Google Gemini AI coding engine**.

- **AI-Native Coding Engine**: Interactive Copilot sidebar and bottom drawer with one-click *"Insert at Cursor"* and *"New File"* generation.
- **Custom Key Vault & Multi-Model Fallback**: Secure local storage for personal Gemini keys with automatic rotation between `gemini-3.6-flash` and `gemini-3.7-flash`.
- **Deep Git Integration**: Staged/unstaged file accordions, visual commit history graph, AI conventional commit message generator (`✨`), merge conflict resolver, and inline cursor Git blame ghost text.
- **Native Rust HTTP Proxy**: Bypasses browser WebKit sandboxing by routing LLM requests through native Tokio/Reqwest.
- **Integrated Terminal**: Shell emulator with ANSI stripping and Cargo/Vite compilation milestone highlighting.

```bash
cd Vortex
pnpm install
pnpm tauri dev   # Desktop development mode
# or: pnpm dev   # Browser-only preview
```

---

### 🔵 3. CodeVisualizer (`./codevisualizer`)
> **AI-Powered Code Architecture & Logic Flow Visualizer**

Transforms raw source code into clean, interactive architecture diagrams and flowcharts in real time with a dual parsing engine.

- **Dual-Engine Parser**:
  1. *Cloud AI Engine*: Leverages Google Gemini (`gemini-2.0-flash`) or OpenAI (`gpt-4o-mini`) for architectural synthesis.
  2. *Offline AST Engine*: Built-in Python AST and regex tokenizer that parses functions, classes, and routes locally without API keys.
- **Split-Pane Workspace**: Monaco code editor on the left; interactive **React Flow (`@xyflow/react`)** canvas on the right.
- **Dagre Auto-Layout**: Hierarchical node distribution with toggleable horizontal/vertical orientations.
- **Component Inspector Drawer**: Slide-over panel displaying node roles, inputs, return types, code snippets, and dependency call trees.
- **Crisp Exports**: High-resolution 2x PNG, vector SVG, and shareable encoded URL links.

```bash
# Terminal 1: Backend
cd codevisualizer/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python run.py    # Running at http://localhost:8000

# Terminal 2: Frontend
cd codevisualizer/frontend
npm install
npm run dev      # Running at http://localhost:5173
```

---

### 🟡 4. TechRef (`./techref`)
> **Next.js Developer Documentation Hub & Interactive API Reference**

A modern developer documentation engine with an interactive OpenAPI 3.0 playground, dynamic schema tables, and multi-language client SDK generator.

- **OpenAPI 3.0 Explorer**: Rich, collapsible schema trees, parameter matrices, and response tables.
- **Interactive API Playground**: Live HTTP test execution sandbox directly within the documentation.
- **Instant Client Code Generator**: Generates copy-ready code snippets across TypeScript (Node.js), Python (AsyncIO), Rust (Reqwest), and Go.
- **Instant Search**: Client-side full-text search index with keyboard shortcut navigation.
- **Modern Architecture**: Built on Next.js 16 App Router, React 19, and Tailwind CSS v4.

```bash
cd techref
npm install
npm run dev
# Open http://localhost:3000
```

---

### 🔴 5. txtedit (`./txtedit`)
> **High-Performance Piece Table Text Editor Core & REPL Engine**

A low-level, memory-efficient text editor engine and interactive REPL implemented in pure C (C99/C11) using the industry-standard **Piece Table** data structure (as found in VS Code).

- **Dual-Buffer Model**: Immutable original text buffer (`const char *`) coupled with an append-only dynamic add buffer (`char *`) providing $O(1)$ amortized append operations.
- **Doubly-Linked Piece Chain**: Text document represented as a sequence of lightweight piece descriptors (`Piece`), avoiding expensive continuous array reallocations and text shifting.
- **Surgical Piece Splitting**: Insertions and deletions perform surgical splits on piece spans without copying unchanged document text.
- **Linear Undo & Redo History**: Complete action snapshot chain (`Action`) tracking preceding and succeeding piece list states for non-destructive undo and redo.
- **Contiguous Materialization**: Fast document rendering to contiguous null-terminated string (`piece_table_render`).
- **Interactive REPL**: Command-line shell supporting `insert <idx> <text>`, `delete <idx> <len>`, `undo`, `redo`, `print`, and `debug` state inspection.
- **Zero External Dependencies**: Pure ISO C99/C11 using only standard libc headers.

```bash
cd txtedit
clang -Wall -Wextra -O2 main.c piece_table.c -o piece_table_repl
./piece_table_repl
```

---

## 🏛️ Repository Layout

```text
sandbox/
├── index.html                   # Cyberpunk Root Developer Hub & Showcase Dashboard
├── README.md                    # Monorepo documentation and systems index
├── LICENSE                      # MIT Open Source License
├── .gitignore                   # Multi-stack gitignore (Node, Rust, Python, C, Next.js)
│
├── Matrix-rain/                 # [SYS-01] Gesture-controlled digital portal
│   ├── index.html               # Live browser application (MediaPipe + Canvas 2D)
│   ├── README.md
│   └── LICENSE
│
├── Vortex/                      # [SYS-02] AI-native desktop IDE
│   ├── src/                     # React 19 + Monaco editor frontend
│   ├── src-tauri/               # Rust desktop backend (Tauri v2 + Tokio/Reqwest)
│   ├── package.json
│   └── README.md
│
├── codevisualizer/              # [SYS-03] Code architecture & logic flow visualizer
│   ├── backend/                 # FastAPI + Python AST / Gemini parser
│   ├── frontend/                # React Flow + Monaco visualization UI
│   └── README.md
│
├── techref/                     # [SYS-04] Next.js developer documentation engine
│   ├── app/                     # Next.js 16 App Router pages & layouts
│   ├── components/              # API playground, schemas, navigation
│   ├── content/                 # OpenAPI 3.0 specs & search indices
│   ├── package.json
│   └── README.md
│
└── txtedit/                     # [SYS-05] Piece table text editor core & REPL
    ├── piece_table.h            # Piece table data structures & C API signatures
    ├── piece_table.c            # Double-linked piece manipulation, undo/redo, render
    ├── main.c                   # Interactive CLI REPL implementation
    └── README.md                # Standalone piece table documentation & architecture
```

---

## 🚀 Quick Start Summary

To launch everything from one unified interface:

```bash
# 1. Clone the repository
git clone https://github.com/AdityaBanavali/sandbox.git
cd sandbox

# 2. Launch the root dashboard
open index.html
# or: npx serve .
```

To run individual systems directly:

```bash
# SYS-01: Matrix Rain
open Matrix-rain/index.html

# SYS-02: Vortex Desktop IDE
cd Vortex && pnpm install && pnpm tauri dev

# SYS-03: CodeVisualizer
# Backend:
cd codevisualizer/backend && pip install -r requirements.txt && python run.py
# Frontend:
cd codevisualizer/frontend && npm install && npm run dev

# SYS-04: TechRef
cd techref && npm install && npm run dev

# SYS-05: txtedit Piece Table REPL
cd txtedit && clang -O2 main.c piece_table.c -o piece_table_repl && ./piece_table_repl
```

---

## 📄 License

This repository and all sub-projects are licensed under the [MIT License](LICENSE).

Copyright (c) 2026 Aditya Banavali.
