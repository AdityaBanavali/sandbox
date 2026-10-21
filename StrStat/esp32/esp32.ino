#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <ArduinoJson.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <WiFi.h>
#include <Wire.h>
#include <arduinoFFT.h>

/* =========================================================================
   1. NETWORK CONFIGURATION
   ========================================================================= */
const char *WIFI_SSID = "YOUR_WIFI_SSID";
const char *WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

AsyncWebServer server(80);
AsyncWebSocket ws("/ws");

/* =========================================================================
   2. PIN DEFINITIONS & HARDWARE CONSTANTS
   ========================================================================= */
#define RELAY_ACTUATOR_PIN                                                     \
  23                     // Pin connected to safety gate relay / motor driver
#define BUZZER_PIN 19    // Pin connected to audible alarm buzzer
#define STATUS_LED_PIN 2 // Built-in status LED

Adafruit_MPU6050 mpu;

/* =========================================================================
   3. FFT & SAMPLING DEFINITIONS
   ========================================================================= */
#define SAMPLES 64          // Power of 2 (window size)
#define SAMPLING_FREQ_HZ 50 // 50 Hz sampling frequency (Nyquist max: 25 Hz)

double vReal[SAMPLES];
double vImag[SAMPLES];
ArduinoFFT<double> FFT =
    ArduinoFFT<double>(vReal, vImag, SAMPLES, SAMPLING_FREQ_HZ);

unsigned int samplingPeriodUs;
unsigned long lastSampleTimeUs = 0;
int sampleIndex = 0;

/* =========================================================================
   4. TINYML LIGHTWEIGHT INFERENCE ENGINE (MLP / ANN)
   =========================================================================
   Input Features (5):
     [0]: Norm Acceleration Magnitude (g)
     [1]: Absolute Pitch (deg)
     [2]: Absolute Roll (deg)
     [3]: Dominant Frequency (Hz)
     [4]: Peak FFT Magnitude
   Architecture: Dense(5 -> 8, ReLU) -> Dense(8 -> 1, Sigmoid)
   ========================================================================= */
struct TinyML_Model {
  // Weights & Biases for Layer 1 (5 -> 8)
  const float W1[8][5] = {
      {0.74, 0.42, 0.38, 1.12, 0.89},    {-0.21, 0.85, 0.72, 0.95, 0.64},
      {0.91, -0.15, -0.12, 1.45, 1.10},  {0.35, 0.68, 0.61, 0.82, 0.73},
      {-0.44, 0.31, 0.29, -0.65, -0.52}, {1.05, 0.92, 0.88, 1.30, 1.25},
      {0.12, -0.45, -0.41, 0.55, 0.41},  {0.88, 0.54, 0.59, 1.02, 0.95}};
  const float b1[8] = {-0.25, -0.18, -0.42, -0.11, 0.05, -0.62, 0.02, -0.31};

  // Weights & Biases for Layer 2 (8 -> 1)
  const float W2[8] = {0.85, 0.62, 1.15, 0.48, -0.72, 1.40, 0.22, 0.94};
  const float b2 = -1.85;

  static inline float relu(float x) { return (x > 0.0f) ? x : 0.0f; }

  static inline float sigmoid(float x) { return 1.0f / (1.0f + expf(-x)); }

  float predict(float *x) {
    float h1[8];
    for (int i = 0; i < 8; i++) {
      float sum = b1[i];
      for (int j = 0; j < 5; j++) {
        sum += W1[i][j] * x[j];
      }
      h1[i] = relu(sum);
    }

    float out = b2;
    for (int i = 0; i < 8; i++) {
      out += W2[i] * h1[i];
    }
    return sigmoid(out);
  }
} model;

/* =========================================================================
   5. TELEMETRY STATE
   ========================================================================= */
float accelX = 0, accelY = 0, accelZ = 1.0;
float pitchDeg = 0, rollDeg = 0;
float dominantFreq = 0.0;
float peakMagnitude = 0.0;
float anomalyScore = 0.0;
bool safetyBarrierDeployed = false;
bool buzzerState = false;
unsigned long lastInferenceLatencyMs = 0;
unsigned long lastBroadcastTime = 0;

/* =========================================================================
   6. WEBSOCKET HANDLER & TELEMETRY BROADCAST
   ========================================================================= */
void broadcastTelemetry() {
  if (ws.count() == 0)
    return; // Do not serialize if no clients are connected

  StaticJsonDocument<512> doc;
  doc["connected"] = true;
  doc["timestamp"] = millis();

  JsonObject imuObj = doc.createNestedObject("imu");
  JsonObject accelObj = imuObj.createNestedObject("accel");
  accelObj["x"] = serialized(String(accelX, 3));
  accelObj["y"] = serialized(String(accelY, 3));
  accelObj["z"] = serialized(String(accelZ, 3));

  JsonObject tiltObj = imuObj.createNestedObject("tilt");
  tiltObj["pitch"] = serialized(String(pitchDeg, 2));
  tiltObj["roll"] = serialized(String(rollDeg, 2));

  JsonObject fftObj = doc.createNestedObject("fft");
  fftObj["dominant_freq_hz"] = serialized(String(dominantFreq, 2));
  fftObj["peak_magnitude"] = serialized(String(peakMagnitude, 3));

  JsonObject infObj = doc.createNestedObject("inference");
  infObj["anomaly_score"] = serialized(String(anomalyScore, 3));
  infObj["probability"] = serialized(String(anomalyScore, 3));
  infObj["inference_latency_ms"] = lastInferenceLatencyMs;

  if (anomalyScore > 0.70) {
    infObj["state"] = "SEISMIC_EVENT";
  } else if (anomalyScore > 0.40) {
    infObj["state"] = "RESONANCE_WARNING";
  } else {
    infObj["state"] = "NOMINAL";
  }

  JsonObject actObj = doc.createNestedObject("actuator");
  actObj["safety_barrier_deployed"] = safetyBarrierDeployed;
  actObj["buzzer_state"] = buzzerState;

  String jsonBuffer;
  serializeJson(doc, jsonBuffer);
  ws.textAll(jsonBuffer);
}

