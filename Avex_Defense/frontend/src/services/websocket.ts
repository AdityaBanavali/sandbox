import type { ThreatAlert, SeverityLevel } from '../types/soc';

type AlertListener = (alert: ThreatAlert) => void;
type StatusListener = (connected: boolean, mode: 'LIVE_WEBSOCKET' | 'SIMULATED_FEED') => void;

class WebSocketClient {
  private socket: WebSocket | null = null;
  private url: string = 'ws://localhost:8000/api/v1/ws/alerts';
  private alertListeners: Set<AlertListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private isConnected: boolean = false;
  private isSimulationActive: boolean = false;
  private simulationInterval: number | null = null;
  private reconnectTimer: number | null = null;

  constructor() {
    this.initWebSocket();
  }

  public subscribeAlerts(listener: AlertListener): () => void {
    this.alertListeners.add(listener);
    return () => this.alertListeners.delete(listener);
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.isConnected, this.isSimulationActive ? 'SIMULATED_FEED' : 'LIVE_WEBSOCKET');
    return () => this.statusListeners.delete(listener);
  }

  public initWebSocket() {
    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.notifyStatus();
        console.log('[SOC WS] Connected to live FastAPI backend at', this.url);
        // Clear reconnect loop if active
        if (this.reconnectTimer) {
          clearInterval(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'NEW_ALERT' || data.severity) {
            const formatted = this.normalizeAlert(data);
            this.dispatchAlert(formatted);
          }
        } catch (err) {
          console.debug('[SOC WS] Non-JSON or handshake frame received', event.data);
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.notifyStatus();
        this.scheduleReconnect();
      };

      this.socket.onerror = () => {
        this.isConnected = false;
        this.notifyStatus();
      };
    } catch (e) {
      this.isConnected = false;
      this.notifyStatus();
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (!this.reconnectTimer && !this.isConnected) {
      this.reconnectTimer = window.setTimeout(() => {
        this.initWebSocket();
      }, 5000);
    }
  }

  private notifyStatus() {
    const mode = this.isSimulationActive ? 'SIMULATED_FEED' : 'LIVE_WEBSOCKET';
    this.statusListeners.forEach((fn) => fn(this.isConnected, mode));
  }

  private dispatchAlert(alert: ThreatAlert) {
    this.alertListeners.forEach((fn) => fn(alert));
  }

  public toggleSimulation(active?: boolean): boolean {
    const newState = active !== undefined ? active : !this.isSimulationActive;
    this.isSimulationActive = newState;

    if (this.isSimulationActive) {
      console.log('[SOC Demo] Starting synthetic threat pulse generator...');
      this.startSimulation();
    } else {
      console.log('[SOC Demo] Stopped synthetic threat pulse generator.');
      this.stopSimulation();
    }
    this.notifyStatus();
    return this.isSimulationActive;
  }

  public triggerManualThreatBurst(): ThreatAlert {
    const mock = this.generateSyntheticThreat();
    this.dispatchAlert(mock);
    return mock;
  }

  private startSimulation() {
    if (this.simulationInterval) clearInterval(this.simulationInterval);
    // Push an immediate alert
    this.dispatchAlert(this.generateSyntheticThreat());
    // Schedule periodic alerts every 7-12 seconds
    this.simulationInterval = window.setInterval(() => {
      this.dispatchAlert(this.generateSyntheticThreat());
    }, 8000);
  }

  private stopSimulation() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
  }

  private normalizeAlert(raw: any): ThreatAlert {
    const sev: SeverityLevel = (raw.severity || 'MEDIUM').toUpperCase() as SeverityLevel;
    return {
      id: raw.alert_id || raw.id || `alert-${Math.random().toString(36).substring(2, 9)}`,
      flow_id: raw.flow_id || `flow-${Math.random().toString(36).substring(2, 9)}`,
      severity: sev,
      severity_score: raw.severity_score ?? (sev === 'CRITICAL' ? 9.4 : sev === 'HIGH' ? 7.8 : 4.5),
      confidence: raw.confidence ?? 0.92,
      behavior_class: raw.behavior_class || 'Anomalous Data Diode Telemetry',
      status: raw.status || 'NEW',
      model_version: raw.model_version || 'v1.0.0-unidirectional',
      timestamp: raw.timestamp || new Date().toISOString(),
      mitre_attack: raw.mitre_attack || {
        technique_id: 'T1048.003',
        technique_name: 'Exfiltration Over Non-C2 Protocol',
        tactic: 'Exfiltration',
        description: 'High-entropy unidirectional payload transmission across secure diode tap.',
        url: 'https://attack.mitre.org/techniques/T1048/003/',
      },
      flow: raw.flow || {
        src_ip: '192.168.1.105',
        dst_ip: '10.0.0.50',
        src_port: 54112,
        dst_port: 53,
        protocol: 'UDP',
        payload_entropy: 7.88,
        packet_count: 64,
        byte_count: 24500,
        duration_ms: 3200,
      },
      features_attribution: [
        { feature: 'payload_entropy', importance: 0.44, actualValue: '7.88 bits/byte', description: 'Entropy exceeds encrypted exfiltration threshold 7.5' },
        { feature: 'iat_entropy', importance: 0.28, actualValue: '0.42 bits', description: 'Extremely rigid inter-arrival beacon cadence' },
        { feature: 'packet_size_skew', importance: 0.16, actualValue: '+2.85', description: 'Severe right-tail size distribution anomaly' },
      ],
      isNew: true,
    };
  }

  private generateSyntheticThreat(): ThreatAlert {
    const templates = [
      {
        behavior: 'High-Entropy DNS Tunneling Exfiltration',
        sev: 'CRITICAL' as SeverityLevel,
        score: 9.6,
        conf: 0.97,
        tid: 'T1071.004',
        tname: 'Application Layer Protocol: DNS',
        tactic: 'Command and Control',
        sub: 'T1071.004',
        src: '192.168.10.42',
        dst: '10.0.0.53',
        sp: 59124,
        dp: 53,
        proto: 'UDP',
        entropy: 7.92,
        iat: 0.35,
        pkts: 120,
        bytes: 84000,
        desc: 'Adversary exfiltrating structured encrypted payloads inside base32-encoded DNS subdomain queries.',
        shap: [
          { feature: 'payload_entropy', importance: 0.52, actualValue: '7.92 bits/byte', description: 'Near-maximum Shannon entropy indicating encrypted exfil' },
          { feature: 'dst_port', importance: 0.25, actualValue: '53 (DNS)', description: 'Targeting standard DNS infrastructure port' },
          { feature: 'iat_entropy', importance: 0.15, actualValue: '0.35 bits', description: 'Deterministic beacon intervals' },
        ],
      },
      {
        behavior: 'Unidirectional SYN Port Sweep Sweep',
        sev: 'HIGH' as SeverityLevel,
        score: 7.9,
        conf: 0.91,
        tid: 'T1046',
        tname: 'Network Service Discovery',
        tactic: 'Discovery',
        src: '172.16.4.11',
        dst: '10.0.0.100',
        sp: 41200,
        dp: 80,
        proto: 'TCP',
        entropy: 1.15,
        iat: 1.85,
        pkts: 45,
        bytes: 2800,
        desc: 'Probing internal subnet with unidirectional SYN datagrams across multiple ports without return ACK visibility.',
        shap: [
          { feature: 'protocol_flags', importance: 0.46, actualValue: 'SYN-Without-ACK', description: 'Unidirectional diode signature sweep' },
          { feature: 'packet_count', importance: 0.31, actualValue: '45 packets', description: 'Abnormal burst rate in 1-second window' },
        ],
      },
      {
        behavior: 'Rigid C2 Beacon Cadence (T1071.004)',
        sev: 'HIGH' as SeverityLevel,
        score: 8.2,
        conf: 0.94,
        tid: 'T1071.004',
        tname: 'Application Layer Protocol: DNS',
        tactic: 'Command and Control',
        src: '192.168.1.88',
        dst: '10.0.0.12',
        sp: 51234,
        dp: 443,
        proto: 'TCP',
        entropy: 5.4,
        iat: 0.12,
        pkts: 80,
        bytes: 18400,
        desc: 'Inter-arrival time entropy is near zero (0.12), indicating automated malware heartbeat pulse.',
        shap: [
          { feature: 'iat_entropy', importance: 0.62, actualValue: '0.12 bits', description: 'Extreme periodic regularity (C2 heartbeat)' },
          { feature: 'mean_iat_ms', importance: 0.22, actualValue: '250.0 ms', description: 'Fixed timer loop pulse cadence' },
        ],
      },
      {
        behavior: 'Unauthorized Protected SCADA Subnet Ingress',
        sev: 'CRITICAL' as SeverityLevel,
        score: 9.8,
        conf: 0.99,
        tid: 'T1571',
        tname: 'Non-Standard Port',
        tactic: 'Command and Control',
        src: '192.168.99.120',
        dst: '10.0.0.5',
        sp: 49822,
        dp: 502,
        proto: 'TCP',
        entropy: 4.8,
        iat: 2.1,
        pkts: 32,
        bytes: 9400,
        desc: 'Inbound packet flow directed to Modbus SCADA port 502 across protected industrial diode boundary.',
        shap: [
          { feature: 'dst_port', importance: 0.58, actualValue: '502 (Modbus)', description: 'Critical infrastructure SCADA control port' },
          { feature: 'dst_ip_enclave', importance: 0.32, actualValue: '10.0.0.5 (Core Enclave)', description: 'Asset criticality weight 2.0x applied' },
        ],
      },
      {
        behavior: 'Multi-Device TTL Masquerading / Device Spoof',
        sev: 'MEDIUM' as SeverityLevel,
        score: 5.8,
        conf: 0.85,
        tid: 'T1036',
        tname: 'Masquerading',
        tactic: 'Defense Evasion',
        src: '192.168.1.200',
        dst: '10.0.0.22',
        sp: 33410,
        dp: 8080,
        proto: 'TCP',
        entropy: 3.2,
        iat: 1.4,
        pkts: 28,
        bytes: 5200,
        desc: 'Single source IP exhibiting variance in initial TTL (32 vs 64 vs 128), indicating IP address spoofing or router NAT hopping.',
        shap: [
          { feature: 'ttl_variance', importance: 0.49, actualValue: '18.4', description: 'Multiple operating systems inferred from one IP' },
          { feature: 'packet_size_std', importance: 0.26, actualValue: '124.0', description: 'Jitter in frame encapsulation sizes' },
        ],
      },
      {
        behavior: 'Volumetric Diode Bandwidth Denial of Service',
        sev: 'CRITICAL' as SeverityLevel,
        score: 9.3,
        conf: 0.96,
        tid: 'T1498',
        tname: 'Network Denial of Service',
        tactic: 'Impact',
        src: '192.168.50.77',
        dst: '10.0.0.1',
        sp: 12000,
        dp: 80,
        proto: 'UDP',
        entropy: 4.1,
        iat: 0.05,
        pkts: 1850,
        bytes: 1850000,
        desc: 'Traffic volume deviates 4.8 standard deviations above EWMA baseline, threatening diode optical sensor throughput.',
        shap: [
          { feature: 'ewma_z_score', importance: 0.65, actualValue: '+4.8 sigma', description: 'Extreme volumetric traffic surge' },
          { feature: 'byte_count', importance: 0.28, actualValue: '1.85 MB / window', description: 'Bandwidth saturation attempt' },
        ],
      },
    ];

    const pick = templates[Math.floor(Math.random() * templates.length)];
    const alertId = `alert-${uuid()}`;

    return {
      id: alertId,
      flow_id: `flow-${uuid()}`,
      severity: pick.sev,
      severity_score: pick.score,
      confidence: pick.conf,
      behavior_class: pick.behavior,
      status: 'NEW',
      model_version: 'v1.0.0-unidirectional',
      timestamp: new Date().toISOString(),
      mitre_attack: {
        technique_id: pick.tid,
        technique_name: pick.tname,
        tactic: pick.tactic,
        subtechnique_id: pick.sub || null,
        description: pick.desc,
        url: `https://attack.mitre.org/techniques/${pick.tid.replace('.', '/')}/`,
      },
      flow: {
        src_ip: pick.src,
        dst_ip: pick.dst,
        src_port: pick.sp,
        dst_port: pick.dp,
        protocol: pick.proto,
        payload_entropy: pick.entropy,
        packet_count: pick.pkts,
        byte_count: pick.bytes,
        duration_ms: Math.round(pick.pkts * 18.5),
        packet_size_skew: 1.45,
        iat_entropy: pick.iat,
      },
      features_attribution: pick.shap,
      isNew: true,
    };
  }
}

function uuid() {
  return Math.random().toString(36).substring(2, 9);
}

export const wsClient = new WebSocketClient();
