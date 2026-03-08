'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

export default function V4() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const RUNNER: [number, number][] = [
      [.50,.06],[.50,.14],[.49,.22],[.47,.30],[.45,.38],
      [.38,.20],[.30,.28],[.23,.36],
      [.58,.22],[.66,.30],[.72,.26],
      [.44,.46],[.37,.58],[.30,.70],[.25,.82],[.22,.95],
      [.50,.48],[.57,.60],[.63,.72],[.69,.82],[.74,.70],
      [.47,.41],[.53,.42],
    ];

    const CIRCUIT = (W: number, H: number) =>
      Array.from({ length: 180 }, () => [Math.random() * W, Math.random() * H] as [number, number]);

    let circuitPts: [number, number][] = [];

    type P = { x:number; y:number; tx:number; ty:number; vx:number; vy:number; sz:number; cyan:boolean; alpha:number };

    let particles: P[] = [];
    let phase = 0;
    let timer = 0;
    let connections: [number,number][] = [];

    const initParticles = (W: number, H: number) => {
      circuitPts = CIRCUIT(W, H);
      particles = circuitPts.map(([px, py]) => ({
        x: px, y: py, tx: px, ty: py,
        vx: 0, vy: 0,
        sz: 1.5 + Math.random() * 2,
        cyan: Math.random() > 0.45,
        alpha: 0.25 + Math.random() * 0.5,
      }));
      connections = [];
      const N = circuitPts.length;
      for (let i = 0; i < N; i++) {
        for (let j = i+1; j < N; j++) {
          const dx = circuitPts[i][0]-circuitPts[j][0];
          const dy = circuitPts[i][1]-circuitPts[j][1];
          if (Math.sqrt(dx*dx+dy*dy) < Math.min(W,H)*0.09) connections.push([i,j]);
        }
      }
    };

    const setCircuit = () => {
      const W = canvas.width;
      particles.forEach((p, i) => {
        p.tx = circuitPts[i % circuitPts.length][0];
        p.ty = circuitPts[i % circuitPts.length][1];
        if (p.x > W + 100) { p.x = -20; p.y = p.ty; p.vx = 0; p.vy = 0; }
      });
    };

    const setRunner = (W: number, H: number) => {
      const padX = W * 0.22; const padY = H * 0.06;
      const rW = W * 0.56; const rH = H * 0.88;
      particles.forEach((p, i) => {
        const [rx, ry] = RUNNER[i % RUNNER.length];
        p.tx = padX + rx * rW + (Math.random()-.5)*18;
        p.ty = padY + ry * rH + (Math.random()-.5)*18;
      });
    };

    const setSprint = () => {
      particles.forEach(p => {
        p.tx = canvas.width + 80 + Math.random()*300;
        p.vx = 4 + Math.random()*7;
      });
    };

    const init = () => {
      const W = canvas.width; const H = canvas.height;
      initParticles(W, H);
      setCircuit();
      phase = 0; timer = 0;
    };
    init();
    window.addEventListener('resize', init);

    let rafId: number;

    const animate = () => {
      const W = canvas.width; const H = canvas.height;
      timer++;

      if (phase === 0 && timer > 150) { phase = 1; timer = 0; setRunner(W, H); }
      if (phase === 1 && timer > 180) { phase = 2; timer = 0; }
      if (phase === 2 && timer > 110) { phase = 3; timer = 0; setSprint(); }
      if (phase === 3 && timer > 80)  { phase = 0; timer = 0; setCircuit(); }

      ctx.fillStyle = 'rgba(10,14,39,0.2)';
      ctx.fillRect(0, 0, W, H);

      // Circuit lines in phases 0 & 1
      if (phase === 0 || phase === 1) {
        const opacity = phase === 0
          ? Math.min(1, timer/70)*0.18
          : Math.max(0, 1-(timer/90))*0.18;
        connections.slice(0, 100).forEach(([a, b]) => {
          const pa = particles[a]; const pb = particles[b];
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pa.x, pb.y);
          ctx.lineTo(pb.x, pb.y);
          ctx.strokeStyle = `rgba(99,102,241,${opacity})`;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        });
      }

      // Particles
      particles.forEach(p => {
        const ease = phase === 3 ? 0.09 : 0.035;
        p.vx += (p.tx - p.x) * ease;
        p.vy += (p.ty - p.y) * ease;
        p.vx *= 0.80; p.vy *= 0.80;
        p.x += p.vx; p.y += p.vy;

        const spd = Math.sqrt(p.vx*p.vx + p.vy*p.vy);
        const [r,g,b] = p.cyan ? [0,217,255] : [99,102,241];

        if (spd > 3 && phase === 3) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx*5, p.y - p.vy*5);
          ctx.strokeStyle = `rgba(${r},${g},${b},${p.alpha*0.7})`;
          ctx.lineWidth = p.sz * 0.7;
          ctx.stroke();
        } else {
          const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.sz*4);
          glow.addColorStop(0, `rgba(${r},${g},${b},${p.alpha*0.35})`);
          glow.addColorStop(1, 'transparent');
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.sz*4, 0, Math.PI*2);
          ctx.fillStyle = glow;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.sz, 0, Math.PI*2);
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      });

      rafId = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('resize', init);
    };
  }, []);

  return (
    <section className="relative w-full min-h-screen overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(10,14,39,0.45) 0%, rgba(10,14,39,0.75) 100%)' }} />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <p className="text-xs uppercase tracking-[0.3em] mb-6 font-medium"
          style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-body)' }}>
          Form · Flow · Function
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
