export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AlertStatus = 'NEW' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE';

export interface MitreAttackInfo {
  technique_id: string;
  technique_name: string;
  tactic: string;
  subtechnique_id?: string | null;
  description: string;
  url?: string | null;
}

export interface FlowTuple {
  src_ip: string;
  dst_ip: string;
  src_port: number;
  dst_port: number;
  protocol: string;
  packet_count?: number;
  byte_count?: number;
  payload_entropy?: number;
  duration_ms?: number;
  packet_size_skew?: number;
  iat_entropy?: number;
  ttl_variance?: number;
}

export interface FeatureAttribution {
  feature: string;
  importance: number; // e.g. 0.42
  actualValue: string | number;
  description: string;
}

export interface ThreatAlert {
  id: string;
  flow_id: string;
  severity: SeverityLevel;
  severity_score: number; // 0.0 - 10.0
  confidence: number; // 0.0 - 1.0
  behavior_class: string;
  status: AlertStatus;
  model_version: string;
  timestamp: string;
  explanation?: Record<string, any>;
  mitre_attack?: MitreAttackInfo;
  flow?: FlowTuple;
  features_attribution?: FeatureAttribution[];
  is_novel_zero_day?: boolean;
  unsupervised_score?: number;
  isNew?: boolean; // Used for frontend flash animation
}

export interface ThroughputMetric {
  time: string;
  packetsPerSec: number;
  bytesPerSec: number;
  threatsPerSec: number;
}

export interface MitreCell {
  technique_id: string;
  technique_name: string;
  tactic_name: string;
  subtechnique_id?: string | null;
  description: string;
  url: string;
  alertCount: number;
  isHighlighted: boolean;
  lastActiveTime?: string;
}

export interface MitreColumn {
  tacticName: string;
  displayName: string;
  techniques: MitreCell[];
}

export interface EnclaveRiskSummary {
  riskScore: number; // 0 - 100
  threatLevel: 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  bySeverity: Record<SeverityLevel, number>;
  totalAlerts: number;
  diodeStatus: 'SECURE' | 'ANOMALOUS';
  tamperEvidentChainVerified: boolean;
  headHash: string;
}
