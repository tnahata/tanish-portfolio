'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';

/* ─── Hero SVG: HybridFit Dashboard Schematic ──────────────────────────────── */
function HybridFitDashboard() {
  const chartPath = "M310,310 C330,305 345,285 365,260 C385,235 395,248 415,225 C435,202 445,210 465,190 C485,170 495,178 515,162 C535,146 545,155 565,145 C585,135 595,142 615,150 C635,158 645,168 665,180 C685,192 695,205 720,215 C745,225 760,228 790,232";
  return (
    <svg viewBox="0 0 900 440" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="900" height="440" fill="#080c1f" />

      {/* Top nav */}
      <rect width="900" height="48" fill="#0d1230" />
      <rect y="48" width="900" height="1" fill="rgba(0,217,255,0.1)" />
      <text x="20" y="30" fontSize="13" fill="#00d9ff" fontFamily="monospace" fontWeight="bold">HybridFit</text>
      {['Dashboard', 'Plans', 'Calendar', 'Progress'].map((item, i) => (
        <g key={item}>
          {item === 'Dashboard' && <rect x={130 + i * 100} y="0" width="80" height="48" fill="rgba(0,217,255,0.06)" />}
          {item === 'Dashboard' && <rect x={130 + i * 100} y="47" width="80" height="1" fill="#00d9ff" />}
          <text x={170 + i * 100} y="30" textAnchor="middle" fontSize="10"
            fill={item === 'Dashboard' ? '#00d9ff' : 'rgba(245,245,245,0.3)'} fontFamily="monospace">{item}</text>
        </g>
      ))}
      <circle cx="870" cy="24" r="14" fill="rgba(99,102,241,0.2)" stroke="rgba(99,102,241,0.4)" strokeWidth="1" />
      <text x="870" y="29" textAnchor="middle" fontSize="10" fill="rgba(99,102,241,0.8)" fontFamily="monospace">TN</text>

      {/* Stat cards row */}
      {[
        { label: 'Workouts', value: '47', sub: 'total completed', color: '#00d9ff', x: 20 },
        { label: 'Streak', value: '12', sub: 'days current', color: '#22c55e', x: 235 },
        { label: 'Active Mins', value: '340', sub: 'this plan', color: '#6366f1', x: 450 },
        { label: 'Plan Progress', value: '68%', sub: 'week 6 of 12', color: '#f59e0b', x: 665 },
      ].map(({ label, value, sub, color, x }) => (
        <g key={label}>
          <rect x={x} y="64" width="195" height="70" rx="3" fill="#0d1230" stroke="rgba(0,217,255,0.08)" strokeWidth="1" />
          <text x={x + 14} y="84" fontSize="8" fill="rgba(245,245,245,0.35)" fontFamily="monospace" letterSpacing="1">{label.toUpperCase()}</text>
          <text x={x + 14} y="111" fontSize="22" fill={color} fontFamily="monospace" fontWeight="bold">{value}</text>
          <text x={x + 14} y="126" fontSize="8" fill="rgba(245,245,245,0.25)" fontFamily="monospace">{sub}</text>
          <rect x={x} y="64" width="3" height="70" rx="1" fill={color} opacity="0.5" />
        </g>
      ))}

      {/* Today's workout card */}
      <rect x="20" y="152" width="430" height="200" rx="3" fill="#0d1230" stroke="rgba(0,217,255,0.08)" strokeWidth="1" />
      <text x="34" y="175" fontSize="8" fill="rgba(0,217,255,0.5)" fontFamily="monospace" letterSpacing="2">TODAY&apos;S WORKOUT</text>
      <rect x="34" y="181" width="400" height="1" fill="rgba(0,217,255,0.07)" />
      <text x="34" y="202" fontSize="14" fill="rgba(245,245,245,0.85)" fontFamily="monospace">Week 6, Day 3 — Easy Run</text>
      <text x="34" y="220" fontSize="9" fill="rgba(245,245,245,0.35)" fontFamily="monospace">Running · 5.0 km · 35 min · Zone 2</text>

      {/* Metrics mini grid */}
      {[
        { label: 'Distance', value: '5.0 km', x: 34 },
        { label: 'Duration', value: '35 min', x: 130 },
        { label: 'Pace', value: '7:00/km', x: 226 },
        { label: 'Effort', value: 'Easy', x: 322 },
      ].map(({ label, value, x }) => (
        <g key={label}>
          <rect x={x} y="232" width="84" height="44" rx="2" fill="rgba(0,217,255,0.04)" stroke="rgba(0,217,255,0.08)" strokeWidth="1" />
          <text x={x + 8} y="247" fontSize="7" fill="rgba(245,245,245,0.3)" fontFamily="monospace">{label}</text>
          <text x={x + 8} y="265" fontSize="10" fill="rgba(0,217,255,0.75)" fontFamily="monospace">{value}</text>
        </g>
      ))}

      {/* Log button */}
      <rect x="34" y="292" width="120" height="28" rx="2" fill="rgba(0,217,255,0.15)" stroke="rgba(0,217,255,0.4)" strokeWidth="1" />
      <text x="94" y="311" textAnchor="middle" fontSize="10" fill="#00d9ff" fontFamily="monospace">Log Results</text>
      <rect x="166" y="292" width="100" height="28" rx="2" fill="rgba(99,102,241,0.1)" stroke="rgba(99,102,241,0.2)" strokeWidth="1" />
      <text x="216" y="311" textAnchor="middle" fontSize="10" fill="rgba(99,102,241,0.7)" fontFamily="monospace">Swap</text>
      <rect x="278" y="292" width="140" height="28" rx="2" fill="rgba(245,245,245,0.04)" stroke="rgba(245,245,245,0.08)" strokeWidth="1" />
      <text x="348" y="311" textAnchor="middle" fontSize="10" fill="rgba(245,245,245,0.35)" fontFamily="monospace">View Details</text>

      {/* Plan progress bar */}
      <rect x="20" y="362" width="430" height="60" rx="3" fill="#0d1230" stroke="rgba(0,217,255,0.08)" strokeWidth="1" />
      <text x="34" y="382" fontSize="8" fill="rgba(245,245,245,0.3)" fontFamily="monospace">Hybrid Performance — 12 Week Plan</text>
      <rect x="34" y="392" width="400" height="8" rx="4" fill="rgba(0,217,255,0.08)" />
      <rect x="34" y="392" width="272" height="8" rx="4" fill="url(#progressGrad)" />
      <text x="34" y="413" fontSize="7" fill="rgba(245,245,245,0.25)" fontFamily="monospace">Week 6 of 12</text>
      <text x="434" y="413" textAnchor="end" fontSize="7" fill="rgba(0,217,255,0.5)" fontFamily="monospace">68% complete</text>

      {/* Activity chart panel */}
      <rect x="468" y="152" width="412" height="270" rx="3" fill="#0d1230" stroke="rgba(0,217,255,0.08)" strokeWidth="1" />
      <text x="482" y="173" fontSize="8" fill="rgba(0,217,255,0.5)" fontFamily="monospace" letterSpacing="2">WEEKLY ACTIVITY</text>
      <rect x="482" y="179" width="385" height="1" fill="rgba(0,217,255,0.07)" />

      {/* Mini chart */}
      {[0, 1, 2, 3].map(i => (
        <line key={i} x1="490" y1={310 - i * 40} x2="860" y2={310 - i * 40}
          stroke="rgba(0,217,255,0.04)" strokeWidth="1" strokeDasharray="3 3" />
      ))}
      <path d={chartPath} stroke="#00d9ff" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d={`${chartPath} L790,330 L310,330 Z`} fill="url(#actGrad)" opacity="0.25" />
      <path d="M310,325 C340,322 370,318 400,315 C430,312 460,310 490,308 C520,306 550,305 580,306 C610,307 640,310 670,315 C700,320 730,323 760,325 C775,326 782,326 790,327"
        stroke="rgba(99,102,241,0.45)" strokeWidth="1" strokeDasharray="4 3" fill="none" />

      {/* Day labels */}
      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
        <g key={i}>
          <text x={310 + i * 80} y="345" textAnchor="middle" fontSize="8"
            fill={i === 2 ? '#00d9ff' : 'rgba(245,245,245,0.2)'} fontFamily="monospace">{d}</text>
          {i === 2 && <circle cx={310 + i * 80} cy={190} r="4" fill="#0d1230" stroke="#00d9ff" strokeWidth="1.5" />}
          {i === 2 && <circle cx={310 + i * 80} cy={190} r="1.5" fill="#00d9ff" />}
        </g>
      ))}

      {/* Legend */}
      <line x1="690" y1="192" x2="706" y2="192" stroke="#00d9ff" strokeWidth="1.5" />
      <text x="710" y="196" fontSize="7" fill="rgba(245,245,245,0.35)" fontFamily="monospace">Distance</text>
      <line x1="690" y1="204" x2="706" y2="204" stroke="rgba(99,102,241,0.5)" strokeWidth="1" strokeDasharray="3 2" />
      <text x="710" y="208" fontSize="7" fill="rgba(245,245,245,0.25)" fontFamily="monospace">Volume</text>

      {/* Recent activity list */}
      <text x="482" y="368" fontSize="8" fill="rgba(245,245,245,0.3)" fontFamily="monospace" letterSpacing="1">RECENT</text>
      {[
        { status: '✓', label: 'Strength — Upper Body', date: 'Yesterday', c: '#22c55e' },
        { status: '✓', label: '5K Easy Run', date: 'Mon', c: '#22c55e' },
        { status: '—', label: 'Drill Session', date: 'Sun', c: '#f59e0b' },
      ].map(({ status, label, date, c }, i) => (
        <g key={label}>
          <text x="490" y={385 + i * 18} fontSize="8" fill={c} fontFamily="monospace">{status}</text>
          <text x="504" y={385 + i * 18} fontSize="8" fill="rgba(245,245,245,0.5)" fontFamily="monospace">{label}</text>
          <text x="852" y={385 + i * 18} textAnchor="end" fontSize="7" fill="rgba(245,245,245,0.2)" fontFamily="monospace">{date}</text>
        </g>
      ))}

      <defs>
        <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00d9ff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#00d9ff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="progressGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#00d9ff" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */
