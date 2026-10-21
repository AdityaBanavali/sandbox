import React from "react";
import { AlertTriangle, CheckCircle, Flame, ShieldAlert } from "lucide-react";
import { DemoFixture } from "../types";

interface PresetDemosProps {
  onSelectFixture: (fixture: DemoFixture) => void;
  getPresetFixture: (id: string) => DemoFixture | undefined;
  activeFixtureId?: string | null;
  disabled?: boolean;
}

export const PresetDemos: React.FC<PresetDemosProps> = ({
  onSelectFixture,
  getPresetFixture,
  activeFixtureId,
  disabled = false,
}) => {
  const presets = [
    {
      id: "pass_hotmix",
      title: "Pass: Hot-Mix Asphalt Compacted",
      subtitle: "Legitimate restoration (Score: ~92)",
      icon: CheckCircle,
      badge: "APPROVED",
      badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
      btnBorder: "hover:border-emerald-500",
      activeBg: "bg-emerald-50/70 border-emerald-500 shadow-sm",
    },
    {
      id: "incomplete_gravel",
      title: "Incomplete: Loose Dry Gravel Fill",
      subtitle: "Uncompacted rubble fill (Score: ~54)",
      icon: AlertTriangle,
      badge: "NEEDS REVIEW",
      badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
      btnBorder: "hover:border-amber-500",
      activeBg: "bg-amber-50/70 border-amber-500 shadow-sm",
    },
    {
      id: "fraud_gps_mismatch",
      title: "Fraud: Unmatched GPS / Different Location",
      subtitle: "Spoofed coordinate delta (Score: ~18)",
      icon: ShieldAlert,
      badge: "FRAUD DETECTED",
      badgeColor: "bg-rose-100 text-rose-800 border-rose-300",
      btnBorder: "hover:border-rose-500",
      activeBg: "bg-rose-50/70 border-rose-500 shadow-sm",
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 sm:p-5">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-saffron" />
          <h3 className="text-xs sm:text-sm font-bold text-navy-900 uppercase tracking-wide">
            One-Click Evaluation Presets (Instant Demo)
          </h3>
        </div>
        <span className="text-[11px] text-slate-500 hidden sm:inline">
          Renders pre-computed audit reports without re-upload
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {presets.map((preset) => {
          const Icon = preset.icon;
          const fixture = getPresetFixture(preset.id);
          const isSelected = activeFixtureId === preset.id;

          return (
            <button
              key={preset.id}
              type="button"
              disabled={disabled || !fixture}
              onClick={() => fixture && onSelectFixture(fixture)}
              className={`text-left p-3.5 rounded-lg border text-xs transition-all relative flex flex-col justify-between ${
                isSelected
                  ? preset.activeBg
                  : "bg-slate-50/80 border-slate-200 hover:bg-white " + preset.btnBorder
              } ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${preset.badgeColor}`}
                  >
                    <Icon className="w-3 h-3 flex-shrink-0" />
                    {preset.badge}
                  </span>
                  {isSelected && (
                    <span className="text-[10px] font-bold text-navy-900 uppercase tracking-wider">
                      Active
                    </span>
                  )}
                </div>
                <h4 className="font-bold text-slate-900 line-clamp-1">{preset.title}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{preset.subtitle}</p>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-200/60 text-[10px] font-semibold text-navy-700 flex items-center justify-between">
                <span>View Full Audit</span>
                <span>&rarr;</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
