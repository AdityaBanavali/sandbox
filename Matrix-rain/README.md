# Matrix Code Rain Portal 🟢💻

An interactive, gesture-controlled digital portal that streams the iconic Matrix digital rain between your hands in real time. Powered by Google MediaPipe hand landmark detection and HTML5 Canvas.

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Tasks%20Vision-blue.svg)](https://developers.google.com/mediapipe)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38bdf8.svg)](https://tailwindcss.com/)
[![Pure JavaScript](https://img.shields.io/badge/JavaScript-ES%20Modules-yellow.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

---

## ✨ Features

- **🖐️ Real-Time Dual Hand Tracking**: Leverages Google MediaPipe's GPU-accelerated `HandLandmarker` model to track 21 skeletal landmarks per hand with low latency.
- **🤏 Dual-Pinch Gesture Recognition**: Detects precise pinch gestures (index fingertip to thumb tip) on both hands simultaneously.
- **🌌 Dynamic Matrix Portal**: Pinching both hands spawns an interactive rectangular portal spanning between your pinch points.
- **⚡ Authentic Matrix Rain**: Cascading streams of Japanese Katakana, alphanumeric characters, glowing bright-white stream heads, and smooth green fading tails.
- **🪞 Mirrored & Upright Rendering**: Webcam video is mirrored naturally for intuitive interaction, while canvas transformations ensure falling glyphs stay correctly oriented.
- **🎯 Cyberpunk HUD & Telemetry**: Built-in status indicators monitor hand detection status and portal state in real time.
- **🚀 Zero Build Step**: Runs directly in any modern browser via standard ES modules and CDNs.

---

## 🎮 How It Works

| Step | Action | Description |
| :--- | :--- | :--- |
| **1** | **Allow Camera** | Grant webcam access when prompted by your browser. |
| **2** | **Show Both Hands** | Raise both hands into the camera frame. The status indicator will turn green (`2 Hand(s) Locked 🎯`). |
| **3** | **Pinch on Both Hands** | Pinch your thumb and index finger together on **both** hands. |
| **4** | **Control the Portal** | Move your hands apart, closer, higher, or lower to dynamically stretch, resize, and position the Matrix code portal! |

---

## 🚀 Quick Start

Modern browsers require a secure origin (`http://localhost` or `https://`) to access the webcam via `navigator.mediaDevices.getUserMedia`.

### Option 1: Using `npx serve` (Node.js)

```bash
# Clone the repository
git clone https://github.com/AdityaBanavali/Matrix-rain.git
cd Matrix-rain

# Start a local static server
npx serve
```

Open your browser at `http://localhost:3000`.

### Option 2: Using Python 3

```bash
python3 -m http.server 3000
```

Open your browser at `http://localhost:3000`.

### Option 3: VS Code Live Server

Open the project folder in VS Code, right-click `index.html`, and select **"Open with Live Server"**.

---

## 🛠️ Tech Stack

- **Computer Vision**: [@mediapipe/tasks-vision](https://www.npmjs.com/package/@mediapipe/tasks-vision) (`HandLandmarker`)
- **Canvas Rendering**: Native HTML5 Canvas 2D API
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (CDN)
- **Language**: Vanilla JavaScript (ES Modules)

---

## 🔒 Privacy

All hand detection and video processing occurs **100% locally on your device** inside the browser using WebAssembly and WebGL/GPU. No video feed or personal data is ever recorded, stored, or sent to any external server.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
