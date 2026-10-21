import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, Bell, BellOff, Power, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { ActuatorData } from '../types';

interface ActuatorStatusProps {
  actuator?: ActuatorData;
  isConnected: boolean;
  onSendCommand: (path: string, body?: Record<string, unknown>) => Promise<boolean>;
  onLogEvent: (msg: string, type: 'INFO' | 'WARN' | 'CRITICAL' | 'COMMAND') => void;
}

export const ActuatorStatus: React.FC<ActuatorStatusProps> = ({
  actuator,
  isConnected,
  onSendCommand,
  onLogEvent
}) => {
  const [isPending, setIsPending] = useState(false);

  const barrierDeployed = actuator?.safety_barrier_deployed ?? false;
  const buzzerActive = actuator?.buzzer_state ?? false;

  const handleToggleBarrier = async () => {
    if (!isConnected) return;
    setIsPending(true);
    const targetState = !barrierDeployed;
    onLogEvent(
      `MANUAL COMMAND: Requesting safety barrier ${targetState ? 'DEPLOYMENT' : 'RETRACTION'}`,
      'COMMAND'
    );

    const success = await onSendCommand('/actuator/barrier', { deployed: targetState });
    setIsPending(false);

    if (success) {
      onLogEvent(`Actuator ACK: Safety barrier command confirmed.`, 'INFO');
    } else {
      onLogEvent(`Actuator FAIL: Timeout or unreachable edge solenoid.`, 'CRITICAL');
    }
  };

  const handleToggleBuzzer = async () => {
    if (!isConnected) return;
    setIsPending(true);
    const targetState = !buzzerActive;
    onLogEvent(
      `MANUAL COMMAND: Hardware buzzer alarm ${targetState ? 'ENGAGED' : 'MUTED'}`,
      'COMMAND'
    );

    const success = await onSendCommand('/actuator/buzzer', { state: targetState });
    setIsPending(false);

    if (success) {
      onLogEvent(`Actuator ACK: Buzzer state updated.`, 'INFO');
    } else {
      onLogEvent(`Actuator FAIL: Command rejected.`, 'WARN');
    }
  };

  return (
    <div className="bg-[#0B0D13] border border-[#1F2430] rounded p-4 flex flex-col justify-between shadow-lg">
      <div className="flex items-center justify-between border-b border-[#1F2430] pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <h3 className="text-xs font-mono font-semibold tracking-wider text-slate-200 uppercase">
            SAFETY ACTUATOR // HARDWARE TRIP INTERFACE
          </h3>
        </div>

        {/* Hardware Limit-Switch Indicator Pill */}
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-mono border font-semibold transition-colors ${
            !isConnected
              ? 'bg-slate-900 border-slate-800 text-slate-600'
              : barrierDeployed
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
              : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
          }`}
        >
          LIMIT-SW: LATCHED
        </span>
      </div>

      {/* Actuator States */}
      <div className="grid grid-cols-2 gap-3 mb-3 font-mono">
        {/* Safety Barrier Gate */}
        <div
          className={`p-3 rounded border flex flex-col justify-between gap-2 transition-colors ${
            !isConnected
              ? 'bg-[#07090F] border-[#1F2430] text-slate-500'
              : barrierDeployed
              ? 'bg-rose-500/15 border-rose-500/50 text-rose-300'
              : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-medium text-slate-400">
              PHYSICAL BARRIER
            </span>
            {barrierDeployed ? (
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            )}
          </div>
          <div>
            <span className="text-xs font-bold tracking-wide">
              {isConnected
                ? barrierDeployed
                  ? 'BARRIER: DEPLOYED // ENGAGED'
                  : 'BARRIER: RETRACTED // READY'
                : 'OFFLINE'}
            </span>
            <span className="text-[10px] block opacity-75 mt-0.5">
              {barrierDeployed ? 'SOLENOID FIRED' : 'FAIL-SAFE ARMED'}
            </span>
          </div>
        </div>

        {/* Acoustic Buzzer Alarm */}
        <div
          className={`p-3 rounded border flex flex-col justify-between gap-2 transition-colors ${
            !isConnected
              ? 'bg-[#07090F] border-[#1F2430] text-slate-500'
              : buzzerActive
              ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
              : 'bg-[#07090F] border-[#1F2430] text-slate-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-medium text-slate-400">
              PIEZO ACOUSTIC ALARM
            </span>
            {buzzerActive ? (
              <Bell className="w-4 h-4 text-amber-400 animate-bounce" />
            ) : (
              <BellOff className="w-4 h-4 text-slate-600" />
            )}
          </div>
          <div>
            <span className="text-xs font-bold tracking-wide">
              {isConnected ? (buzzerActive ? 'AUDIBLE SIREN ACTIVE' : 'MUTED // SILENT') : 'OFFLINE'}
            </span>
            <span className="text-[10px] block opacity-75 mt-0.5">
              {buzzerActive ? '105 dB TRIP PULSE' : 'STANDBY'}
            </span>
          </div>
        </div>
      </div>

      {/* Manual Actuator Commands */}
      <div className="border-t border-[#1F2430] pt-2.5 flex items-center justify-between gap-2 font-mono text-xs">
        <button
          onClick={handleToggleBarrier}
          disabled={!isConnected || isPending}
          className={`flex-1 py-2 px-3 rounded text-[11px] font-semibold tracking-wider uppercase transition flex items-center justify-center gap-1.5 border ${
            !isConnected
              ? 'bg-[#07090F] border-[#1F2430] text-slate-600 cursor-not-allowed'
              : barrierDeployed
              ? 'bg-rose-500/25 hover:bg-rose-500/35 border-rose-500 text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
              : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/50 text-amber-300'
          }`}
        >
          {isPending ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Power className="w-3.5 h-3.5" />
          )}
          <span>
            {barrierDeployed ? 'RESET / RETRACT BARRIER' : 'DEPLOY EMERGENCY BARRIER'}
          </span>
        </button>

        <button
          onClick={handleToggleBuzzer}
          disabled={!isConnected || isPending}
          className={`py-2 px-3 rounded text-[11px] font-semibold tracking-wider uppercase transition flex items-center justify-center gap-1.5 border ${
            !isConnected
              ? 'bg-[#07090F] border-[#1F2430] text-slate-600 cursor-not-allowed'
              : buzzerActive
              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
              : 'bg-[#141824] hover:bg-[#1C2234] border-[#1F2430] text-slate-300'
          }`}
        >
          <span>{buzzerActive ? 'MUTE SIREN' : 'TEST SIREN'}</span>
        </button>
      </div>
    </div>
  );
};
