'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

export default function V1() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const LANE_COUNT = 9;

    const runners = Array.from({ length: LANE_COUNT }, (_, i) => {
      const speed = 1.4 + Math.random() * 2.2;
      return {
        x: Math.random() * window.innerWidth,
        speed,
        lane: i,
        trail: [] as { x: number }[],
        nodes: [0.18, 0.36, 0.55, 0.72, 0.88].map(frac => ({
          x: frac * window.innerWidth + (Math.random() - 0.5) * 60,
          triggered: false,
          branches: [] as { x1: number; y1: number; x2: number; y2: number; alpha: number }[],
          pulseR: 0,
        })),
      };
    });

    let rafId: number;

    const animate = () => {
      const W = canvas.width;
      const H = canvas.height;
      const laneH = H / LANE_COUNT;

      ctx.fillStyle = 'rgba(10,14,39,0.18)';
      ctx.fillRect(0, 0, W, H);

      // Lane dividers
      for (let i = 0; i <= LANE_COUNT; i++) {
        const y = i * laneH;
        ctx.beginPath();
        ctx.setLineDash([14, 20]);
        ctx.strokeStyle = i === 0 || i === LANE_COUNT
          ? 'rgba(0,217,255,0.18)'
          : 'rgba(0,217,255,0.05)';
        ctx.lineWidth = i === 0 || i === LANE_COUNT ? 1.5 : 1;
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      runners.forEach((r) => {
        const cy = r.lane * laneH + laneH / 2;
        r.x += r.speed;
        if (r.x > W + 80) {
          r.x = -60;
          r.trail = [];
          r.nodes.forEach(n => { n.triggered = false; n.branches = []; n.pulseR = 0; });
        }

        r.trail.push({ x: r.x });
        if (r.trail.length > 40) r.trail.shift();

        // Trail
        r.trail.forEach((pt, ti) => {
          const p = ti / r.trail.length;
          ctx.beginPath();
          ctx.arc(pt.x, cy, 2.2 * p, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,217,255,${p * 0.45})`;
          ctx.fill();
        });

        // Motion streak
        const tailLen = r.trail.length;
        if (tailLen > 6) {
          const g = ctx.createLinearGradient(r.trail[0].x, cy, r.x, cy);
          g.addColorStop(0, 'rgba(0,217,255,0)');
          g.addColorStop(1, 'rgba(0,217,255,0.3)');
          ctx.beginPath();
          ctx.moveTo(r.trail[0].x, cy);
          ctx.lineTo(r.x, cy);
          ctx.strokeStyle = g;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Runner glow
        const grd = ctx.createRadialGradient(r.x, cy, 0, r.x, cy, 14);
        grd.addColorStop(0, 'rgba(0,217,255,0.8)');
        grd.addColorStop(1, 'rgba(0,217,255,0)');
        ctx.beginPath();
        ctx.arc(r.x, cy, 14, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(r.x, cy, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();

        // Nodes
        r.nodes.forEach(node => {
          if (!node.triggered && Math.abs(r.x - node.x) < 10) {
            node.triggered = true;
            node.pulseR = 0;
            const count = 2 + Math.floor(Math.random() * 3);
            for (let b = 0; b < count; b++) {
              const goUp = b % 2 === 0;
              const horizLen = 15 + Math.random() * 50;
              const vertLen = (20 + Math.random() * 60) * (goUp ? -1 : 1);
              node.branches.push({
                x1: node.x, y1: cy,
                x2: node.x + horizLen, y2: cy + vertLen,
                alpha: 0.9,
              });
            }
          }
          if (node.triggered) {
            node.pulseR = Math.min(node.pulseR + 0.8, 22);
            ctx.beginPath();
            ctx.arc(node.x, cy, node.pulseR, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(99,102,241,${0.4 * (1 - node.pulseR / 22)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(node.x, cy, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#6366f1';
            ctx.fill();
            node.branches.forEach(br => {
              ctx.beginPath();
              ctx.moveTo(br.x1, br.y1);
              ctx.lineTo(br.x1, br.y2);
              ctx.lineTo(br.x2, br.y2);
              ctx.strokeStyle = `rgba(99,102,241,${br.alpha * 0.65})`;
              ctx.lineWidth = 1;
              ctx.stroke();
              ctx.beginPath();
              ctx.arc(br.x2, br.y2, 2.5, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(99,102,241,${br.alpha})`;
              ctx.fill();
              br.alpha = Math.max(0, br.alpha - 0.0015);
            });
          }
        });
      });

      rafId = requestAnimationFrame(animate);
    };

    animate();
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <section className="relative w-full min-h-screen overflow-hidden">
      {/* Full-screen canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Vignette overlay for text readability */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(10,14,39,0.7) 100%)' }} />

      {/* Text overlay — centered */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <p className="text-xs uppercase tracking-[0.3em] mb-6 font-medium"
          style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-body)' }}>
          Sprint · Circuit · Code
        </p>

        <h1 className="font-bold leading-none mb-5"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)', fontSize: 'clamp(3rem,8vw,7rem)', letterSpacing: '-0.03em' }}>
          Tanish Nahata
        </h1>

        <p className="font-medium mb-6"
          style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-body)', fontSize: 'clamp(0.75rem,1.5vw,1rem)', letterSpacing: '0.08em' }}>
          Software Engineer · AI Agent Builder · Electronic Music Lover · Athlete
        </p>

        <p className="mb-10 max-w-xl"
          style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', fontSize: 'clamp(0.75rem,1.2vw,0.9rem)', lineHeight: '1.9' }}>
          Engineer by discipline. Builder by obsession. I work on AI-powered systems—agents that reason, adapt, and scale.
          Hybrid athlete across tennis, golf, soccer, lifting, and running. Music lover. Firm believer that the best
          products—like the best sets—are engineered to make you feel something.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
          <Link href="#projects"
            className="px-10 py-3.5 rounded-lg font-semibold transition-all duration-300 hover:opacity-90 active:scale-95 w-full sm:w-auto text-center"
            style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-primary)', fontFamily: 'var(--font-body)', fontSize: '0.9rem', letterSpacing: '0.05em' }}>
            View My Work
          </Link>
          <Link href="#contact"
            className="px-10 py-3.5 rounded-lg font-semibold transition-all duration-300 active:scale-95 w-full sm:w-auto text-center"
            style={{ border: '2px solid var(--color-accent)', color: 'var(--color-accent)', fontFamily: 'var(--font-body)', fontSize: '0.9rem', letterSpacing: '0.05em' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--color-accent)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--color-accent)'; }}>
            Get In Touch
          </Link>
        </div>
      </div>
    </section>
  );
}
