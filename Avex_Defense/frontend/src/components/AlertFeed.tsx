import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Search, 
  Clock, 
  ArrowRight,
  CheckCircle,
  Hash
} from 'lucide-react';
import type { ThreatAlert, SeverityLevel } from '../types/soc';

interface AlertFeedProps {
  alerts: ThreatAlert[];
  selectedAlert: ThreatAlert | null;
  onSelectAlert: (alert: ThreatAlert) => void;
}

export const AlertFeed: React.FC<AlertFeedProps> = ({
  alerts,
  selectedAlert,
  onSelectAlert,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredAlerts = alerts.filter((alert) => {
    if (filterSeverity !== 'ALL' && alert.severity !== filterSeverity) {
      return false;
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchBehavior = alert.behavior_class.toLowerCase().includes(term);
      const matchIp = alert.flow?.src_ip.includes(term) || alert.flow?.dst_ip.includes(term);
      const matchTid = alert.mitre_attack?.technique_id.toLowerCase().includes(term);
      return matchBehavior || matchIp || matchTid;
    }
    return true;
  });

  const getSeverityBadgeClass = (sev: SeverityLevel) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-cyber-red/20 border-cyber-red text-cyber-red text-glow-red glow-red';
      case 'HIGH':
        return 'bg-orange-500/20 border-orange-500 text-orange-400';
      case 'MEDIUM':
        return 'bg-cyber-amber/20 border-cyber-amber text-cyber-amber';
      case 'LOW':
        return 'bg-cyber-cyan/20 border-cyber-cyan text-cyber-cyan';
      default:
        return 'bg-gray-800 border-gray-700 text-gray-300';
    }
  };

  const getCardBorderClass = (alert: ThreatAlert, isSelected: boolean) => {
    if (isSelected) {
      return 'border-cyber-cyan ring-1 ring-cyber-cyan shadow-[0_0_18px_rgba(0,240,255,0.4)] bg-cyber-elevated';
    }
    switch (alert.severity) {
      case 'CRITICAL':
        return 'border-cyber-red/60 hover:border-cyber-red bg-cyber-surface/90 hover:shadow-[0_0_15px_rgba(255,0,60,0.3)]';
      case 'HIGH':
        return 'border-orange-500/50 hover:border-orange-400 bg-cyber-surface/90';
      case 'MEDIUM':
        return 'border-cyber-amber/40 hover:border-cyber-amber bg-cyber-surface/90';
      case 'LOW':
        return 'border-cyber-border hover:border-cyber-cyan/60 bg-cyber-surface/90';
    }
  };

  return (
    <div className="flex flex-col h-full bg-cyber-surface border border-cyber-border rounded-xl overflow-hidden">
      {/* Feed Header */}
      <div className="p-4 border-b border-cyber-border bg-cyber-surface/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-cyber-red/20 border border-cyber-red/40 text-cyber-red">
              <ShieldAlert className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-mono tracking-wider text-white flex items-center gap-2">
                LIVE THREAT FEED
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyber-red/20 border border-cyber-red/50 text-cyber-red font-mono">
                  {filteredAlerts.length}
                </span>
              </h3>
            </div>
          </div>

          <div className="text-[10px] font-mono text-cyber-muted flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyber-green animate-ping"></span>
            WEBSOCKET STREAMING
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-2.5">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-cyber-muted" />
          <input
            type="text"
            placeholder="Filter by IP, TTP (e.g. T1046), or Behavior..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-cyber-bg border border-cyber-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-cyber-text placeholder:text-cyber-muted/60 focus:outline-none focus:border-cyber-cyan font-mono"
          />
        </div>

        {/* Severity Filter Tabs */}
        <div className="flex items-center gap-1.5 font-mono text-[11px] overflow-x-auto pb-1">
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
            <button
              key={s}
              onClick={() => setFilterSeverity(s)}
              className={`px-2.5 py-1 rounded border transition-all ${
                filterSeverity === s
                  ? 'bg-cyber-cyan/15 border-cyber-cyan text-cyber-cyan font-semibold glow-cyan/20'
                  : 'bg-cyber-bg/70 border-cyber-border text-cyber-muted hover:text-white hover:border-cyber-borderLight'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Alert Cards Scrolling Container */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[300px] max-h-[620px]">
        {filteredAlerts.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-6 border border-dashed border-cyber-border rounded-lg">
            <CheckCircle className="w-8 h-8 text-cyber-green/60 mb-2" />
            <p className="text-xs font-mono text-white font-medium">NO ACTIVE THREATS MATCHING FILTER</p>
            <p className="text-[11px] text-cyber-muted font-mono mt-1">
              Unidirectional IP diode traffic is currently operating within EWMA baseline bounds.
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const isSelected = selectedAlert?.id === alert.id;
            return (
              <div
                key={alert.id}
                onClick={() => onSelectAlert(alert)}
                className={`p-3 rounded-lg border transition-all cursor-pointer relative ${getCardBorderClass(
                  alert,
                  isSelected
                )} ${alert.isNew ? 'animate-alert-flash' : ''}`}
              >
                {/* Top Row: Severity + Threat Name + Time */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border uppercase tracking-wider ${getSeverityBadgeClass(
                        alert.severity
                      )}`}
                    >
                      {alert.severity}
                    </span>
                    <h4 className="text-xs font-semibold text-white font-mono leading-tight hover:text-cyber-cyan transition-colors">
                      {alert.behavior_class}
                    </h4>
                  </div>

                  <span className="text-[10px] font-mono text-cyber-muted whitespace-nowrap flex items-center gap-1">
                    <Clock className="w-3 h-3 text-cyber-muted" />
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {/* 5-Tuple Network Coordinates */}
                <div className="bg-cyber-bg/80 border border-cyber-border/60 rounded px-2.5 py-1.5 font-mono text-[11px] flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 text-cyber-text truncate">
                    <span className="text-cyber-cyan">{alert.flow?.src_ip || '192.168.1.100'}</span>
                    <span className="text-cyber-muted">:{alert.flow?.src_port || 54112}</span>
                    <ArrowRight className="w-3 h-3 text-cyber-muted flex-shrink-0" />
                    <span className="text-white font-medium">{alert.flow?.dst_ip || '10.0.0.50'}</span>
                    <span className="text-cyber-muted">:{alert.flow?.dst_port || 53}</span>
                  </div>

                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyber-elevated border border-cyber-border text-cyber-green font-semibold">
                    {alert.flow?.protocol || 'UDP'}
                  </span>
                </div>

                {/* Bottom Badges: MITRE TTP + Risk Score */}
                <div className="flex items-center justify-between text-[10px] font-mono">
                  {/* MITRE Technique */}
                  {alert.mitre_attack ? (
                    <div className="flex items-center gap-1 text-cyber-cyan bg-cyber-cyan/10 border border-cyber-cyan/30 px-2 py-0.5 rounded">
                      <Hash className="w-3 h-3" />
                      <span>{alert.mitre_attack.technique_id}</span>
                      <span className="text-cyber-muted">• {alert.mitre_attack.technique_name}</span>
                    </div>
                  ) : (
                    <span className="text-cyber-muted">T1048 Novel Anomaly</span>
                  )}

                  {/* Risk Score Pill */}
                  <div className="flex items-center gap-2">
                    <span className="text-cyber-muted">
                      Risk: <strong className="text-white font-bold">{alert.severity_score.toFixed(1)}</strong>
                    </span>
                    <span className="text-cyber-muted">
                      Conf: <strong className="text-cyber-green">{Math.round(alert.confidence * 100)}%</strong>
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
