<div align="center">

# ⚡ SANDBOX // Cybernetic Developer Hub

### Autonomous Engineering Playground, Machine Vision Portals & Developer Tooling

[![Projects: 10](https://img.shields.io/badge/Nodes-10%20Active%20Systems-00f0ff?style=flat-square&logo=git&logoColor=white)](https://github.com/AdityaBanavali/sandbox)
[![License: MIT](https://img.shields.io/badge/License-MIT-00ff66?style=flat-square)](LICENSE)
[![Dashboard: Cyberpunk](https://img.shields.io/badge/Dashboard-Cyberpunk%20HUD-9d4edd?style=flat-square)](index.html)
[![Tech: C99 / C11](https://img.shields.io/badge/C-C99%20%2F%20C11-00599C?style=flat-square&logo=c&logoColor=white)](txtedit/)
[![Tech: Three.js](https://img.shields.io/badge/Three.js-R182-black?style=flat-square&logo=three.js&logoColor=white)](https://threejs.org/)
[![Tech: Flutter](https://img.shields.io/badge/Flutter-3.9+-02569B?style=flat-square&logo=flutter&logoColor=white)](https://flutter.dev/)
[![Tech: FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Tech: OpenCV](https://img.shields.io/badge/OpenCV-Computer%20Vision-5C3EE8?style=flat-square&logo=opencv&logoColor=white)](https://opencv.org/)
[![Tech: Gemini AI](https://img.shields.io/badge/AI-Google%20Gemini-4285F4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev/)
[![Tech: ESP32 TinyML](https://img.shields.io/badge/IoT-ESP32%20%2B%20TinyML-E7352C?style=flat-square&logo=espressif&logoColor=white)](https://www.espressif.com/)

<p align="center">
  A curated monorepo featuring computer vision portals, desktop IDEs, low-level piece table text engines, code architecture visualizers, 3D voxel cities, cyber defense enclaves, municipal verification engines, and edge IoT health monitors — unified under a sleek <b>Cyberpunk Root Dashboard</b>.
</p>

[🖥️ Root Dashboard](#-root-dashboard) • [📦 Systems Directory](#-systems-directory) • [🚀 Quick Start](#-quick-start) • [🏛️ Repository Layout](#-repository-layout) • [📄 License](#-license)

</div>

---

## 🖥️ Root Dashboard

The repository includes a standalone, zero-dependency **Cyberpunk Telemetry Dashboard** located at [`index.html`](index.html).

### ✨ Dashboard Highlights:
- **Cyberpunk HUD Aesthetics**: Obsidian void theme with electric cyan (`#00f0ff`), matrix emerald (`#00ff66`), plasma violet (`#9d4edd`), amber alert (`#ffbe0b`), crimson defense (`#ef4444`), and neo-blue glowing borders.
- **Dynamic 60fps Matrix Canvas**: Background streaming Japanese Katakana and hexadecimal glyphs with CRT scanlines and cyber grid overlay.
- **System Telemetry Bar**: Live UTC system clock, active node indicators, and repository shortcuts.
- **Real-Time Search & Category Filters**: Instant filtering across Vision & AI, Desktop IDE, DevTools & 3D, Security & Web, and Systems & IoT.
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
| **`SYS-03`** | [**CodeVisualizer**](./codevisualizer/) | React Flow, FastAPI, Python AST, Monaco | DevTools & Architecture | 🔵 `FULLSTACK TOOL` |
| **`SYS-04`** | [**TechRef**](./techref/) | Next.js 16, TypeScript, OpenAPI 3.0, Tailwind v4 | Web & API | 🟡 `NEXT.JS HUB` |
| **`SYS-05`** | [**txtedit**](./txtedit/) | Pure C (C99/C11), Piece Table, REPL | Systems & C | 🔴 `CLI ENGINE` |
| **`SYS-06`** | [**Avex_Defense**](./Avex_Defense/) | FastAPI, Celery, Redis, PostgreSQL 16, React 19 | Cyber & Security | 🛡️ `SIEM & ML ENCLAVE` |
| **`SYS-07`** | [**Chrono-graph**](./Chrono-graph/) | Three.js, React 19, Vite, Web Audio, Workers | 3D & Graphics | 🏙️ `3D VOXEL METROPOLIS` |
| **`SYS-08`** | [**CivicFix**](./CivicFix/) | FastAPI, OpenCV, Gemini Vision, React 18, Tailwind | AI & CivicTech | 🏛️ `PROOF-OF-FIX ENGINE` |
| **`SYS-09`** | [**SafeHer**](./SafeHer/) | Flutter, Dart 3.9, Firebase, ESP32 IoT, MPU6050 | Mobile & IoT | 🌸 `SAFETY & HEALTH APP` |
| **`SYS-10`** | [**StrStat**](./StrStat/) | ESP32, TinyML ANN, React 19, Three.js, Tailwind | Systems & IoT | ⚡ `EDGE SHM & SEISMIC` |

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
- **Instant Search**: Client-side full-text search index with keyboard shortcut navigation (`⌘K`).
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
- **Doubly-Linked Piece Chain**: Text document represented as a sequence of lightweight piece descriptors (`Piece`), avoiding expensive continuous array reallocations.
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

### 🛡️ 6. Avex_Defense (`./Avex_Defense`)
> **Cyber Defense Enclave: AI-Based Detection of Cyber Threats in Unidirectional IP Traffic**

An enterprise cybersecurity backend and real-time SIEM web console designed specifically for **unidirectional network environments** (optical data diodes) where backward TCP return channels and SYN-ACK round trips are physically prohibited.

- **Unidirectional Ingestion & Feature Engineering**: Calculates Shannon payload entropy, inter-arrival time (IAT) variance, and packet length distributions without backward metrics.
- **Hybrid Machine Learning Threat Engine**:
  - *Isolation Forest*: Detects zero-day tunnels and covert exfiltration channels without labeled ground truth.
  - *Random Forest*: Classifies known threat signatures (`PORT_SCAN`, `DATA_EXFILTRATION`, `C2_BEACON`, `DOS_BURST`).
  - *SHAP TreeExplainer*: Provides local feature attribution explaining exactly which statistical features triggered the alert.
- **MITRE ATT&CK Mapping**: Correlates alerts to specific techniques (`T1048` Exfiltration, `T1046` Network Service Discovery, `T1071.004` DNS Covert Channels).
- **Cryptographic Tamper-Evident Hash Chain**: Audit log records chained with SHA-256 predecessor digests; verified via `POST /api/v1/audit/verify-chain`.
- **SOC / SIEM Frontend**: Real-time React 19 + Tailwind web console with live threat feeds and triage lifecycle management.

```bash
# Option A: Full stack with Docker Compose (PostgreSQL 16, Redis 7, Celery, FastAPI)
cd Avex_Defense
cp .env.example .env
docker compose up --build

# Option B: Frontend SIEM Console
cd Avex_Defense/frontend
npm install && npm run dev
```

---

### 🏙️ 7. Chrono-graph (`./Chrono-graph`)
> **Git Repository to 3D Neon Voxel Metropolis Visualizer**

Transforms any Git repository commit history into an interactive retro-synthwave 3D voxel city. Top-level folders become floating neon islands, files sprout as voxel skyscrapers that grow taller with every commit touch, and top contributors roam as procedural 8-bit avatars.

- **Procedural Voxel Metropolis**: Folders partition into floating islands via deterministic spiral packing; files map to instanced voxels that rise, grow, and crumble on deletion.
- **8-Bit Contributor Avatars**: Top contributors receive procedural pixel-art avatars that walk to files on commit and hammer upgrades with floating `+N` badges.
- **Cinematic Drone Mode**: Auto-orbit camera with dramatic fly-bys during merge commits and major refactors (`D` to toggle).
- **1080p 60fps Video Recording**: Exports crisp videos directly from the canvas using `MediaRecorder` with intro and outro title cards.
- **Zero-Dependency 8-Bit Audio**: Native Web Audio synthesizer generating commit ticks, bass impacts, and background synthwave progressions.
- **Off-Thread Layout Computation**: Web Workers handle layout packing, touch metrics, and tree computation to guarantee 60 FPS rendering.

```bash
cd Chrono-graph
npm install
npm run dev
# Open http://localhost:5173
```

---

### 🏛️ 8. CivicFix (`./CivicFix`)
> **Automated Municipal Proof-of-Fix Verification & Anti-Fraud Engine**

An automated proof-of-fix verification engine for municipal public works (road repairs, pothole filling, infrastructure maintenance). Analyzes **BEFORE** and **AFTER** contractor photo pairs through a 3-layer anti-fraud pipeline to produce a composite **Trust Score (0–100)** and resolution verdict.

- **Layer 1: Metadata & Geo Anti-Spoofing**: Extracts EXIF camera metadata and capture timestamps; verifies Haversine geo-distance ($< 50\text{m}$) and perceptual hash (`pHash`) to detect duplicate or flipped images.
- **Layer 2: OpenCV Surface Difference Analysis**: Computes homography feature alignment, Laplacian variance, and gray-level texture roughness drop over the repaired region.
- **Layer 3: Gemini Multimodal Visual Audit**: Uses `gemini-2.5-flash` to verify asphalt boundaries, surface uniformity, surrounding environmental landmarks, and flags Photoshop tampering.
- **Modern Web Dashboard**: React 18 + Tailwind frontend for photo uploads, verification inspections, and score breakdowns.

```bash
# Terminal 1: Backend
cd CivicFix/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd CivicFix/frontend
npm install
npm run dev
```

---

### 🌸 9. SafeHer (`./SafeHer`)
> **Integrated IoT Women's Safety & Health Ecosystem**

A comprehensive safety and wellness ecosystem bridging an **ESP32 wearable hardware device** with a **cross-platform Flutter mobile application** for proactive fall detection, hardware panic alerts, live GPS telemetry, and predictive health analytics.

- **Hardware Safety Integration**: ESP32 microcontroller with an MPU6050 6-DoF sensor detects sudden fall impacts followed by immobility; integrated physical panic button triggers instant SOS alerts.
- **Real-Time GPS Broadcast**: High-accuracy device coordinates queried via `geolocator` and synced with sub-150ms latency across Firebase Realtime Database.
- **Menstrual Cycle Tracking**: Intuitive calendar interface powered by `table_calendar` with cycle history logging and ovulation window predictions.
- **Predictive Health Analytics**: Interactive trend graphs rendered via `fl_chart` tracking sleep consistency, stress indicators, and physical wellness.
- **Hardened Cloud Infrastructure**: Role-based access control via Cloud Firestore rules and high-priority push notifications through Firebase Cloud Messaging (FCM).

```bash
cd SafeHer
flutter pub get
flutter run
```

---

### ⚡ 10. StrStat (`./StrStat`)
> **Aegis-SHM: Edge Structural Health & Seismic Hazard Monitor**

An industrial-grade cyber-physical telemetry dashboard and edge computing system designed for real-time Structural Health Monitoring (SHM), mechanical resonance detection, and automated seismic hazard mitigation.

- **ESP32 Edge Microcontroller**: Samples an MPU6050 6-DoF IMU at 50 Hz with an on-chip 64-sample Hamming windowed FFT decomposing vibrations into discrete spectral bins (0–25 Hz).
- **On-Device TinyML Anomaly Detection**: Lightweight Multi-Layer Perceptron (ANN) performs edge inference on 5 extracted features; triggers a fail-safe solenoid relay barrier and 105 dB buzzer during critical seismic events.
- **Kinematic 3D Digital Twin**: Built with Three.js and React Three Fiber, simulating dynamic shear displacement and inter-story drift on a multi-story building model.
- **SCADA Oscilloscope & Instrumental Intensity**: Separates Earth's static $1.0g$ gravity datum to compute Peak Ground Acceleration (PGA) mapped in real time to the Modified Mercalli Intensity scale (MMI I through X).
- **Zero-Fake-Data Watchdog**: Failsafe watchdog freezes stream display if WebSocket packets are delayed $> 1500\text{ ms}$.

```bash
cd StrStat
npm install
npm run dev
# Open http://localhost:5173
```

---

## 🏛️ Repository Layout

```text
sandbox/
├── index.html                   # Cyberpunk Root Developer Hub & Showcase Dashboard
├── README.md                    # Monorepo documentation and systems index
├── LICENSE                      # MIT Open Source License
├── .gitignore                   # Multi-stack gitignore (Node, Rust, Python, C, Next.js, Flutter)
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
├── txtedit/                     # [SYS-05] Piece table text editor core & REPL
│   ├── piece_table.h            # Piece table data structures & C API signatures
│   ├── piece_table.c            # Double-linked piece manipulation, undo/redo, render
│   ├── main.c                   # Interactive CLI REPL implementation
│   └── README.md
│
├── Avex_Defense/                # [SYS-06] Unidirectional cyber defense enclave
│   ├── app/                     # FastAPI backend, ML ensemble (Isolation/Random Forest), audit ledger
│   ├── frontend/                # React 19 + Tailwind SOC/SIEM telemetry console
│   ├── docker-compose.yml       # PostgreSQL 16, Redis 7, Celery Worker, FastAPI
│   ├── scripts/                 # Synthetic PCAP generator & replay engine
│   └── README.md
│
├── Chrono-graph/                # [SYS-07] 3D retro-synthwave voxel city visualizer
│   ├── src/                     # Three.js scene, instanced voxels, Web Audio, Web Workers
│   ├── scripts/                 # Git log ingest parser (ingest.mjs)
│   ├── package.json
│   └── README.md
│
├── CivicFix/                    # [SYS-08] Municipal proof-of-fix verification engine
│   ├── backend/                 # FastAPI + OpenCV + Gemini 2.5 Flash anti-fraud pipeline
│   ├── frontend/                # React 18 + Tailwind verification console
│   └── README.md
│
├── CivicFix_samples/            # Curated pothole test photo fixtures for CivicFix
│   └── files/pothole_samples/   # Ground truth before/after image pairs
│
├── SafeHer/                     # [SYS-09] IoT women's safety & health ecosystem
│   ├── lib/                     # Flutter app (emergency SOS dashboard, cycle tracker, charts)
│   ├── functions/               # Firebase Cloud Functions backend
│   ├── firestore.rules          # Security and data isolation policies
│   ├── pubspec.yaml
│   └── README.md
│
└── StrStat/                     # [SYS-10] Edge structural health & seismic monitor (Aegis-SHM)
    ├── esp32/                   # ESP32 firmware (MPU6050 sampling, 64-sample FFT, TinyML ANN)
    ├── src/                     # Three.js digital twin, SCADA oscilloscope, React 19 UI
    ├── package.json
    └── README.md
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
cd codevisualizer/backend && pip install -r requirements.txt && python run.py
cd codevisualizer/frontend && npm install && npm run dev

# SYS-04: TechRef
cd techref && npm install && npm run dev

# SYS-05: txtedit Piece Table REPL
cd txtedit && clang -O2 main.c piece_table.c -o piece_table_repl && ./piece_table_repl

# SYS-06: Avex Defense (Cyber Enclave & SIEM)
cd Avex_Defense && docker compose up --build
cd Avex_Defense/frontend && npm install && npm run dev

# SYS-07: ChronoGraph (3D Git City)
cd Chrono-graph && npm install && npm run dev

# SYS-08: CivicFix (Proof-of-Fix Engine)
cd CivicFix/backend && pip install -r requirements.txt && uvicorn app.main:app --port 8000
cd CivicFix/frontend && npm install && npm run dev

# SYS-09: SafeHer (Flutter Mobile App)
cd SafeHer && flutter pub get && flutter run

# SYS-10: StrStat (Aegis-SHM Telemetry)
cd StrStat && npm install && npm run dev
```

---

## 📄 License

This repository and all sub-projects are licensed under the [MIT License](LICENSE).

Copyright (c) 2026 Aditya Banavali.
