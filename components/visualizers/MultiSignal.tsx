'use client';

import { useEffect, useRef } from 'react';

// 4 signal lines representing: Music, Heartbeat/Athletic, AI/Neural, Engineering
const SIGNALS = [
  {
    label: 'Music',
    color: 'rgba(0,217,255,0.8)',
    // Smooth sine — like a trance drop waveform
    fn: (x: number, t: number) => Math.sin(x * 0.04 + t * 2) * 0.7 + Math.sin(x * 0.08 + t * 3) * 0.3,
  },
  {
    label: 'Athletic',
    color: 'rgba(255,255,255,0.65)',
    // EKG-style: mostly flat with sharp spikes
    fn: (x: number, t: number) => {
      const phase = ((x * 0.02 + t * 1.8) % (Math.PI * 2));
      if (phase < 0.15) return Math.sin(phase * 20) * 1.2;
      if (phase > 0.8 && phase < 1.0) return -Math.sin((phase - 0.8) * 15) * 0.5;
      return Math.sin(x * 0.005) * 0.05;
    },
  },
  {
    label: 'AI',
    color: 'rgba(99,102,241,0.85)',
    // Noisy/chaotic — like gradient descent loss curve
    fn: (x: number, t: number) =>
      Math.sin(x * 0.06 + t) * 0.4 +
      Math.sin(x * 0.13 + t * 2.3) * 0.25 +
      Math.sin(x * 0.27 + t * 0.7) * 0.2 +
      Math.cos(x * 0.09 + t * 1.5) * 0.15,
  },
  {
    label: 'Engineering',
    color: 'rgba(0,217,255,0.4)',
    // Clean square wave — precise, systematic
    fn: (x: number, t: number) => {
      const v = Math.sin(x * 0.03 + t * 1.2);
      return v > 0.1 ? 0.75 : v < -0.1 ? -0.75 : v * 3;
    },
  },
];

export default function MultiSignal() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const rowH = H / SIGNALS.length;
    let t = 0;
    let rafId: number;

    const animate = () => {
      t += 0.022;
      ctx.fillStyle = 'rgba(10,14,39,1)';
      ctx.fillRect(0, 0, W, H);

      SIGNALS.forEach((sig, si) => {
        const midY = si * rowH + rowH / 2;
        const amp = rowH * 0.32;

        // Faint divider
        if (si > 0) {
          ctx.beginPath();
          ctx.moveTo(0, si * rowH);
          ctx.lineTo(W, si * rowH);
          ctx.strokeStyle = 'rgba(0,217,255,0.05)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Glow pass (thicker, low opacity)
        ctx.beginPath();
        for (let px = 0; px < W; px++) {
          const y = midY - sig.fn(px, t) * amp;
          px === 0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y);
        }
        ctx.strokeStyle = sig.color.replace(/[\d.]+\)$/, '0.15)');
        ctx.lineWidth = 6;
        ctx.stroke();

        // Main line
        ctx.beginPath();
        for (let px = 0; px < W; px++) {
          const y = midY - sig.fn(px, t) * amp;
          px === 0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y);
        }
        ctx.strokeStyle = sig.color;
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Scanning cursor — a vertical line that sweeps
        const cursorX = ((t * 60) % W);
        ctx.beginPath();
        ctx.moveTo(cursorX, si * rowH + 4);
        ctx.lineTo(cursorX, (si + 1) * rowH - 4);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Label tag on the left
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillStyle = sig.color.replace(/[\d.]+\)$/, '0.5)');
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(sig.label.toUpperCase(), 8, si * rowH + 5);
      });

      rafId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={700}
      height={180}
      className="w-full max-w-2xl rounded-lg"
      style={{
        border: '1px solid rgba(0,217,255,0.12)',
        filter: 'drop-shadow(0 0 20px rgba(0,217,255,0.12))',
      }}
    />
  );
}
