import React, { useMemo } from 'react';
import { LayoutGrid, Flame, ExternalLink, Info, X } from 'lucide-react';
import { INITIAL_MITRE_TAXONOMY } from '../data/mitreTactics';
import type { ThreatAlert } from '../types/soc';

interface MitreMatrixHeatmapProps {
  alerts: ThreatAlert[];
  selectedTechniqueId: string | null;
  onSelectTechnique: (techniqueId: string | null) => void;
}

export const MitreMatrixHeatmap: React.FC<MitreMatrixHeatmapProps> = ({
  alerts,
  selectedTechniqueId,
  onSelectTechnique,
}) => {
  // Aggregate hit counts per technique from live alerts
  const techniqueHits = useMemo(() => {
    const hits: Record<string, { count: number; maxSeverity: string; latestTime: string }> = {};

    alerts.forEach((alert) => {
      const tid = alert.mitre_attack?.technique_id;
      if (!tid) return;

      if (!hits[tid]) {
        hits[tid] = { count: 0, maxSeverity: alert.severity, latestTime: alert.timestamp };
      }
      hits[tid].count += 1;
      // Escalate max severity if critical
      if (alert.severity === 'CRITICAL') {
        hits[tid].maxSeverity = 'CRITICAL';
      }
    });

    return hits;
  }, [alerts]);

  const totalActiveTriggered = Object.keys(techniqueHits).length;

  return (
    <div className="flex flex-col h-full bg-cyber-surface border border-cyber-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-cyber-border bg-cyber-surface/95 backdrop-blur flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-cyber-cyan/20 border border-cyber-cyan/40 text-cyber-cyan">
            <LayoutGrid className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold font-mono tracking-wider text-white">
                MITRE ATT&CK® MATRIX HEATMAP
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyber-red/20 border border-cyber-red/50 text-cyber-red font-semibold flex items-center gap-1">
                <Flame className="w-3 h-3 animate-bounce" />
                {totalActiveTriggered} TECHNIQUES LIT UP
              </span>
            </div>
            <p className="text-xs text-cyber-muted font-mono">
              Unidirectional IP attack surface • Cells illuminate in red upon active threat detection
            </p>
          </div>
        </div>

        {/* Filter State / Clear button */}
        {selectedTechniqueId && (
          <div className="flex items-center gap-2 bg-cyber-elevated border border-cyber-cyan/60 rounded px-2.5 py-1 text-xs font-mono">
            <span className="text-cyber-muted">FILTERED:</span>
            <span className="text-cyber-cyan font-bold">{selectedTechniqueId}</span>
            <button
              onClick={() => onSelectTechnique(null)}
              className="text-cyber-muted hover:text-white ml-1 p-0.5"
              title="Clear filter"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Interactive Matrix Columns Grid */}
      <div className="flex-1 overflow-x-auto overflow-y-auto p-4 min-h-[300px] max-h-[620px]">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 min-w-[700px]">
          {INITIAL_MITRE_TAXONOMY.map((col) => (
            <div key={col.tacticName} className="flex flex-col gap-2">
              {/* Tactic Column Header */}
              <div className="bg-cyber-elevated/90 border border-cyber-border rounded-lg p-2.5 text-center font-mono">
                <div className="text-[11px] font-bold text-white uppercase tracking-wider truncate">
                  {col.displayName}
                </div>
                <div className="text-[10px] text-cyber-muted mt-0.5">
                  {col.techniques.length} Techniques
                </div>
              </div>

              {/* Technique Cells List */}
              <div className="flex flex-col gap-2">
                {col.techniques.map((tech) => {
                  const hitInfo = techniqueHits[tech.technique_id];
                  const isHit = Boolean(hitInfo && hitInfo.count > 0);
                  const isSelected = selectedTechniqueId === tech.technique_id;

                  return (
                    <div
                      key={tech.technique_id}
                      onClick={() => onSelectTechnique(isSelected ? null : tech.technique_id)}
                      className={`p-2.5 rounded-lg border transition-all cursor-pointer relative group flex flex-col justify-between min-h-[92px] ${
                        isSelected
                          ? 'border-cyber-cyan bg-cyber-cyan/20 ring-2 ring-cyber-cyan glow-cyan'
                          : isHit
                          ? hitInfo?.maxSeverity === 'CRITICAL'
                            ? 'bg-cyber-red/25 border-cyber-red text-white shadow-[0_0_20px_rgba(255,0,60,0.55)] animate-pulse'
                            : 'bg-orange-600/25 border-orange-500 text-white shadow-[0_0_15px_rgba(255,140,0,0.4)]'
                          : 'bg-cyber-bg/80 border-cyber-border/80 hover:border-cyber-borderLight hover:bg-cyber-elevated text-cyber-muted hover:text-white'
                      }`}
                    >
                      {/* Top: Technique ID & Hit Badge */}
                      <div className="flex items-center justify-between gap-1.5 mb-1.5">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/40 border border-white/10 text-white">
                          {tech.technique_id}
                        </span>

                        {isHit && (
                          <span className="flex items-center gap-1 text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-cyber-red border border-cyber-red text-white glow-red">
                            <Flame className="w-2.5 h-2.5 animate-bounce" />
                            {hitInfo.count} {hitInfo.count === 1 ? 'HIT' : 'HITS'}
                          </span>
                        )}
                      </div>

                      {/* Middle: Technique Name */}
                      <div className="text-xs font-semibold font-mono leading-snug line-clamp-2 text-white">
                        {tech.technique_name}
                      </div>

                      {/* Bottom Description preview or status */}
                      <div className="mt-1.5 text-[10px] font-mono flex items-center justify-between text-cyber-muted">
                        <span className="truncate max-w-[120px]">
                          {tech.subtechnique_id ? tech.subtechnique_id : tech.tactic_name}
                        </span>
                        <Info className="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity" />
                      </div>

                      {/* Tooltip on Hover */}
                      <div className="absolute left-1/2 -bottom-2 transform -translate-x-1/2 translate-y-full w-64 bg-cyber-bg/95 border border-cyber-border rounded-lg p-3 text-left shadow-2xl backdrop-blur z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono font-bold text-cyber-cyan">
                            {tech.technique_id} • {tech.tactic_name}
                          </span>
                          {isHit && (
                            <span className="text-[9px] font-mono bg-cyber-red/30 text-cyber-red px-1 rounded">
                              ACTIVE HIT
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-white font-mono font-semibold mb-1">
                          {tech.technique_name}
                        </p>
                        <p className="text-[10px] text-cyber-muted leading-relaxed font-sans">
                          {tech.description}
                        </p>
                        <div className="mt-2 pt-1.5 border-t border-cyber-border text-[9px] font-mono text-cyber-cyan flex items-center gap-1">
                          <span>Click cell to filter alerts</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
