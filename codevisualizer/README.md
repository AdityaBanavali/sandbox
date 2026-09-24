<div align="center">

# ⚡ CodeVisualizer
### AI-Powered Code Architecture & Logic Flow Visualizer

Transform raw source code into clean, interactive architecture diagrams and flowcharts in real time.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF.svg?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v3-38B2AC.svg?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![React Flow](https://img.shields.io/badge/React_Flow-v12-FF0072.svg?style=flat-square&logo=reactflow&logoColor=white)](https://reactflow.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](./LICENSE)

[Features](#-key-features) • [Architecture](#-architecture) • [Quick Start](#-quick-start) • [Node Gallery](#-node-gallery) • [API Reference](#-api-reference) • [License](#-license)

</div>

---

## 📖 Overview

**CodeVisualizer** is a full-stack developer tool that analyzes code snippets, traces function calls, data structures, control flows, and API endpoints, and visualizes them on an interactive node-and-edge canvas.

It features a dual-engine parser:
1. **AI Engine**: Leverages Google Gemini (`gemini-2.0-flash`) or OpenAI (`gpt-4o-mini`) to synthesize architectural relationships with semantic explanations.
2. **Offline AST / Heuristic Engine**: Built-in Python AST and multi-language regex tokenizer that extracts components, call trees, and routes locally without requiring any API keys.

---

## 🌟 Key Features

### 🖥️ Split-Pane Developer Interface
- **Left Panel (Code Editor)**:
  - Full **Monaco Editor** (`vs-dark` theme) with multi-language syntax highlighting (Python, JavaScript, TypeScript, Go, Rust).
  - Real-time line counter, code formatting, clear, and reset actions.
  - One-click visualization with keyboard shortcut (`⌘ + Enter` or `Ctrl + Enter`).
  - Analysis mode switcher: **Architecture**, **Control Flow**, and **Data Flow**.
- **Right Panel (Interactive Canvas)**:
  - Powered by **React Flow (`@xyflow/react`)**.
  - Drag-and-drop nodes, smooth pan/zoom, interactive minimap, and background grid dots.
  - Animated directional edges showing relationship verbs (e.g. *calls*, *queries*, *flows to*).

### 🔍 Interactive Component Inspector
- Click any node on the canvas to open a slide-over drawer showing:
  - Component role and purpose description
  - Formatted input parameters and return types
  - Filterable tags
  - Code extract snippet with one-click clipboard copy
  - Dynamic list of incoming callers and outgoing dependencies (with clickable jumps)

### 📐 Layout & Diagram Controls
- **Hierarchical Auto-Layout**: Built-in `dagre` algorithm computes non-overlapping layout coordinates.
- **Direction Toggle**: Switch between **Vertical (Top-to-Bottom)** and **Horizontal (Left-to-Right)** orientations.
- **Rearrange**: Re-calculate and animate layout at any time.

### 📤 Export & Share
- **High-Resolution PNG**: Export 2x crisp canvas screenshots.
- **Vector SVG**: Export scalable SVG diagrams for documentation and slide decks.
- **Shareable Link**: Encodes snippet and state into URL hash for instant sharing.

---

## 🏛️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser Client                        │
│                                                             │
│  ┌─────────────────────────┐     ┌───────────────────────┐  │
│  │   Monaco Code Editor    │     │   React Flow Canvas   │  │
│  │  - Syntax Highlighting  │────>│  - Custom Nodes       │  │
│  │  - Preset Snippets      │     │  - Dagre Auto-Layout  │  │
│  │  - Analysis Modes       │     │  - Slide-over Drawer  │  │
│  └─────────────────────────┘     └───────────────────────┘  │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP /api/visualize
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Backend Server                   │
│                                                             │
│                 ┌──────────────────────┐                    │
│                 │   LLM Service API    │                    │
│                 └──────────┬───────────┘                    │
│                            │                                │
│            ┌───────────────┴───────────────┐                │
│            ▼                               ▼                │
│  ┌──────────────────┐            ┌───────────────────┐      │
│  │ Gemini / OpenAI  │            │ Built-in Offline  │      │
│  │ Structured JSON  │            │ AST/Regex Parser  │      │
│  └──────────────────┘            └───────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 Node Gallery

| Node Type | Category | Styling & Badge | Description |
|---|---|---|---|
| **ApiNode** | API Endpoint | Cyan border, glowing badge (`GET`, `POST`, `PUT`, `DELETE`) | REST / HTTP route handlers and web hooks |
| **ServiceNode** | Service / Module | Purple theme, `SERVICE` / `CLASS` tag | Business logic services, controllers, classes |
| **FunctionNode** | Function / Routine | Indigo theme, `ASYNC` / `DEF` tag | Core methods, helper routines, functions |
| **DbNode** | Data Storage | Amber theme, `DATABASE` / `MODEL` tag | Database models, schemas, repositories, queries |
| **DecisionNode** | Conditional Gate | Rose theme, `BRANCH` / `VALIDATION` tag | If/else branching, validation logic, auth gates |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: v18+ (tested on v26)
- **Python**: v3.10+ (tested on v3.11)

### 1. Clone & Set Up Backend

```bash
# Navigate to backend
cd backend

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# (Optional) Set your API key in .env or via environment
# If skipped, the built-in offline AST parser runs automatically!
cp .env.example .env

# Run FastAPI server
python run.py
```
Backend API will be running at: **`http://localhost:8000`**
Interactive Swagger documentation: **`http://localhost:8000/docs`**

### 2. Set Up Frontend

```bash
# Open a new terminal and navigate to frontend
cd frontend

# Install packages
npm install

# Start Vite development server
npm run dev
```
Frontend will be running at: **`http://localhost:5173`**

---

## 🧪 Testing

### Backend Unit Tests
Run the pytest test suite:
```bash
cd backend
.venv/bin/pytest tests/test_api.py -v
```

### Frontend Bundle Check
Verify the production build:
```bash
cd frontend
npm run build
```

---

## 📡 API Reference

### `POST /api/visualize`
Analyzes code and returns structured graph nodes and edges.

**Request Body**:
```json
{
  "code": "def hello():\n    return 'world'",
  "language": "python",
  "mode": "architecture",
  "api_key": null,
  "provider": "gemini"
}
```

**Response**:
```json
{
  "summary": "Parsed Python program containing 1 primary architectural component.",
  "stats": {
    "components": 1,
    "connections": 0,
    "complexity": "Low",
    "language": "Python"
  },
  "nodes": [
    {
      "id": "node_1",
      "type": "functionNode",
      "position": { "x": 0.0, "y": 0.0 },
      "data": {
        "label": "hello",
        "category": "function",
        "description": "Function hello()",
        "snippet": "def hello():\n    return 'world'",
        "badge": "DEF",
        "tags": ["Sync", "Function"]
      }
    }
  ],
  "edges": [],
  "provider_used": "ast_fallback"
}
```

### `GET /api/samples`
Returns a list of curated multi-language code snippets.

### `GET /api/health`
Health check endpoint returning `{"status": "ok"}`.

---

## 📄 License

This project is licensed under the terms of the [MIT License](./LICENSE).

Copyright (c) 2026 Aditya Banavali.
