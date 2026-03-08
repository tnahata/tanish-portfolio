'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

const LINES = [
  { label: 'MUSIC',       color: [0,217,255],   opacity: 0.7, fn: (x: number, t: number) => Math.sin(x*0.025+t*2.2)*0.8 + Math.sin(x*0.05+t*3.1)*0.2 },
  { label: 'ATHLETIC',    color: [255,255,255],  opacity: 0.5, fn: (x: number, t: number) => { const ph = ((x*0.018+t*1.6) % (Math.PI*2)); if(ph<0.12) return Math.sin(ph*26)*1.3; if(ph>0.7&&ph<0.95) return -Math.sin((ph-0.7)*12)*0.6; return 0.04*Math.sin(x*0.004); } },
  { label: 'AI',          color: [99,102,241],   opacity: 0.7, fn: (x: number, t: number) => Math.sin(x*0.042+t)*0.35 + Math.sin(x*0.11+t*2.1)*0.28 + Math.cos(x*0.07+t*0.8)*0.22 + Math.sin(x*0.19+t*1.4)*0.15 },
  { label: 'ENGINEERING', color: [0,217,255],    opacity: 0.35, fn: (x: number, t: number) => { const v = Math.sin(x*0.022+t*1.1); return v>0.08?0.8:v<-0.08?-0.8:v*8; } },
  { label: 'MUSIC',       color: [0,217,255],    opacity: 0.18, fn: (x: number, t: number) => Math.sin(x*0.018+t*1.8+1.5)*0.9 },
  { label: 'AI',          color: [99,102,241],   opacity: 0.2,  fn: (x: number, t: number) => Math.sin(x*0.06+t*0.9)*0.5 + Math.sin(x*0.15+t*2.4)*0.3 + Math.cos(x*0.09+t)*0.2 },
];

export default function V3() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    let t = 0;
    let rafId: number;

    const animate = () => {
      const W = canvas.width;
      const H = canvas.height;
      t += 0.018;

      ctx.fillStyle = 'rgba(10,14,39,0.22)';
      ctx.fillRect(0, 0, W, H);

      // Evenly space lines across full height, with some clustering
      const positions = [0.1, 0.25, 0.42, 0.58, 0.73, 0.88];

      LINES.forEach((line, li) => {
        const midY = positions[li] * H;
        const amp = H * 0.055;
        const [r, g, b] = line.color;

        // Glow pass
        ctx.beginPath();
        for (let px = 0; px < W; px++) {
          const y = midY - line.fn(px, t) * amp;
          px === 0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y);
        }
        ctx.strokeStyle = `rgba(${r},${g},${b},${line.opacity * 0.25})`;
        ctx.lineWidth = 8;
        ctx.stroke();

        // Main line
        ctx.beginPath();
        for (let px = 0; px < W; px++) {
          const y = midY - line.fn(px, t) * amp;
          px === 0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y);
        }
        ctx.strokeStyle = `rgba(${r},${g},${b},${line.opacity})`;
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Label — only for the 4 named foreground lines
        if (li < 4) {
          ctx.font = `9px "JetBrains Mono", monospace`;
          ctx.fillStyle = `rgba(${r},${g},${b},${line.opacity * 0.6})`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(line.label, 12, midY - amp * 0.5 - 10);
        }
      });

      // Scanning vertical bar
      const barX = (t * 55) % W;
      const scanGrad = ctx.createLinearGradient(barX - 20, 0, barX + 2, 0);
      scanGrad.addColorStop(0, 'rgba(0,217,255,0)');
      scanGrad.addColorStop(1, 'rgba(0,217,255,0.04)');
      ctx.fillStyle = scanGrad;
      ctx.fillRect(barX - 20, 0, 22, H);

      rafId = requestAnimationFrame(animate);
    };

    animate();
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <section className="relative w-full min-h-screen overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Horizontal dark band behind text */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(10,14,39,0.65) 0%, rgba(10,14,39,0.2) 30%, rgba(10,14,39,0.2) 70%, rgba(10,14,39,0.65) 100%)' }} />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <p className="text-xs uppercase tracking-[0.3em] mb-6 font-medium"
          style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-body)' }}>
          Music · Rhythm · Signal
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
