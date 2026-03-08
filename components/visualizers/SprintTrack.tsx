'use client';

import { useEffect, useRef } from 'react';

export default function SprintTrack() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const LANES = 5;
    const laneH = H / LANES;

    // Each runner: position, speed, trail
    const runners = Array.from({ length: LANES }, (_, i) => ({
      x: Math.random() * W * 0.5,
      speed: 1.8 + i * 0.4 + Math.random() * 0.6,
      lane: i,
      trail: [] as { x: number; a: number }[],
      // Circuit nodes this runner has passed through
      nodes: [W * 0.25, W * 0.5, W * 0.72, W * 0.88].map(nx => ({
        x: nx + (Math.random() - 0.5) * 20,
        triggered: false,
        branches: [] as { x1: number; y1: number; x2: number; y2: number; a: number }[],
      })),
    }));

    let rafId: number;

    const drawLaneLines = () => {
      for (let i = 0; i <= LANES; i++) {
        const y = i * laneH;
        ctx.beginPath();
        ctx.setLineDash([12, 16]);
        ctx.strokeStyle = i === 0 || i === LANES
          ? 'rgba(0,217,255,0.25)'
          : 'rgba(0,217,255,0.08)';
        ctx.lineWidth = i === 0 || i === LANES ? 1.5 : 1;
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    };

    const animate = () => {
      // Fade trail
      ctx.fillStyle = 'rgba(10,14,39,0.18)';
      ctx.fillRect(0, 0, W, H);

      drawLaneLines();

      runners.forEach((r) => {
        const cy = r.lane * laneH + laneH / 2;

        // Move
        r.x += r.speed;
        if (r.x > W + 60) {
          r.x = -40;
          r.trail = [];
          r.nodes.forEach(n => { n.triggered = false; n.branches = []; });
        }

        // Trail
        r.trail.push({ x: r.x, a: 1 });
        if (r.trail.length > 28) r.trail.shift();

        // Draw trail
        r.trail.forEach((pt, ti) => {
          const progress = ti / r.trail.length;
          ctx.beginPath();
          ctx.arc(pt.x, cy, 2.5 * progress, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,217,255,${progress * 0.6})`;
          ctx.fill();
        });

        // Motion blur lines
        if (r.trail.length > 3) {
          const last = r.trail[r.trail.length - 1];
          const prev = r.trail[Math.max(0, r.trail.length - 8)];
          ctx.beginPath();
          ctx.moveTo(prev.x, cy);
          ctx.lineTo(last.x, cy);
          ctx.strokeStyle = `rgba(0,217,255,0.35)`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Runner dot (head)
        const glow = ctx.createRadialGradient(r.x, cy, 0, r.x, cy, 10);
        glow.addColorStop(0, 'rgba(0,217,255,0.9)');
        glow.addColorStop(1, 'rgba(0,217,255,0)');
        ctx.beginPath();
        ctx.arc(r.x, cy, 10, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(r.x, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();

        // Circuit node triggers
        r.nodes.forEach(node => {
          if (!node.triggered && Math.abs(r.x - node.x) < 8) {
            node.triggered = true;
            // Spawn 2-3 branch lines upward/downward from node
            const numBranches = 2 + Math.floor(Math.random() * 2);
            for (let b = 0; b < numBranches; b++) {
              const angle = (Math.random() - 0.5) * Math.PI * 0.8;
              const len = 20 + Math.random() * 35;
              node.branches.push({
                x1: node.x, y1: cy,
                x2: node.x + Math.cos(angle) * len,
                y2: cy + Math.sin(angle) * len,
                a: 1,
              });
            }
          }

          if (node.triggered) {
            // Draw circuit node
            ctx.beginPath();
            ctx.arc(node.x, cy, 4, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(99,102,241,0.9)`;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(node.x, cy, 8, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(99,102,241,0.3)`;
            ctx.lineWidth = 1;
            ctx.stroke();

            // Draw branches
            node.branches.forEach(br => {
              ctx.beginPath();
              ctx.moveTo(br.x1, br.y1);
              // Right-angle circuit style
              ctx.lineTo(br.x1, br.y2);
              ctx.lineTo(br.x2, br.y2);
              ctx.strokeStyle = `rgba(99,102,241,${br.a * 0.7})`;
              ctx.lineWidth = 1;
              ctx.stroke();

              // Terminal dot
              ctx.beginPath();
              ctx.arc(br.x2, br.y2, 2, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(99,102,241,${br.a})`;
              ctx.fill();

              br.a = Math.max(0, br.a - 0.002);
            });
          }
        });
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
      height={160}
      className="w-full max-w-2xl rounded-lg"
      style={{
        border: '1px solid rgba(0,217,255,0.15)',
        background: 'rgba(10,14,39,0.8)',
        filter: 'drop-shadow(0 0 24px rgba(0,217,255,0.1))',
      }}
    />
  );
}
