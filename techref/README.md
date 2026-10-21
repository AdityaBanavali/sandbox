# ⚡ TechRef // Modern Developer Documentation & API Engine

An ultra-modern, high-performance developer documentation hub and interactive OpenAPI 3.0 reference engine built on **Next.js 16 (App Router)**, **React 19**, and **Tailwind CSS v4**.

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![OpenAPI 3.0](https://img.shields.io/badge/OpenAPI-3.0-6BA539?style=flat-square&logo=openapi-initiative&logoColor=white)](https://spec.openapis.org/oas/v3.0.0)
[![License: MIT](https://img.shields.io/badge/License-MIT-00ff66?style=flat-square)](../LICENSE)

---

## 📖 Overview

**TechRef** bridges technical guides and live interactive API references into a unified, responsive developer portal. Designed for developer-first teams requiring clear architectural blueprints, live endpoint sandboxes, and copy-pasteable client code across multiple languages.

---

## ✨ Key Features

- **🌐 OpenAPI 3.0 Explorer**: Rich collapsible schema trees, parameter matrices, request body inspectors, and response status tables.
- **🧪 Interactive API Playground**: Execute test requests directly inside the documentation with customizable query params, headers, and request payloads.
- **⚡ Multi-Language Client SDK Generator**: Instant, syntax-highlighted client code generation for:
  - **TypeScript / Node.js** (`fetch` / `axios`)
  - **Python** (`aiohttp` / `asyncio`)
  - **Rust** (`reqwest` / `tokio`)
  - **Go** (`net/http`)
- **🔍 Instant Client-Side Full-Text Search**: Fuzzy keyword index with keyboard shortcut triggers (`⌘K` / `Ctrl+K`) for rapid navigation.
- **📚 Architectural Guides & Blueprints**: Dedicated sections covering distributed ingestion pipelines, zero-trust authentication, and microservice topologies.
- **🎨 Modern Dark HUD Aesthetic**: Tailored typography with Geist, customizable callouts (Note, Tip, Warning), and seamless responsive navigation.

---

## 🏛️ Directory Structure

```text
techref/
├── app/
│   ├── layout.tsx               # Root layout with font optimization & metadata
│   ├── page.tsx                 # Master documentation & API viewer controller
│   ├── globals.css              # Global styles & Tailwind CSS v4 directives
│   └── favicon.ico              # TechRef identity icon
├── components/
│   ├── api/
│   │   ├── ApiPlayground.tsx    # Live HTTP test execution sandbox
│   │   ├── CodeSnippet.tsx      # Multi-language SDK syntax highlighter
│   │   └── SchemaTable.tsx      # OpenAPI parameter & payload schema inspector
│   ├── docs/
│   │   ├── Callout.tsx          # Alert callout banners (note, tip, warning)
│   │   └── TableOfContents.tsx  # Dynamic heading spy & quick scroll links
│   └── navigation/
│       ├── Header.tsx           # Search bar, release badges & repo links
│       ├── SearchModal.tsx      # Full-text modal search dialog
│       └── Sidebar.tsx          # Categorized guides & API operation tree
├── content/
│   ├── api/v1/
│   │   └── operations.json      # Structured OpenAPI 3.0 endpoint specifications
│   └── search-index.json        # Pre-indexed search tokens & document deep links
├── types/
│   └── techref-spec.ts          # TypeScript interfaces for API schemas & navigation
├── package.json
└── tsconfig.json
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18.17+ or 20+
- npm, pnpm, or bun

### 1. Installation
```bash
cd techref
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```

Visit [`http://localhost:3000`](http://localhost:3000) to view the documentation portal.

### 3. Production Build
```bash
npm run build
npm run start
```

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](../LICENSE) for more details.
