# 🛡️ Avex Defense // SOC & SIEM Web Telemetry Console

A high-density cyber defense telemetry console and SOC (Security Operations Center) dashboard built with **React 19**, **TypeScript**, and **Tailwind CSS**.

[![React 19](https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-00ff66?style=flat-square)](../../LICENSE)

---

## 📖 Overview

This console serves as the real-time front-end for the **Cyber Defense Enclave** backend. It monitors unidirectional network taps (data diodes), plots live high-frequency packet ingestion streams, categorizes AI-detected anomalies, and facilitates immediate triage of threats mapped to MITRE ATT&CK techniques.

---

## ✨ Features

- **🚨 Live Threat Feed**: Real-time alert stream categorized by severity (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) with confidence scores and triage action buttons (`NEW` $\rightarrow$ `INVESTIGATING` $\rightarrow$ `RESOLVED`).
- **🎯 MITRE ATT&CK Matrix**: Visual taxonomy mapping threats to specific adversary tactics (e.g. `T1048` Exfiltration Over Alternative Protocol, `T1046` Network Service Discovery).
- **📊 Shannon Entropy & Flow Analytics**: Dynamic histograms and metrics tracking payload entropy to detect encrypted and packed exfiltration tunnels.
- **🔒 Tamper-Evident Audit Inspector**: Live verification console for the cryptographic SHA-256 chained audit ledger.

---

## 🚀 Quick Start

### 1. Installation
```bash
cd Avex_Defense/frontend
npm install
```

### 2. Development Server
```bash
npm run dev
```

Open [`http://localhost:5173`](http://localhost:5173) in your browser.

### 3. Production Build
```bash
npm run build
npm run preview
```

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](../../LICENSE) for more details.