export default function HybridFitPage() {
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('cs-visible'); obs.unobserve(e.target); } }),
      { threshold: 0.1 }
    );
    pageRef.current?.querySelectorAll('.cs-reveal').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={pageRef} style={{ backgroundColor: 'var(--color-primary)', minHeight: '100vh' }}>

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 sm:px-10 lg:px-16 py-4"
        style={{ backgroundColor: 'rgba(10,14,39,0.92)', borderBottom: '1px solid rgba(0,217,255,0.08)', backdropFilter: 'blur(12px)' }}>
        <Link href="/#projects" className="flex items-center gap-2 group"
          style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}>
          <ArrowLeft size={14} strokeWidth={2} className="transition-transform duration-200 group-hover:-translate-x-1" />
          <span>Back to Projects</span>
        </Link>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'rgba(0,217,255,0.4)', letterSpacing: '0.15em' }}>
          CASE STUDY — 03
        </span>
      </nav>

      {/* ── Hero ── */}
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 pt-16 pb-0">
        <div className="cs-reveal opacity-0 mb-6 flex items-center gap-5">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'rgba(34,197,94,0.7)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Full Stack · Next.js · MongoDB
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(34,197,94,0.15)' }} />
          <span className="flex items-center gap-1.5"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#22c55e', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }} />
            Live
          </span>
        </div>

        <h1 className="cs-reveal opacity-0"
          style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(3rem, 7vw, 6.5rem)', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.0, letterSpacing: '-0.03em', marginBottom: '1rem' }}>
          HybridFit
        </h1>
        <p className="cs-reveal opacity-0 mb-10"
          style={{ fontFamily: 'var(--font-body)', fontSize: 'clamp(1rem, 1.5vw, 1.2rem)', color: 'var(--color-text-muted)', maxWidth: '55ch', lineHeight: 1.6 }}>
          Training platform for athletes who train across multiple sports and disciplines.
        </p>

        {/* Hero visual */}
        <div className="cs-reveal opacity-0 relative overflow-hidden"
          style={{ borderRadius: '6px', border: '1px solid rgba(34,197,94,0.2)', boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(34,197,94,0.04)' }}>
          <HybridFitDashboard />
          <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, transparent, var(--color-primary))' }} />
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 py-24 lg:py-32">

        {/* Overview */}
        <div className="cs-reveal opacity-0 mb-6 flex items-center gap-5">
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: 'var(--color-accent)', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 600 }}>
            01 — Overview
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(0,217,255,0.1)' }} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-12 lg:gap-20 mb-24 items-start">
          <div className="cs-reveal opacity-0 lg:sticky lg:top-28">
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 3.5vw, 3rem)', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
              One platform for athletes who refuse to specialize.
            </h2>
          </div>
          <div className="space-y-6">
            <p className="cs-reveal opacity-0" style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', lineHeight: '1.85', color: 'var(--color-text)' }}>
              Most fitness apps assume you have one sport. HybridFit doesn&apos;t. It&apos;s built for the athlete who runs in the morning, lifts in the afternoon, and plays soccer on weekends—and wants to see all of it in one place, structured, trackable, and adapting as their schedule changes. I&apos;m that athlete, and no existing tool handled multi-discipline training without friction. So I built the one I wanted.
            </p>
            <p className="cs-reveal opacity-0" style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', lineHeight: '1.85', color: 'var(--color-text-muted)' }}>
              The platform handles multi-plan enrollment, detailed workout logging across four types (distance, strength, drill, and mixed sessions), a flexible program calendar, streak tracking, and a progress dashboard that shows you exactly where you are in each plan. The exercise library has 1,000+ curated entries built from multiple data sources, normalized into a consistent schema. AI coaching recommendations are the next layer being built on top.
            </p>
            <p className="cs-reveal opacity-0" style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', lineHeight: '1.85', color: 'var(--color-text-muted)' }}>
              The hardest design problem wasn&apos;t any individual feature—it was making a system that complex feel simple to use daily. Every UI decision got evaluated against a single question: does this add friction or remove it? The answer shaped the architecture as much as the interface.
            </p>
          </div>
        </div>

        {/* Hard Parts */}
        <div className="cs-reveal opacity-0 mb-6 flex items-center gap-5">
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: 'var(--color-secondary)', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 600 }}>
            02 — The Hard Parts
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(99,102,241,0.15)' }} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-24">
          {[
            {
              num: '01',
              title: 'Performance at Scale',
              body: 'Early on, certain core data fetches were issuing a database query for every enrolled plan a user had—the classic N+1 problem. Static content like the exercise library was also hitting the database on every request with no caching. I rearchitected the query patterns to batch related data in single calls, added field projections to strip unnecessary payload, introduced response caching on content that doesn\'t change frequently, and right-sized the connection pool for real concurrency. The result was a projected 20× increase in concurrent user capacity.',
            },
            {
              num: '02',
              title: 'Modelling Heterogeneous Workouts',
              body: 'A strength session and a 5K run are structurally nothing alike—one tracks sets, reps, and weight per exercise; the other tracks distance, pace, and heart rate for the whole session. Drills add another dimension entirely. Designing a data model flexible enough to represent all of these consistently, while still being efficiently queryable and renderable by a single logging UI, was a genuine schema design challenge. Getting the abstraction right early saved a lot of pain later when adding mixed workout types.',
            },
            {
              num: '03',
              title: 'Building the Exercise Library',
              body: 'A 1,000+ entry exercise library doesn\'t exist until you build it. I wrote a data ingestion pipeline to pull exercises from multiple external sources, each with their own structure and format, and normalize them into a unified schema that the frontend and future recommendation engine could work against. The pipeline had to handle inconsistent naming, missing fields, duplicate entries across sources, and sport-specific conventions—running drills and strength exercises don\'t share the same vocabulary.',
            },
          ].map(({ num, title, body }) => (
            <div key={num} className="cs-reveal opacity-0 p-7"
              style={{ backgroundColor: '#0d1230', border: '1px solid rgba(0,217,255,0.1)', borderRadius: '4px' }}>
              <div className="flex items-start gap-4 mb-4">
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'rgba(0,217,255,0.4)', letterSpacing: '0.1em', marginTop: '2px' }}>{num}</span>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.2 }}>{title}</h3>
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', lineHeight: '1.75', color: 'var(--color-text-muted)' }}>{body}</p>
            </div>
          ))}
        </div>

        {/* Outcomes */}
        <div className="cs-reveal opacity-0 mb-6 flex items-center gap-5">
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: 'var(--color-accent)', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 600 }}>
            03 — Outcomes
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(0,217,255,0.1)' }} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-24">
          {[
            { metric: '99.76%', label: 'Reduction in database queries on static routes' },
            { metric: '1,000+', label: 'Curated exercises across running, strength, soccer' },
            { metric: '5×', label: 'More concurrent users after connection pool tuning' },
            { metric: '4', label: 'Workout types: distance, strength, drill, mixed' },
          ].map(({ metric, label }) => (
            <div key={label} className="cs-reveal opacity-0 p-6"
              style={{ backgroundColor: '#0d1230', border: '1px solid rgba(0,217,255,0.08)', borderRadius: '4px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 3vw, 2.8rem)', fontWeight: 700, color: 'var(--color-accent)', lineHeight: 1, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
                {metric}
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Tech stack */}
        <div className="cs-reveal opacity-0 mb-6 flex items-center gap-5">
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: 'var(--color-secondary)', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 600 }}>
            04 — Stack
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(99,102,241,0.15)' }} />
        </div>

        <div className="cs-reveal opacity-0 flex flex-wrap gap-3 mb-24">
          {['Next.js 15', 'TypeScript', 'NextAuth (Credentials)', 'MongoDB', 'Mongoose', 'Zod', 'Vercel', 'Puppeteer', 'Shadcn/UI', 'TailwindCSS', 'Pinecone (planned)'].map(tag => (
            <span key={tag} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', color: 'rgba(34,197,94,0.65)', border: '1px solid rgba(34,197,94,0.18)', padding: '0.35rem 0.85rem', borderRadius: '2px', backgroundColor: 'rgba(34,197,94,0.04)' }}>
              {tag}
            </span>
          ))}
        </div>

        {/* CTA */}
        <div className="cs-reveal opacity-0 flex flex-col sm:flex-row items-start sm:items-center gap-5 pt-8"
          style={{ borderTop: '1px solid rgba(0,217,255,0.1)' }}>
          <a href="https://github.com/tnahata/hybrid-fit" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 shrink-0 px-6 py-3 transition-opacity duration-200 hover:opacity-80"
            style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-primary)', fontFamily: 'var(--font-body)', fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderRadius: '3px' }}>
            <ArrowUpRight size={14} />
            View on GitHub
          </a>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            Live at{' '}
            <a href="https://hybridfit.app" target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--color-accent)' }}>
              hybridfit.app
            </a>
          </p>
        </div>
      </div>

      <style>{`
        .cs-reveal { transform: translateY(20px); transition: opacity 0.7s ease, transform 0.7s ease; }
        .cs-reveal.cs-visible { opacity: 1 !important; transform: translateY(0); }
        .cs-reveal:nth-child(2) { transition-delay: 80ms; }
        .cs-reveal:nth-child(3) { transition-delay: 160ms; }
        .cs-reveal:nth-child(4) { transition-delay: 240ms; }
      `}</style>
    </div>
  );
}
