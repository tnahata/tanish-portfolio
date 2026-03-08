'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';

/* ─── Animated Network Canvas ──────────────────────────────────────────────── */
function AgentNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    const W = () => canvas.offsetWidth;
    const H = () => canvas.offsetHeight;

    const nodes = [
      { label: 'agent', x: 0.5, y: 0.45, r: 9, primary: true, pulse: 0 },
      { label: 'planner', x: 0.25, y: 0.25, r: 6, primary: false, pulse: 0.8 },
      { label: 'memory', x: 0.75, y: 0.25, r: 6, primary: false, pulse: 1.6 },
      { label: 'tools', x: 0.2, y: 0.65, r: 6, primary: false, pulse: 2.4 },
      { label: 'executor', x: 0.8, y: 0.65, r: 5, primary: false, pulse: 3.2 },
      { label: 'feedback', x: 0.5, y: 0.78, r: 5, primary: false, pulse: 4.0 },
      { label: 'context', x: 0.35, y: 0.5, r: 4, primary: false, pulse: 1.2 },
      { label: 'critic', x: 0.65, y: 0.5, r: 4, primary: false, pulse: 2.8 },
    ];
    const edges = [
      [0, 1], [0, 2], [0, 3], [0, 4], [0, 5],
      [1, 6], [2, 7], [3, 6], [4, 7], [1, 2],
      [6, 0], [7, 0], [5, 3], [5, 4],
    ];

    // Animate "signal" particles along edges
    const particles: { edge: number; t: number; speed: number }[] = edges.map((_, i) => ({
      edge: i,
      t: Math.random(),
      speed: 0.003 + Math.random() * 0.004,
    }));

    let t = 0;
    let rafId: number;

    const draw = () => {
      const w = W(), h = H();
      ctx.clearRect(0, 0, w, h);

      t += 0.012;

      const nx = (n: typeof nodes[0]) => n.x * w;
      const ny = (n: typeof nodes[0]) => n.y * h;

      // Edges
      edges.forEach(([a, b]) => {
        const na = nodes[a], nb = nodes[b];
        const grad = ctx.createLinearGradient(nx(na), ny(na), nx(nb), ny(nb));
        grad.addColorStop(0, 'rgba(0,217,255,0.12)');
        grad.addColorStop(1, 'rgba(99,102,241,0.12)');
        ctx.beginPath();
        ctx.moveTo(nx(na), ny(na));
        ctx.lineTo(nx(nb), ny(nb));
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Particles
      particles.forEach((p, _i) => {
        p.t += p.speed;
        if (p.t > 1) p.t -= 1;
        const [a, b] = edges[p.edge];
        const na = nodes[a], nb = nodes[b];
        const px = nx(na) + (nx(nb) - nx(na)) * p.t;
        const py = ny(na) + (ny(nb) - ny(na)) * p.t;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        const alpha = 0.4 + 0.4 * Math.sin(p.t * Math.PI);
        ctx.fillStyle = `rgba(0,217,255,${alpha})`;
        ctx.fill();
      });

      // Nodes
      nodes.forEach(n => {
        const x = nx(n), y = ny(n);
        const pulse = 0.5 + 0.5 * Math.sin(t + n.pulse);

        // Outer pulse ring
        ctx.beginPath();
        ctx.arc(x, y, n.r + 6 + pulse * 4, 0, Math.PI * 2);
        ctx.strokeStyle = n.primary
          ? `rgba(0,217,255,${0.08 * pulse})`
          : `rgba(99,102,241,${0.06 * pulse})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Node fill
        ctx.beginPath();
        ctx.arc(x, y, n.r, 0, Math.PI * 2);
        if (n.primary) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, n.r);
          g.addColorStop(0, 'rgba(0,217,255,0.9)');
          g.addColorStop(1, 'rgba(0,150,200,0.7)');
          ctx.fillStyle = g;
        } else {
          ctx.fillStyle = `rgba(99,102,241,${0.4 + 0.3 * pulse})`;
        }
        ctx.fill();

        // Label
        ctx.font = `${n.primary ? 'bold ' : ''}10px "JetBrains Mono", monospace`;
        ctx.fillStyle = n.primary ? 'rgba(0,217,255,0.9)' : 'rgba(245,245,245,0.35)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(n.label, x, y + n.r + 5);
      });

      rafId = requestAnimationFrame(draw);
    };

    draw();
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" style={{ display: 'block' }} />;
}

/* ─── Typewriter Hook ──────────────────────────────────────────────────────── */
function useTypewriter(text: string, speed = 40, delay = 500) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    let i = 0;
    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        setDisplayed(text.slice(0, ++i));
        if (i >= text.length) clearInterval(interval);
      }, speed);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timeout);
  }, [text, speed, delay]);
  return displayed;
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */
export default function AIAgentPage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const typed = useTypewriter('The problem I\'m looking for.', 55, 800);

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('cs-visible'); obs.unobserve(e.target); } }),
      { threshold: 0.08 }
    );
    pageRef.current?.querySelectorAll('.cs-reveal').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const QUESTIONS = [
    { q: 'What does reliability mean for an agent that takes action on your behalf?', note: 'Not accuracy — reliability. The bar is different when consequences are real.' },
    { q: 'When should an agent ask for permission vs. just proceed?', note: 'Trust calibration is an unsolved design problem. Most agents get it wrong in both directions.' },
    { q: 'How do you debug a system whose reasoning is opaque?', note: 'Observability for agents is where logging was for distributed systems in 2010. Wide open.' },
    { q: 'What\'s the right granularity for a task?', note: 'One big agent vs. many small ones is a real architectural question with real tradeoffs.' },
    { q: 'What should agents remember, and who decides?', note: 'Memory gives agents leverage. It also gives them drift. The design space here is enormous.' },
  ];

  return (
    <div ref={pageRef} style={{ backgroundColor: 'var(--color-primary)', minHeight: '100vh' }}>

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 sm:px-10 lg:px-16 py-4"
        style={{ backgroundColor: 'rgba(10,14,39,0.92)', borderBottom: '1px solid rgba(99,102,241,0.12)', backdropFilter: 'blur(12px)' }}>
        <Link href="/#projects" className="flex items-center gap-2 group"
          style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}>
          <ArrowLeft size={14} strokeWidth={2} className="transition-transform duration-200 group-hover:-translate-x-1" />
          <span>Back to Projects</span>
        </Link>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'rgba(99,102,241,0.6)', letterSpacing: '0.15em' }}>
          NEXT BUILD — 03
        </span>
      </nav>

      {/* ── Hero ── */}
      <div className="relative overflow-hidden" style={{ minHeight: '90vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {/* Network background */}
        <div className="absolute inset-0" style={{ opacity: 0.6 }}>
          <AgentNetwork />
        </div>
        {/* Radial vignette */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 30%, var(--color-primary) 80%)' }} />

        {/* Hero text */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 py-24">
          <div className="cs-reveal opacity-0 mb-8">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'rgba(99,102,241,0.6)', letterSpacing: '0.25em', textTransform: 'uppercase' }}>
              Agentic AI · Open Question · Collaboration Welcome
            </span>
          </div>

          <h1 className="mb-8"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.8rem, 6vw, 5.5rem)', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.05, letterSpacing: '-0.03em', maxWidth: '16ch' }}>
            {typed}
            <span className="blink-cursor" style={{ color: 'var(--color-secondary)' }}>|</span>
          </h1>

          <p className="cs-reveal opacity-0 mb-10"
            style={{ fontFamily: 'var(--font-body)', fontSize: 'clamp(1rem, 1.4vw, 1.15rem)', color: 'var(--color-text-muted)', maxWidth: '52ch', lineHeight: 1.75 }}>
            I haven&apos;t started building yet. I&apos;m still in the part where I stare at the space, read everything I can find, and wait for the right problem to become obvious. This page is where I think out loud about it.
          </p>

          <div className="cs-reveal opacity-0 flex items-center gap-3">
            <div className="h-px w-10" style={{ background: 'var(--color-secondary)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'rgba(99,102,241,0.5)', letterSpacing: '0.15em' }}>
              SCROLL TO READ
            </span>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 pb-24 lg:pb-32">

        {/* What pulls me here */}
        <div className="cs-reveal opacity-0 mb-6 flex items-center gap-5">
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: 'var(--color-secondary)', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 600 }}>
            01 — What Pulls Me Here
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(99,102,241,0.15)' }} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-12 lg:gap-20 mb-24 items-start">
          <div className="cs-reveal opacity-0 lg:sticky lg:top-28">
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 3.5vw, 3rem)', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
              Agents that operate, not just generate.
            </h2>
          </div>
          <div className="space-y-6">
            <p className="cs-reveal opacity-0" style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', lineHeight: '1.85', color: 'var(--color-text)' }}>
              The agentic space is moving faster than the tooling, the mental models, and definitely the production track record. We have models that can reason, use tools, maintain context, and plan across steps—but most production agents are still brittle, over-scaffolded, and solving problems that don&apos;t actually need agents. The interesting work is figuring out where the leverage is.
            </p>
            <p className="cs-reveal opacity-0" style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', lineHeight: '1.85', color: 'var(--color-text-muted)' }}>
              At FedEx I&apos;ve been experimenting with IDE AI agents to accelerate documentation and code quality in an enterprise environment—which has given me a ground-level view of where the friction is between what agents promise and what they actually deliver when deployed in real workflows. That gap is where I want to build.
            </p>
          </div>
        </div>

        {/* Questions */}
        <div className="cs-reveal opacity-0 mb-6 flex items-center gap-5">
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: 'var(--color-accent)', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 600 }}>
            02 — Questions I Keep Coming Back To
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(0,217,255,0.1)' }} />
        </div>

        <div className="space-y-4 mb-24">
          {QUESTIONS.map(({ q, note }, i) => (
            <div key={i} className="cs-reveal opacity-0 grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4 p-6"
              style={{ backgroundColor: '#0d1230', border: '1px solid rgba(99,102,241,0.1)', borderRadius: '4px', borderLeft: '2px solid rgba(99,102,241,0.4)' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.4, fontStyle: 'italic' }}>
                &ldquo;{q}&rdquo;
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.65 }}>
                {note}
              </p>
            </div>
          ))}
        </div>

        {/* What I want to build */}
        <div className="cs-reveal opacity-0 mb-6 flex items-center gap-5">
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: 'var(--color-secondary)', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 600 }}>
            03 — What I Want to Build
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(99,102,241,0.15)' }} />
        </div>

        <div className="cs-reveal opacity-0 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 lg:gap-20 mb-24">
          <div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', lineHeight: '1.85', color: 'var(--color-text)', marginBottom: '1.5rem' }}>
              Something that <em>operates</em>—not just generates. An agent that handles a workflow end-to-end, makes real decisions with real consequences, and gets meaningfully better over time. I&apos;m drawn to problems where humans are doing high-frequency, semi-structured work that could be delegated to a system that genuinely understands context.
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', lineHeight: '1.85', color: 'var(--color-text-muted)' }}>
              Productivity, development tooling, and research workflows all feel like the right territory. But I&apos;m more interested in finding the right problem than picking a category. The best projects I&apos;ve built started with a real frustration, not a market thesis.
            </p>
          </div>
          {/* What I bring */}
          <div className="p-7" style={{ backgroundColor: '#0d1230', border: '1px solid rgba(99,102,241,0.12)', borderRadius: '4px' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '1.25rem' }}>
              What I bring to it
            </h3>
            {[
              'Full-stack engineering — I can build the product, not just the agent layer',
              'Enterprise API experience at scale (FedEx logistics systems)',
              'A strong bias toward shipping over theorizing',
              'Enough curiosity about the underlying models to work productively at the frontier',
              'Experience building complex multi-user systems with real performance constraints',
            ].map((item, i) => (
              <div key={i} className="flex gap-3 mb-3">
                <span style={{ color: 'var(--color-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', marginTop: '3px', flexShrink: 0 }}>→</span>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', lineHeight: 1.65, color: 'var(--color-text-muted)' }}>{item}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="cs-reveal opacity-0 p-10 lg:p-14 text-center"
          style={{ backgroundColor: '#0d1230', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '6px', background: 'linear-gradient(135deg, rgba(13,18,48,1) 0%, rgba(99,102,241,0.06) 100%)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 3.5vw, 3rem)', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: '1rem' }}>
            Let&apos;s think about it <span style={{ color: 'var(--color-secondary)', fontStyle: 'italic' }}>together.</span>
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', color: 'var(--color-text-muted)', lineHeight: 1.75, maxWidth: '50ch', margin: '0 auto 2rem' }}>
            If you&apos;re working on something in the agentic space—or have a problem you think needs an agent but aren&apos;t sure yet—I&apos;d genuinely love to talk. Even early, unformed ideas.
          </p>
          <a href="mailto:tanishnahata2002@gmail.com?subject=AI%20Agent%20Collaboration"
            className="inline-flex items-center gap-2 px-8 py-4 transition-opacity duration-200 hover:opacity-80"
            style={{ backgroundColor: 'var(--color-secondary)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderRadius: '3px' }}>
            <Mail size={15} />
            Let&apos;s talk
          </a>
        </div>
      </div>

      <style>{`
        .cs-reveal { transform: translateY(20px); transition: opacity 0.7s ease, transform 0.7s ease; }
        .cs-reveal.cs-visible { opacity: 1 !important; transform: translateY(0); }
        .blink-cursor { animation: blink 1.1s step-end infinite; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </div>
  );
}
