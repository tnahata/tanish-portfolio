'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import About from '@/components/About';
import Projects from '@/components/Projects';

const AXES = [
  { label: 'AI Agents' },
  { label: 'Full Stack' },
  { label: 'Running' },
  { label: 'Tennis' },
  { label: 'Lifting' },
  { label: 'Golf' },
  { label: 'Soccer' },
  { label: 'Systems' },
];

export default function Home() {
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

    const N = AXES.length;
    const base = [0.88, 0.82, 0.78, 0.84, 0.76, 0.72, 0.80, 0.90];
    const values = [...base];
    const targets = [...base];
    let t = 0;
    let rafId: number;

    const getPoint = (i: number, r: number, cx: number, cy: number, R: number) => {
      const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
      return { x: cx + Math.cos(angle) * r * R, y: cy + Math.sin(angle) * r * R };
    };

    const animate = () => {
      const W = canvas.width;
      const H = canvas.height;
      const cx = W / 2;
      const cy = H / 2;
      const R = Math.min(W, H) * 0.38;

      t += 0.008;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(10,14,39,0.92)';
      ctx.fillRect(0, 0, W, H);

      values.forEach((_, i) => {
        if (Math.random() < 0.008) {
          targets[i] = base[i] + (Math.random() - 0.5) * 0.2;
          targets[i] = Math.max(0.45, Math.min(1, targets[i]));
        }
        values[i] += (targets[i] - values[i]) * 0.015;
      });

      // Background rings
      for (let ring = 1; ring <= 5; ring++) {
        const r = ring / 5;
        ctx.beginPath();
        for (let i = 0; i < N; i++) {
          const p = getPoint(i, r, cx, cy, R);
          i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.strokeStyle = `rgba(0,217,255,${0.04 + ring * 0.015})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Spokes
      for (let i = 0; i < N; i++) {
        const p = getPoint(i, 1, cx, cy, R);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = 'rgba(0,217,255,0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Outer ghost shape
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const p = getPoint(i, 1, cx, cy, R);
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(0,217,255,0.06)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Animated fill
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const v = values[i] + Math.sin(t * 1.2 + i * 0.9) * 0.025;
        const p = getPoint(i, v, cx, cy, R);
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      grad.addColorStop(0, 'rgba(99,102,241,0.3)');
      grad.addColorStop(0.5, 'rgba(0,217,255,0.18)');
      grad.addColorStop(1, 'rgba(0,217,255,0.04)');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,217,255,0.75)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Axis dots + pulse + labels
      for (let i = 0; i < N; i++) {
        const v = values[i] + Math.sin(t * 1.2 + i * 0.9) * 0.025;
        const p = getPoint(i, v, cx, cy, R);
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.5 + i * 1.3);

        ctx.beginPath();
        ctx.arc(p.x, p.y, 8 + pulse * 6, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,217,255,${0.12 * pulse})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = i < 2 || i === 7 ? '#00d9ff' : '#6366f1';
        ctx.fill();

        const lp = getPoint(i, 1.18, cx, cy, R);
        ctx.font = `11px "Space Grotesk", sans-serif`;
        ctx.fillStyle = 'rgba(245,245,245,0.45)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(AXES[i].label, lp.x, lp.y);
      }

      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,217,255,0.7)';
      ctx.fill();

      rafId = requestAnimationFrame(animate);
    };

    animate();
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <>
    <section className="relative w-full min-h-screen overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 55% 45% at 50% 50%, rgba(10,14,39,0.55) 0%, transparent 100%)' }} />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <p className="text-xs uppercase tracking-[0.3em] mb-6 font-medium"
          style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-body)' }}>
          Performance · Engineered
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
    <About />
    <Projects />
    </>
  );
}
