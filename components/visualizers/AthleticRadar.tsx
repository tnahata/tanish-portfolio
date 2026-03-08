'use client';

import { useEffect, useRef } from 'react';

const AXES = [
  { label: 'AI Agents',   color: '#00d9ff' },
  { label: 'Full Stack',  color: '#00d9ff' },
  { label: 'Running',     color: '#6366f1' },
  { label: 'Tennis',      color: '#6366f1' },
  { label: 'Lifting',     color: '#6366f1' },
  { label: 'Golf',        color: '#6366f1' },
];

export default function AthleticRadar() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) * 0.36;
    const N = AXES.length;
    const rings = 4;

    // Base values + pulse targets per axis
    const base = [0.92, 0.85, 0.78, 0.82, 0.75, 0.70];
    const values = [...base];
    const targets = [...base];
    let t = 0;

    let rafId: number;

    const getPoint = (i: number, r: number) => {
      const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
      return {
        x: cx + Math.cos(angle) * r * R,
        y: cy + Math.sin(angle) * r * R,
      };
    };

    const animate = () => {
      t += 0.012;
      ctx.clearRect(0, 0, W, H);

      // Background fill
      ctx.fillStyle = 'rgba(10,14,39,0.0)';
      ctx.fillRect(0, 0, W, H);

      // Slowly shift targets
      values.forEach((_, i) => {
        if (Math.random() < 0.01) {
          targets[i] = base[i] + (Math.random() - 0.5) * 0.18;
          targets[i] = Math.max(0.4, Math.min(1, targets[i]));
        }
        values[i] += (targets[i] - values[i]) * 0.02;
      });

      // Ring grid
      for (let ring = 1; ring <= rings; ring++) {
        const r = ring / rings;
        ctx.beginPath();
        for (let i = 0; i < N; i++) {
          const p = getPoint(i, r);
          i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.strokeStyle = 'rgba(0,217,255,0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Axis spokes
      for (let i = 0; i < N; i++) {
        const p = getPoint(i, 1);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = 'rgba(0,217,255,0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Filled radar shape — outer glow layer
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const v = values[i] + Math.sin(t + i * 1.1) * 0.03;
        const p = getPoint(i, v);
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      grad.addColorStop(0, 'rgba(99,102,241,0.35)');
      grad.addColorStop(0.5, 'rgba(0,217,255,0.2)');
      grad.addColorStop(1, 'rgba(0,217,255,0.05)');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,217,255,0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Axis endpoint dots + subtle pulse rings
      for (let i = 0; i < N; i++) {
        const v = values[i] + Math.sin(t + i * 1.1) * 0.03;
        const p = getPoint(i, v);

        // Pulse ring
        const pulse = 0.5 + 0.5 * Math.sin(t * 2 + i);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6 + pulse * 4, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,217,255,${0.15 * pulse})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = i < 2 ? '#00d9ff' : '#6366f1';
        ctx.fill();

        // Label
        const labelP = getPoint(i, 1.22);
        ctx.font = '10px "Space Grotesk", sans-serif';
        ctx.fillStyle = 'rgba(245,245,245,0.55)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(AXES[i].label, labelP.x, labelP.y);
      }

      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,217,255,0.6)';
      ctx.fill();

      rafId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={380}
      height={300}
      className="w-full max-w-sm"
      style={{
        filter: 'drop-shadow(0 0 32px rgba(99,102,241,0.2))',
      }}
    />
  );
}
