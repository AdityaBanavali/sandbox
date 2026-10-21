import React from "react";
import { Landmark, ShieldCheck } from "lucide-react";

export const Navbar: React.FC = () => {
  return (
    <header className="bg-navy-900 text-white shadow-md border-b-4 border-saffron">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="bg-white/10 p-2 sm:p-2.5 rounded-lg border border-white/20 text-saffron flex items-center justify-center shadow-inner">
              <Landmark className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base sm:text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                  CivicFix AI
                  <span className="text-saffron-light font-normal text-xs sm:text-sm tracking-normal">
                    : Proof-of-Fix Verification
                  </span>
                </h1>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 font-medium">
                Bruhat Bengaluru Mahanagara Palike Audit Console (Prototype)
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              Automated Fraud Prevention
            </span>
            <div className="text-right pl-2 border-l border-white/15 hidden sm:block">
              <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">
                BBMP e-Governance
              </span>
              <span className="text-xs text-slate-200 font-medium">Govt. of Karnataka</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
