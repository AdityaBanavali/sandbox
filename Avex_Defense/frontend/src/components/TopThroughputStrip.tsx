import React, { useEffect, useRef, useState } from 'react';
import { Activity } from 'lucide-react';
import type { ThroughputMetric } from '../types/soc';

interface TopThroughputStripProps {
  threatPulseCount: number;
}

export const TopThroughputStrip: React.FC<TopThroughputStripProps> = ({ threatPulseCount }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [metrics, setMetrics] = useState<ThroughputMetric[]>([]);
  const [currentPps, setCurrentPps] = useState(2450);
  const [currentKbps, setCurrentKbps] = useState(1820);
  const [peakPps, setPeakPps] = useState(4890);

  // Maintain rolling telemetry window (60 data points)
  useEffect(() => {
    // Seed initial points
    const initial: ThroughputMetric[] = [];
    const now = Date.now();
    for (let i = 59; i >= 0; i--) {
      initial.push({
        time: new Date(now - i * 1000).toLocaleTimeString(),
        packetsPerSec: 2100 + Math.sin(i * 0.3) * 400 + Math.random() * 200,
        bytesPerSec: 1600 + Math.cos(i * 0.2) * 300 + Math.random() * 150,
        threatsPerSec: 0,
      });
    }
    setMetrics(initial);

    const interval = setInterval(() => {
      setMetrics((prev) => {
        // Inject burst if threat pulse triggered
        const isSpike = threatPulseCount > 0 && Math.random() > 0.6;
        const ppsBase = 2200 + Math.sin(Date.now() / 3000) * 500;
        const newPps = Math.round(ppsBase + (isSpike ? 2400 : Math.random() * 300));
        const newKbps = Math.round(newPps * 0.78 + Math.random() * 150);

        setCurrentPps(newPps);
        setCurrentKbps(newKbps);
        setPeakPps((curr) => Math.max(curr, newPps));

        const nextPoint: ThroughputMetric = {
          time: new Date().toLocaleTimeString(),
          packetsPerSec: newPps,
          bytesPerSec: newKbps,
          threatsPerSec: isSpike ? 1 : 0,
        };

        return [...prev.slice(1), nextPoint];
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [threatPulseCount]);

  // High-performance canvas waveform rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || metrics.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    ctx.clearRect(0, 0, width, height);

    // Draw cyber grid lines
    ctx.strokeStyle = 'rgba(31, 44, 63, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = 15; y < height; y += 25) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    const maxVal = Math.max(...metrics.map((m) => m.packetsPerSec), 5000);
    const stepX = width / (metrics.length - 1);

    // Helper to draw filled area and stroke
    const drawWave = (
      values: number[],
      strokeColor: string,
      fillGradTop: string,
      fillGradBottom: string,
      glowColor: string
    ) => {
      ctx.beginPath();
      ctx.moveTo(0, height);

      values.forEach((v, idx) => {
        const x = idx * stepX;
        const normalizedY = height - (v / maxVal) * (height - 20) - 10;
        if (idx === 0) {
          ctx.lineTo(x, normalizedY);
        } else {
          // Smooth bezier curve
          const prevX = (idx - 1) * stepX;
          const prevY = height - (values[idx - 1] / maxVal) * (height - 20) - 10;
          const cpX = (prevX + x) / 2;
          ctx.bezierCurveTo(cpX, prevY, cpX, normalizedY, x, normalizedY);
        }
      });

      ctx.lineTo(width, height);
      ctx.closePath();

      // Fill area gradient
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, fillGradTop);
      grad.addColorStop(1, fillGradBottom);
      ctx.fillStyle = grad;
      ctx.fill();

      // Stroke Line
      ctx.beginPath();
      values.forEach((v, idx) => {
        const x = idx * stepX;
        const normalizedY = height - (v / maxVal) * (height - 20) - 10;
        if (idx === 0) {
          ctx.moveTo(x, normalizedY);
        } else {
          const prevX = (idx - 1) * stepX;
          const prevY = height - (values[idx - 1] / maxVal) * (height - 20) - 10;
          const cpX = (prevX + x) / 2;
          ctx.bezierCurveTo(cpX, prevY, cpX, normalizedY, x, normalizedY);
        }
      });

      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0; // Reset
    };

    // Draw Bytes/sec waveform (Cyber Green)
    drawWave(
      metrics.map((m) => m.bytesPerSec * 1.5),
      '#00ff88',
      'rgba(0, 255, 136, 0.25)',
      'rgba(0, 255, 136, 0.0)',
      'rgba(0, 255, 136, 0.8)'
    );

    // Draw Packets/sec waveform (Neon Cyan)
    drawWave(
      metrics.map((m) => m.packetsPerSec),
      '#00f0ff',
      'rgba(0, 240, 255, 0.35)',
      'rgba(0, 240, 255, 0.02)',
      'rgba(0, 240, 255, 0.9)'
    );

    // Draw pulsing pulse dot at current head
    const lastPps = metrics[metrics.length - 1].packetsPerSec;
    const lastY = height - (lastPps / maxVal) * (height - 20) - 10;
    ctx.beginPath();
    ctx.arc(width - 2, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
  }, [metrics]);

  return (
    <div className="bg-cyber-surface border border-cyber-border rounded-xl p-4 glow-cyan/10">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
        {/* Title and live badge */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyber-elevated border border-cyber-border text-cyber-cyan">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold font-mono tracking-wider text-white">
                LIVE TRAFFIC THROUGHPUT & OPTICAL DIODE DENSITY
              </h2>
              <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-cyber-green/10 border border-cyber-green/30 text-cyber-green">
                <span className="w-1.5 h-1.5 rounded-full bg-cyber-green animate-ping"></span>
                REAL-TIME SAMPLING (1 Hz)
              </span>
            </div>
            <p className="text-xs text-cyber-muted font-mono">
              Unidirectional physical ingress tap • Rolling 60s window • Zero return path
            </p>
          </div>
        </div>

        {/* Real-time counters strip */}
        <div className="flex items-center gap-6 font-mono text-right">
          {/* Packets per Second */}
          <div>
            <div className="text-[10px] text-cyber-muted flex items-center justify-end gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-cyber-cyan"></span>
              PACKET RATE (PPS)
            </div>
            <div className="text-lg font-bold text-cyber-cyan text-glow-cyan">
              {currentPps.toLocaleString()} <span className="text-xs font-normal text-cyber-muted">pkts/s</span>
            </div>
          </div>

          {/* Bandwidth Throughput */}
          <div className="border-l border-cyber-border pl-6">
            <div className="text-[10px] text-cyber-muted flex items-center justify-end gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-cyber-green"></span>
              BANDWIDTH VELOCITY
            </div>
            <div className="text-lg font-bold text-cyber-green text-glow-green">
              {(currentKbps / 1024).toFixed(2)} <span className="text-xs font-normal text-cyber-muted">MB/s</span>
            </div>
          </div>

          {/* Peak Speed */}
          <div className="hidden sm:block border-l border-cyber-border pl-6">
            <div className="text-[10px] text-cyber-muted">PEAK TRAFFIC BURST</div>
            <div className="text-sm font-semibold text-white">
              {peakPps.toLocaleString()} <span className="text-xs font-normal text-cyber-muted">pkts/s</span>
            </div>
          </div>

          {/* Loss / Drop Ratio */}
          <div className="hidden md:block border-l border-cyber-border pl-6">
            <div className="text-[10px] text-cyber-muted">PACKET LOSS</div>
            <div className="text-sm font-semibold text-cyber-green">
              0.00% <span className="text-[10px] text-cyber-muted font-normal">(LOSSLESS)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Canvas Waveform Display */}
      <div className="relative w-full h-24 sm:h-28 rounded-lg overflow-hidden bg-cyber-bg/80 border border-cyber-border/80">
        <canvas ref={canvasRef} className="w-full h-full block" />
        
        {/* Overlay Legends */}
        <div className="absolute bottom-2 left-3 flex items-center gap-4 text-[10px] font-mono bg-cyber-surface/90 border border-cyber-border rounded px-2.5 py-1 backdrop-blur pointer-events-none">
          <div className="flex items-center gap-1.5 text-cyber-cyan">
            <span className="w-3 h-0.5 bg-cyber-cyan rounded"></span>
            <span>Packets / Sec</span>
          </div>
          <div className="flex items-center gap-1.5 text-cyber-green">
            <span className="w-3 h-0.5 bg-cyber-green rounded"></span>
            <span>Bytes Throughput (x1.5 scale)</span>
          </div>
          <div className="flex items-center gap-1 text-cyber-muted">
            <span>EWMA Baseline: Stable</span>
          </div>
        </div>
      </div>
    </div>
  );
};
