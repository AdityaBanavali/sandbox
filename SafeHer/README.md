# 🛡️ SafeHer // Integrated IoT Women's Safety & Health Ecosystem

A holistic women's personal safety and health monitoring ecosystem connecting an **ESP32 wearable hardware sensor** to a **cross-platform Flutter application** with real-time fall detection, physical panic alerts, live GPS telemetry, and predictive health analytics.

[![Flutter](https://img.shields.io/badge/Flutter-3.9+-02569B?style=flat-square&logo=flutter&logoColor=white)](https://flutter.dev)
[![Dart](https://img.shields.io/badge/Dart-3.9+-0175C2?style=flat-square&logo=dart&logoColor=white)](https://dart.dev)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%7C%20RTDB%20%7C%20FCM-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com)
[![Hardware: ESP32](https://img.shields.io/badge/Hardware-ESP32%20%2B%20MPU6050-E7352C?style=flat-square&logo=espressif&logoColor=white)](https://www.espressif.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-00ff66?style=flat-square)](../LICENSE)

---

## 📑 System Architecture

```mermaid
graph TD
    subgraph IoT Wearable Hardware
        A[MPU6050 6-DoF Accelerometer / Gyro] -->|I2C Sensor Data| B[ESP32 Microcontroller]
        C[Hardware Panic Switch] -->|Interrupt Trigger| B
        B -->|Fall Detection & Panic Logic| D[WiFi / BLE Gateway]
    end

    subgraph Cloud Infrastructure
        D -->|Realtime Stream| E[(Firebase Realtime Database)]
        E -->|Trigger Cloud Event| F[Cloud Functions]
        F -->|Push Critical Alert| G[Firebase Cloud Messaging (FCM)]
    end

    subgraph SafeHer Mobile App (Flutter)
        E -->|Live Sync| H[Emergency Dashboard]
        G -->|Urgent Notification| I[Flutter Local Notifications]
        J[Geolocator GPS] -->|Attach Live Coordinates| H
        H -->|Broadcast Alert + Map Pin| K[Trusted Contacts SMS / Alert]
        
        L[Menstrual Cycle Tracker] -->|Cycle History & Predictions| M[(Cloud Firestore)]
        N[Predictive Health Analytics] -->|fl_chart Visualizer| H
    end
```

---

## ⚡ Key Features

### 🛡️ 1. Proactive IoT Safety & Emergency Detection
- **MPU6050 Motion Sensor Integration**: Samples acceleration magnitude and angular tilt to identify sudden fall impacts followed by user immobility.
- **Physical Panic Button**: One-touch hardware trigger for immediate emergency broadcast without requiring the phone to be unlocked.
- **Continuous GPS Telemetry**: Automatically queries high-accuracy device coordinates via `geolocator` and attaches live Google Maps links to emergency alerts.
- **Automated Fall & Panic Alarms**: Emits high-priority audiovisual alerts through `flutter_local_notifications` with override capabilities.

### 🌸 2. Health & Wellness Management
- **Interactive Menstrual Cycle Tracker**: Calendar-driven cycle logging powered by `table_calendar`, calculating ovulation windows, expected periods, and symptom trends.
- **Predictive Health Analytics**: Dynamic trend line charts rendered via `fl_chart` tracking sleep consistency, stress indicators, and physical wellness.
- **Automated Hygiene Reminders**: Scheduled local push notifications for hydration, medication, and self-care routines.

### ☁️ 3. Cloud Synchronization & Zero-Trust Security
- **Firebase Realtime Database**: Low-latency edge-to-app telemetry stream ensuring instant alert propagation under 150ms.
- **Firebase Authentication & Firestore**: Secure credential storage, encrypted contact lists, and role-based data isolation via hardened `firestore.rules`.

---

## 📂 Project Structure

```text
SafeHer/
├── android/                     # Native Android project configuration & Gradle files
├── web/                         # Flutter Web runner & manifest
├── lib/
│   ├── main.dart                # Application entrypoint & theme configuration
│   ├── emergency_dashboard.dart # Real-time SOS console, fall status & GPS broadcast
│   ├── menstrual_cycle_page.dart# Table Calendar cycle tracking & prediction interface
│   ├── analysis_page.dart       # FL Chart health metrics & telemetry visualizer
│   └── firebase_options.dart    # Firebase configuration initializer
├── functions/                   # Firebase Cloud Functions backend (.idx)
├── firestore.rules              # Cloud Firestore security & authorization policies
├── firestore_schema.json        # Document schema definition
├── pubspec.yaml                 # Flutter dependencies & asset declarations
└── app-release.apk              # Pre-built standalone Android release package
```

---

## 🚀 Getting Started

### Prerequisites
- [Flutter SDK](https://docs.flutter.dev/get-started/install) (`v3.9.0` or higher)
- [Dart SDK](https://dart.dev/get-dart)
- Android Studio or VS Code with Flutter extension
- Firebase project credentials

### 1. Installation
```bash
cd SafeHer
flutter pub get
```

### 2. Configure Firebase
Ensure your Firebase configuration is generated or linked:
```bash
flutterfire configure
```

### 3. Run on Mobile Device or Emulator
```bash
# List available target devices
flutter devices

# Launch development build
flutter run
```

### 4. Build Standalone APK
```bash
flutter build apk --release
# Output location: build/app/outputs/flutter-apk/app-release.apk
```

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](../LICENSE) for complete terms.
