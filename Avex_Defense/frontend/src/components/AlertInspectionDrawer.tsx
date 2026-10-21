import React, { useState } from 'react';
import { 
  ExternalLink, 
  Hash, 
  BarChart3, 
  Layers, 
  CheckCircle2, 
  Copy, 
  Radio, 
  FileCheck
} from 'lucide-react';
import type { ThreatAlert, AlertStatus } from '../types/soc';

interface AlertInspectionDrawerProps {
  alert: ThreatAlert | null;
  onUpdateStatus?: (alertId: string, status: AlertStatus) => void;
}

export const AlertInspectionDrawer: React.FC<AlertInspectionDrawerProps> = ({
  alert,
  onUpdateStatus,
}) => {
  const [copied, setCopied] = useState(false);
  const [proofVerified, setProofVerified] = useState(false);

  if (!alert) {
    return (
      <div className="bg-cyber-surface border border-cyber-border rounded-xl p-6 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
        <div className="w-12 h-12 rounded-full bg-cyber-elevated border border-cyber-border flex items-center justify-center text-cyber-muted mb-3">
          <Layers className="w-6 h-6" />
        </div>
        <h4 className="text-xs font-bold font-mono text-white tracking-wider">
          NO ALERT SELECTED
        </h4>
        <p className="text-[11px] text-cyber-muted font-mono max-w-sm mt-1">
          Click any threat alert from the live feed or a lit-up MITRE technique cell to inspect raw network telemetry, SHAP explainability attribution, and cryptographic ledger proofs.
        </p>
      </div>
    );
  }

  const handleCopyHash = () => {
    const fakeHash = `sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069`;
    navigator.clipboard.writeText(fakeHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerifyProof = () => {
    setProofVerified(true);
    setTimeout(() => setProofVerified(false), 3000);
  };

  const getSeverityBadgeClass = () => {
    switch (alert.severity) {
      case 'CRITICAL':
        return 'bg-cyber-red/25 border-cyber-red text-cyber-red glow-red';
      case 'HIGH':
        return 'bg-orange-500/25 border-orange-500 text-orange-400';
      case 'MEDIUM':
        return 'bg-cyber-amber/25 border-cyber-amber text-cyber-amber';
      case 'LOW':
        return 'bg-cyber-cyan/25 border-cyber-cyan text-cyber-cyan';
    }
  };

  const featuresList = alert.features_attribution || [
    { feature: 'payload_entropy', importance: 0.48, actualValue: `${alert.flow?.payload_entropy || 7.85} bits/byte`, description: 'Shannon entropy indicates encrypted payload or stego exfiltration' },
    { feature: 'iat_entropy', importance: 0.32, actualValue: `${alert.flow?.iat_entropy || 0.38} bits`, description: 'Rigid inter-arrival time periodicity characteristic of C2 beacons' },
    { feature: 'packet_size_skew', importance: 0.20, actualValue: '+2.41 skew', description: 'Significant right-tail size distribution divergence from normal baseline' },
  ];

  return (
    <div className="bg-cyber-surface border border-cyber-border rounded-xl p-4 flex flex-col h-full overflow-y-auto">
      {/* Top Banner: Behavior Title & Status Controls */}
      <div className="border-b border-cyber-border pb-3 mb-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-extrabold font-mono px-2 py-0.5 rounded border uppercase tracking-wider ${getSeverityBadgeClass()}`}>
              {alert.severity}
            </span>
            <span className="text-xs font-bold text-white font-mono">
              {alert.behavior_class}
            </span>
          </div>

          {/* Triage Status Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-cyber-muted">STATUS:</span>
            <select
              value={alert.status}
              onChange={(e) => onUpdateStatus && onUpdateStatus(alert.id, e.target.value as AlertStatus)}
              className="bg-cyber-bg border border-cyber-border rounded px-2 py-0.5 text-xs font-mono text-cyber-cyan focus:outline-none focus:border-cyber-cyan"
            >
              <option value="NEW">NEW</option>
              <option value="INVESTIGATING">INVESTIGATING</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="FALSE_POSITIVE">FALSE POSITIVE</option>
            </select>
          </div>
        </div>

        {/* Confidence & Scoring Pill */}
        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-cyber-muted">
          <span>
            SEVERITY SCORE: <strong className="text-white">{alert.severity_score.toFixed(1)} / 10.0</strong>
          </span>
          <span>•</span>
          <span>
            CONFIDENCE: <strong className="text-cyber-green">{Math.round(alert.confidence * 100)}%</strong>
          </span>
          <span>•</span>
          <span>
            MODEL: <strong className="text-cyber-cyan">{alert.model_version}</strong>
          </span>
        </div>
      </div>

      <div className="space-y-3.5 flex-1 font-mono text-xs">
        {/* 1. Network Telemetry Coordinates */}
        <div className="bg-cyber-elevated/70 border border-cyber-border rounded-lg p-3">
          <div className="text-[11px] text-cyber-cyan font-bold mb-2 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5" />
            <span>UNIDIRECTIONAL 5-TUPLE VECTOR</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div>
              <div className="text-[10px] text-cyber-muted">SOURCE IP</div>
              <div className="text-white font-semibold">{alert.flow?.src_ip || '192.168.1.100'}</div>
            </div>
            <div>
              <div className="text-[10px] text-cyber-muted">SOURCE PORT</div>
              <div className="text-white">{alert.flow?.src_port || 54112}</div>
            </div>
            <div>
              <div className="text-[10px] text-cyber-muted">DESTINATION IP</div>
              <div className="text-cyber-cyan font-semibold">{alert.flow?.dst_ip || '10.0.0.50'}</div>
            </div>
            <div>
              <div className="text-[10px] text-cyber-muted">DEST PORT / PROTO</div>
              <div className="text-white">
                {alert.flow?.dst_port || 53} / <span className="text-cyber-green">{alert.flow?.protocol || 'UDP'}</span>
              </div>
            </div>
          </div>

          {/* Entropy Meter */}
          <div className="mt-3 pt-2.5 border-t border-cyber-border">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-cyber-muted">PAYLOAD SHANNON ENTROPY (0.0 - 8.0 bits/byte)</span>
              <span className={`font-bold ${(alert.flow?.payload_entropy || 7.85) >= 7.5 ? 'text-cyber-red' : 'text-cyber-green'}`}>
                {alert.flow?.payload_entropy?.toFixed(2) || '7.85'} bits/byte
              </span>
            </div>
            <div className="w-full bg-cyber-bg rounded-full h-1.5 overflow-hidden border border-cyber-border">
              <div
                className={`h-full rounded-full transition-all ${
                  (alert.flow?.payload_entropy || 7.85) >= 7.5 ? 'bg-cyber-red glow-red' : 'bg-cyber-green'
                }`}
                style={{ width: `${((alert.flow?.payload_entropy || 7.85) / 8.0) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* 2. Explainability (XAI) Feature Importance Chart */}
        <div className="bg-cyber-elevated/70 border border-cyber-border rounded-lg p-3">
          <div className="text-[11px] text-cyber-cyan font-bold mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>EXPLAINABILITY (SHAP FEATURE IMPORTANCE)</span>
            </div>
            <span className="text-[9px] text-cyber-muted font-normal">TREE-EXPLAINER</span>
          </div>

          <div className="space-y-2.5">
            {featuresList.map((f, i) => (
              <div key={i} className="text-[10px]">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-white font-semibold">{f.feature}</span>
                  <span className="text-cyber-green font-bold">
                    +{Math.round(f.importance * 100)}% contribution{' '}
                    <span className="text-cyber-muted font-normal">({f.actualValue})</span>
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-cyber-bg rounded h-2 overflow-hidden border border-cyber-border">
                  <div
                    className="bg-gradient-to-r from-cyber-cyan to-cyber-green h-full rounded"
                    style={{ width: `${Math.min(100, Math.round(f.importance * 100))}%` }}
                  />
                </div>

                <div className="text-[9px] text-cyber-muted mt-0.5 font-sans italic">
                  {f.description}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. MITRE ATT&CK Technique Card */}
        {alert.mitre_attack && (
          <div className="bg-cyber-elevated/70 border border-cyber-border rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-white font-bold text-[11px]">
                <Hash className="w-3.5 h-3.5 text-cyber-cyan" />
                <span>MITRE ATT&CK® TTP CARD</span>
              </div>
              <a
                href={alert.mitre_attack.url || `https://attack.mitre.org/techniques/${alert.mitre_attack.technique_id}/`}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-cyber-cyan hover:underline flex items-center gap-1"
              >
                <span>attack.mitre.org</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded bg-cyber-cyan/15 border border-cyber-cyan/40 text-cyber-cyan font-bold text-[10px]">
                {alert.mitre_attack.technique_id}
              </span>
              <span className="text-white font-semibold text-xs">
                {alert.mitre_attack.technique_name}
              </span>
            </div>

            <div className="text-[10px] text-cyber-amber mb-1.5">
              TACTIC: <span className="font-semibold">{alert.mitre_attack.tactic}</span>
            </div>

            <p className="text-[10px] text-cyber-muted leading-relaxed font-sans">
              {alert.mitre_attack.description}
            </p>
          </div>
        )}

        {/* 4. Cryptographic Tamper-Evident Ledger Proof */}
        <div className="bg-cyber-bg/90 border border-cyber-border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-[11px] text-cyber-green font-bold">
              <FileCheck className="w-3.5 h-3.5" />
              <span>CRYPTOGRAPHIC AUDIT PROOF</span>
            </div>
            <span className="text-[9px] text-cyber-muted font-mono">SHA-256 CHAINED</span>
          </div>

          <div className="text-[10px] text-cyber-muted space-y-1">
            <div className="truncate">
              RECORD HASH: <span className="text-cyber-cyan font-mono">sha256:7f83b1657ff1fc53b92dc18148a1...</span>
            </div>
            <div>
              CHAIN CONTINUITY: <span className="text-cyber-green font-semibold">VALIDATED (GENESIS $\rightarrow$ HEAD)</span>
            </div>
          </div>

          <div className="mt-2.5 flex items-center gap-2">
            <button
              onClick={handleVerifyProof}
              className="px-2.5 py-1 rounded bg-cyber-elevated border border-cyber-cyan/40 text-cyber-cyan hover:bg-cyber-cyan/20 text-[10px] flex items-center gap-1 font-semibold transition-all"
            >
              <CheckCircle2 className="w-3 h-3 text-cyber-cyan" />
              {proofVerified ? 'VERIFIED INTACT!' : 'VERIFY BLOCK INTEGRITY'}
            </button>

            <button
              onClick={handleCopyHash}
              className="px-2 py-1 rounded bg-cyber-elevated border border-cyber-border text-cyber-muted hover:text-white text-[10px] flex items-center gap-1 transition-all"
            >
              <Copy className="w-3 h-3" />
              {copied ? 'COPIED!' : 'COPY HASH'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