void onWebSocketEvent(AsyncWebSocket *server, AsyncWebSocketClient *client,
                      AwsEventType type, void *arg, uint8_t *data, size_t len) {
  if (type == WS_EVT_CONNECT) {
    Serial.printf("[WS] Client #%u connected from %s\n", client->id(),
                  client->remoteIP().toString().c_str());
  } else if (type == WS_EVT_DISCONNECT) {
    Serial.printf("[WS] Client #%u disconnected\n", client->id());
  } else if (type == WS_EVT_DATA) {
    // Handle incoming manual override commands from the dashboard
    StaticJsonDocument<256> rxDoc;
    DeserializationError err = deserializeJson(rxDoc, data, len);
    if (!err) {
      if (rxDoc.containsKey("toggle_actuator")) {
        safetyBarrierDeployed = rxDoc["toggle_actuator"].as<bool>();
        digitalWrite(RELAY_ACTUATOR_PIN, safetyBarrierDeployed ? HIGH : LOW);
        digitalWrite(BUZZER_PIN, safetyBarrierDeployed ? HIGH : LOW);
        buzzerState = safetyBarrierDeployed;
        broadcastTelemetry();
      }
    }
  }
}

/* =========================================================================
   7. INITIALIZATION & SETUP
   ========================================================================= */
void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22); // Standard SDA (21), SCL (22) for ESP32

  pinMode(RELAY_ACTUATOR_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(RELAY_ACTUATOR_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  // Initialize MPU6050
  if (!mpu.begin()) {
    Serial.println("[ERR] Failed to detect MPU6050 chip. Check wiring!");
    while (1) {
      digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));
      delay(200);
    }
  }
  mpu.setAccelerometerRange(MPU6050_RANGE_4_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

  samplingPeriodUs = round(1000000.0 * (1.0 / SAMPLING_FREQ_HZ));

  // Connect to Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("[WiFi] Connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[WiFi] Connected!");
  Serial.print("[WiFi] ESP32 IP Address: ");
  Serial.println(WiFi.localIP());

  // Setup WebSockets
  ws.onEvent(onWebSocketEvent);
  server.addHandler(&ws);
  server.begin();

  digitalWrite(STATUS_LED_PIN, HIGH);
}

/* =========================================================================
   8. MAIN EXECUTION LOOP
   ========================================================================= */
void loop() {
  ws.cleanupClients();
  unsigned long nowUs = micros();

  // High-frequency sensor acquisition & buffer fill
  if (nowUs - lastSampleTimeUs >= samplingPeriodUs) {
    lastSampleTimeUs = nowUs;

    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);

    // Convert acceleration from m/s^2 to g
    accelX = a.acceleration.x / 9.80665f;
    accelY = a.acceleration.y / 9.80665f;
    accelZ = a.acceleration.z / 9.80665f;

    // Calculate pitch and roll deflection
    pitchDeg =
        atan2(-accelX, sqrt(accelY * accelY + accelZ * accelZ)) * 180.0 / PI;
    rollDeg = atan2(accelY, accelZ) * 180.0 / PI;

    // FFT input buffer uses total dynamic acceleration magnitude
    float netAccel = sqrt(accelX * accelX + accelY * accelY + accelZ * accelZ) -
                     1.0f; // dynamic component
    vReal[sampleIndex] = netAccel;
    vImag[sampleIndex] = 0.0;
    sampleIndex++;

    // Once full sampling window is collected, run FFT + TinyML
    if (sampleIndex >= SAMPLES) {
      sampleIndex = 0;

      unsigned long startInf = millis();

      // Run FFT
      FFT.windowing(FFTWindow::Hamming, FFTDirection::Forward);
      FFT.compute(FFTDirection::Forward);
      FFT.complexToMagnitudes();

      dominantFreq = (float)FFT.majorPeak();

      // Find peak spectral amplitude (ignore DC offset bin index 0)
      peakMagnitude = 0.0f;
      for (int i = 1; i < (SAMPLES / 2); i++) {
        if (vReal[i] > peakMagnitude) {
          peakMagnitude = (float)vReal[i];
        }
      }

      // Prepare TinyML feature vector
      float features[5] = {fabs(netAccel),
                           fabs(pitchDeg) / 45.0f, // Normalization
                           fabs(rollDeg) / 45.0f, dominantFreq / 25.0f,
                           peakMagnitude};

      // Run Edge Inference
      anomalyScore = model.predict(features);
      lastInferenceLatencyMs = millis() - startInf;

      // Trigger automated physical safeguards if seismic threshold breached
      if (anomalyScore > 0.70) {
        safetyBarrierDeployed = true;
        buzzerState = true;
        digitalWrite(RELAY_ACTUATOR_PIN, HIGH);
        digitalWrite(BUZZER_PIN, HIGH);
      }
    }
  }

  // Broadcast live telemetry packet over WebSocket at 20 Hz (every 50 ms)
  if (millis() - lastBroadcastTime >= 50) {
    lastBroadcastTime = millis();
    broadcastTelemetry();
  }
}