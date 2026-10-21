# 🏙️ CivicFix AI // Automated Municipal Proof-of-Fix Verification Engine

Automated proof-of-fix verification and anti-fraud auditing engine for municipal public works (such as road pothole repairs, street infrastructure, and waste management).

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![OpenCV](https://img.shields.io/badge/OpenCV-Computer%20Vision-5C3EE8.svg?style=flat-square&logo=opencv&logoColor=white)](https://opencv.org/)
[![Google Gemini](https://img.shields.io/badge/Gemini-2.5%20Flash-4285F4.svg?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev/)
[![React 18](https://img.shields.io/badge/React-18.3-61DAFB.svg?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF.svg?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC.svg?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-00ff66.svg?style=flat-square)](../LICENSE)

---

## 📖 Overview

When a contractor uploads **BEFORE** and **AFTER** photos of a claimed public works repair, CivicFix AI passes them through a rigorous 3-layer anti-fraud verification pipeline. The engine computes a composite **Trust Score (0–100)** and issues a deterministic resolution verdict: `APPROVED`, `NEEDS_REVIEW`, or `REJECTED_FRAUD`.

---

## 🏛️ Verification Architecture

```
                    +-----------------------------+
                    | Contractor Photo Submission |
                    |      (BEFORE & AFTER)       |
                    +--------------+--------------+
                                   |
                                   v
             +-------------------------------------------+
             |         CivicFix Verification Engine      |
             +---------------------+---------------------+
                                   |
       +---------------------------+---------------------------+
       |                           |                           |
       v                           v                           v
+--------------+           +---------------+           +---------------+
|   Layer 1    |           |    Layer 2    |           |    Layer 3    |
| Metadata/Geo |           | OpenCV Vision |           | Gemini Audit  |
| Anti-Spoof   |           | Surface Diff  |           | Multimodal    |
+-------+------+           +-------+-------+           +-------+-------+
        | EXIF GPS / Timestamp     | Homography Alignment      | Defect & Fix
        | Perceptual Hash (pHash)  | Texture Roughness Drop    | Visual Logic
        | Distance & Duplicate     | Structural Heatmap        | Red Flags
        |                          |                           |
        +--------------------------+---------------------------+
                                   |
                                   v
             +-------------------------------------------+
             |     Trust Score & Verdict Synthesis       |
             |       (Score: 0-100, Breakdown)          |
             |  APPROVED | NEEDS_REVIEW | REJECTED_FRAUD  |
             +-------------------------------------------+
```

### The 3 Verification Layers

1. **Layer 1: Metadata & Geo Anti-Spoofing**
   - Parses EXIF camera metadata, device models, and capture timestamps.
   - Computes Haversine geo-distance between before/after coordinates ($< 50\text{m}$ tolerance).
   - Generates perceptual hash (`pHash`) to flag identical or inverted duplicate submissions.
2. **Layer 2: OpenCV Surface Difference Analysis**
   - Computes homography and feature alignment between frames.
   - Evaluates Laplacian variance and gray-level texture roughness drop over the target region.
   - Generates visual difference heatmaps highlighting repaired depressions.
3. **Layer 3: Gemini Multimodal Visual Audit**
   - Dispatches both images to Google Gemini (`gemini-2.5-flash`).
   - Assesses contextual authenticity, road patch boundaries, fresh asphalt texture, and safety hazards.
   - Flags AI hallucinations, Photoshop manipulation, or mismatched environmental surroundings.

---

## 📂 Repository Structure

```text
CivicFix/
├── backend/
│   ├── .env.example
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py            # FastAPI application entrypoint with /health and /verify
│   │   ├── config.py          # Settings and environment configuration
│   │   ├── schemas.py         # Shared Pydantic v2 data models
│   │   ├── fixtures/          # Curated demo test fixtures
│   │   └── services/          # Verification pipeline layers (metadata, OpenCV, Gemini)
│   ├── scripts/               # Maintenance and utility scripts
│   └── tests/                 # Unit and integration test suite
└── frontend/                  # Modern Web Dashboard UI
    ├── src/
    │   ├── App.tsx            # Verification console & file uploader
    │   ├── index.css          # Tailwind CSS styles
    │   └── main.tsx           # React entry point
    ├── package.json
    ├── tailwind.config.js
    └── vite.config.ts
```

---

## 🚀 Setup & Running Locally

### 1. Backend Setup

```bash
# Navigate to backend directory
cd CivicFix/backend

# Create and activate a Python virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
```

Open `backend/.env` and insert your Google Gemini API key:
```env
GEMINI_API_KEY="your-google-gemini-api-key-here"
GEMINI_MODEL="gemini-2.5-flash"
```
> **Note:** If `GEMINI_API_KEY` is omitted or empty, the engine automatically falls back to local heuristic checks without interrupting operation.

Start the FastAPI backend:
```bash
uvicorn app.main:app --reload --port 8000
```

Verify service liveness:
```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

---

### 2. Frontend Setup

In a separate terminal window:

```bash
# Navigate to frontend directory
cd CivicFix/frontend

# Install dependencies
npm install

# Start local Vite development server
npm run dev
```

Visit [`http://localhost:5173`](http://localhost:5173) in your browser to interact with the CivicFix dashboard.

---

## 🧪 Sample Datasets

Curated test photos illustrating verified repairs, fraudulent submissions, and edge cases are located in [`CivicFix_samples/files/pothole_samples/`](../CivicFix_samples/files/pothole_samples/) at the root of the sandbox repository.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](../LICENSE) for complete terms.
