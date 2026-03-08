'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';

/* ─── Hero SVG: ESMON App Interface Schematic ──────────────────────────────── */
function ESMONAppVisual() {
  return (
    <svg viewBox="0 0 900 440" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* App window background */}
      <rect width="900" height="440" fill="#080c1f" />

      {/* Title bar */}
      <rect width="900" height="36" fill="#0d1230" />
      <circle cx="18" cy="18" r="5" fill="rgba(255,80,80,0.4)" />
      <circle cx="34" cy="18" r="5" fill="rgba(255,190,0,0.3)" />
      <circle cx="50" cy="18" r="5" fill="rgba(0,200,80,0.3)" />
      <text x="450" y="23" textAnchor="middle" fontSize="11" fill="rgba(245,245,245,0.35)" fontFamily="monospace">ESMON Analytics Software</text>

      {/* Tab bar */}
      <rect y="36" width="900" height="34" fill="#0a0e27" />
      <rect x="0" y="36" width="900" height="1" fill="rgba(0,217,255,0.12)" />
      {/* Tabs */}
      {['Import', 'Reports', 'Charts', 'Export'].map((tab, i) => {
        const active = tab === 'Charts';
        const x = 20 + i * 120;
        return (
          <g key={tab}>
            {active && <rect x={x - 2} y="36" width="100" height="34" fill="rgba(0,217,255,0.08)" />}
            {active && <rect x={x - 2} y="69" width="100" height="1" fill="#00d9ff" />}
            <text x={x + 48} y="57" textAnchor="middle" fontSize="11"
              fill={active ? '#00d9ff' : 'rgba(245,245,245,0.3)'} fontFamily="monospace">{tab}</text>
          </g>
        );
      })}
      <rect y="70" width="900" height="1" fill="rgba(0,217,255,0.08)" />

      {/* Left filter panel */}
      <rect x="0" y="71" width="195" height="369" fill="#0b0f26" />
      <rect x="195" y="71" width="1" height="369" fill="rgba(0,217,255,0.08)" />

      {/* Filter panel content */}
      <text x="16" y="97" fontSize="9" fill="rgba(0,217,255,0.5)" fontFamily="monospace" letterSpacing="2">FILTERS</text>
      <rect x="14" y="105" width="165" height="1" fill="rgba(0,217,255,0.08)" />

      {/* Filter fields */}
      {[
        { label: 'File Type', value: 'LTM', y: 120 },
        { label: 'Date From', value: '2024-01-01', y: 160 },
        { label: 'Date To', value: '2024-03-31', y: 200 },
        { label: 'Driver ID', value: 'All', y: 240 },
        { label: 'Train No.', value: '12301', y: 280 },
      ].map(({ label, value, y }) => (
        <g key={label}>
          <text x="16" y={y} fontSize="8" fill="rgba(245,245,245,0.3)" fontFamily="monospace">{label}</text>
          <rect x="14" y={y + 6} width="165" height="22" rx="2" fill="rgba(0,217,255,0.05)" stroke="rgba(0,217,255,0.12)" strokeWidth="1" />
          <text x="22" y={y + 21} fontSize="9" fill="rgba(245,245,245,0.55)" fontFamily="monospace">{value}</text>
        </g>
      ))}

      {/* Run Report button */}
      <rect x="14" y="322" width="165" height="28" rx="2" fill="rgba(0,217,255,0.15)" stroke="rgba(0,217,255,0.4)" strokeWidth="1" />
      <text x="96" y="340" textAnchor="middle" fontSize="10" fill="#00d9ff" fontFamily="monospace">Run Report</text>

      {/* Reset button */}
      <rect x="14" y="358" width="80" height="22" rx="2" fill="rgba(99,102,241,0.1)" stroke="rgba(99,102,241,0.2)" strokeWidth="1" />
      <text x="54" y="373" textAnchor="middle" fontSize="9" fill="rgba(99,102,241,0.7)" fontFamily="monospace">Reset</text>

      {/* Main chart area */}
      <rect x="196" y="71" width="704" height="369" fill="#080c1f" />

      {/* Chart title */}
      <text x="216" y="98" fontSize="11" fill="rgba(245,245,245,0.5)" fontFamily="monospace">Speed vs Time — File: LTM_20240115_12301.bin</text>
      <rect x="216" y="104" width="670" height="1" fill="rgba(0,217,255,0.06)" />

      {/* Y-axis labels */}
      {[0, 1, 2, 3, 4].map(i => {
        const y = 360 - i * 55;
        const val = i * 25;
        return (
          <g key={i}>
            <text x="238" y={y + 4} textAnchor="end" fontSize="8" fill="rgba(245,245,245,0.25)" fontFamily="monospace">{val}</text>
            <line x1="242" y1={y} x2="860" y2={y} stroke="rgba(0,217,255,0.05)" strokeWidth="1" strokeDasharray="4 4" />
          </g>
        );
      })}
      <text x="215" y="240" fontSize="8" fill="rgba(0,217,255,0.35)" fontFamily="monospace" transform="rotate(-90, 215, 240)">Speed (km/h)</text>

      {/* X-axis labels */}
      {['00:00', '01:00', '02:00', '03:00', '04:00', '05:00'].map((t, i) => (
        <g key={t}>
          <text x={242 + i * 123} y="380" textAnchor="middle" fontSize="8" fill="rgba(245,245,245,0.25)" fontFamily="monospace">{t}</text>
          <line x1={242 + i * 123} y1="115" x2={242 + i * 123} y2="362" stroke="rgba(0,217,255,0.04)" strokeWidth="1" />
        </g>
      ))}
      <text x="550" y="400" textAnchor="middle" fontSize="8" fill="rgba(0,217,255,0.35)" fontFamily="monospace">Time (HH:MM)</text>

      {/* Main speed line — the hero of the chart */}
      <path
        d="M242,340 C260,335 270,310 290,280 C310,250 320,240 340,200 C360,160 365,155 380,145 C395,135 400,138 415,130 C430,122 435,128 450,115 C465,102 470,108 490,125 C510,142 515,155 530,160 C545,165 550,158 570,145 C590,132 595,140 615,148 C635,156 640,162 660,175 C680,188 685,200 700,220 C715,240 720,248 740,262 C760,276 770,285 800,295 C830,305 845,310 860,318"
        stroke="#00d9ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Area fill */}
      <path
        d="M242,340 C260,335 270,310 290,280 C310,250 320,240 340,200 C360,160 365,155 380,145 C395,135 400,138 415,130 C430,122 435,128 450,115 C465,102 470,108 490,125 C510,142 515,155 530,160 C545,165 550,158 570,145 C590,132 595,140 615,148 C635,156 640,162 660,175 C680,188 685,200 700,220 C715,240 720,248 740,262 C760,276 770,285 800,295 C830,305 845,310 860,318 L860,362 L242,362 Z"
        fill="url(#esmonGrad)" opacity="0.3" />

      {/* Secondary energy line */}
      <path
        d="M242,355 C270,352 300,348 340,344 C380,340 400,338 440,333 C480,328 510,325 550,322 C590,319 620,318 660,320 C700,322 730,325 780,328 C810,330 840,332 860,334"
        stroke="rgba(99,102,241,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="5 3" fill="none" />

      {/* Data point highlights */}
      {[
        [450, 115], [570, 145], [700, 220], [800, 295],
      ].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="8" fill="none" stroke="rgba(0,217,255,0.15)" strokeWidth="1" />
          <circle cx={x} cy={y} r="4" fill="#0a0e27" stroke="#00d9ff" strokeWidth="1.5" />
          <circle cx={x} cy={y} r="1.5" fill="#00d9ff" />
        </g>
      ))}

      {/* Legend */}
      <line x1="700" y1="120" x2="718" y2="120" stroke="#00d9ff" strokeWidth="2" />
      <text x="722" y="124" fontSize="8" fill="rgba(245,245,245,0.45)" fontFamily="monospace">Speed</text>
      <line x1="700" y1="134" x2="718" y2="134" stroke="rgba(99,102,241,0.5)" strokeWidth="1.5" strokeDasharray="4 2" />
      <text x="722" y="138" fontSize="8" fill="rgba(245,245,245,0.35)" fontFamily="monospace">Energy</text>

      {/* Status bar */}
      <rect y="424" width="900" height="16" fill="#0a0e27" />
      <rect y="424" width="900" height="1" fill="rgba(0,217,255,0.08)" />
      <text x="16" y="435" fontSize="7" fill="rgba(245,245,245,0.25)" fontFamily="monospace">Records: 1,847 · File: LTM_20240115_12301.bin · Driver: D-2201 · Train: 12301</text>
      <circle cx="880" cy="432" r="3" fill="#22c55e" opacity="0.7" />
      <text x="870" y="435" textAnchor="end" fontSize="7" fill="rgba(34,197,94,0.6)" fontFamily="monospace">Connected</text>

      <defs>
        <linearGradient id="esmonGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00d9ff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#00d9ff" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */
export default function ESMONPage() {
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
          CASE STUDY — 01
        </span>
      </nav>

      {/* ── Hero ── */}
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 pt-16 pb-0">
        <div className="cs-reveal opacity-0 mb-6 flex items-center gap-5">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'rgba(0,217,255,0.45)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Indian Railway · Desktop App · Java
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(0,217,255,0.1)' }} />
          <span className="flex items-center gap-1.5"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#00d9ff', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#00d9ff', display: 'inline-block' }} />
            Finishing
          </span>
        </div>

        <h1 className="cs-reveal opacity-0"
          style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(3rem, 7vw, 6.5rem)', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.0, letterSpacing: '-0.03em', marginBottom: '1rem' }}>
          ESMON
        </h1>
        <p className="cs-reveal opacity-0 mb-10"
          style={{ fontFamily: 'var(--font-body)', fontSize: 'clamp(1rem, 1.5vw, 1.2rem)', color: 'var(--color-text-muted)', maxWidth: '55ch', lineHeight: 1.6 }}>
          Desktop analytics platform for the Indian Railway Speed and Energy Monitoring System.
        </p>

        {/* Hero visual */}
        <div className="cs-reveal opacity-0 relative overflow-hidden"
          style={{ borderRadius: '6px', border: '1px solid rgba(0,217,255,0.15)', boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(0,217,255,0.05)' }}>
          <ESMONAppVisual />
          {/* Bottom fade */}
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
              Turning binary recordings into actionable insight.
            </h2>
          </div>
          <div className="space-y-6">
            <p className="cs-reveal opacity-0" style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', lineHeight: '1.85', color: 'var(--color-text)' }}>
              Monitoring devices on locomotives record detailed journey data—speed, energy, events—that engineers need to analyse and report on. The raw output from these devices is binary and completely unusable without software built specifically to decode it. I built the application that bridges that gap: load recordings from SD cards or USB, parse them into structured data, and surface everything through filterable reports, time-series charts, and composed PDF exports ready for operational review.
            </p>
            <p className="cs-reveal opacity-0" style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', lineHeight: '1.85', color: 'var(--color-text-muted)' }}>
              A core constraint shaped the architecture from the start: the application needs to work in environments where internet access cannot be assumed. These devices operate in remote areas, depots, and fieldwork settings—connectivity is unreliable or simply not there. Running everything locally with no server dependency wasn&apos;t a simplification, it was a requirement. Data stays on the machine, analysis happens offline, and the tool is usable anywhere the device is.
            </p>
            <p className="cs-reveal opacity-0" style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', lineHeight: '1.85', color: 'var(--color-text-muted)' }}>
              The people using this daily are operations engineers, not software engineers—so it had to be fast, reliable, and self-explanatory across Windows and macOS. It ships as a signed installer on both platforms, produced from a single CI pipeline, with no manual packaging steps required.
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
              title: 'Binary Parsing & Data Integrity',
              body: 'The devices produce binary output in multiple formats, each with its own structure, field layout, and edge cases. Parsing binary data correctly means handling byte alignment, distinguishing between valid records and noise, and gracefully dealing with corruption—partial writes, truncated files, and malformed records that occur naturally in field conditions. The parser had to be defensive enough to recover from bad data without silently producing wrong results.',
            },
            {
              num: '02',
              title: 'Designing Without a Net',
              body: 'I had no designer, no senior to review my decisions, and no existing pattern to follow for this kind of tool. The filter system spans multiple tabs, each needing independent state but sharing the same UI panel—a non-trivial UX problem I had to reason through on my own. A lot of the design work happened in cycles of building, using it myself, noticing what felt wrong, and iterating. That process taught me more about interface design than any resource I\'ve read.',
            },
            {
              num: '03',
              title: 'PDF Generation Deadlocks',
              body: 'Embedding charts in PDFs required rendering them as images during generation—but the UI framework and the PDF pipeline have conflicting threading requirements. The rendering process needs to happen on the UI thread, while PDF generation runs in the background. Getting these two to cooperate without deadlocking, particularly on macOS, required understanding where the conflict originated and separating the rendering step from the export pipeline entirely using offscreen rendering techniques.',
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
            { metric: '4', label: 'Independent filter contexts across tabs' },
            { metric: '0', label: 'Deadlocks in PDF generation after offscreen fix' },
            { metric: '2', label: 'Signed installers shipped from one CI pipeline' },
            { metric: '∞', label: 'Records processable — SQLite, local, no server' },
          ].map(({ metric, label }) => (
            <div key={label} className="cs-reveal opacity-0 p-6"
              style={{ backgroundColor: '#0d1230', border: '1px solid rgba(0,217,255,0.08)', borderRadius: '4px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.5rem, 4vw, 3.5rem)', fontWeight: 700, color: 'var(--color-accent)', lineHeight: 1, letterSpacing: '-0.03em', marginBottom: '0.5rem' }}>
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
          {['Java 21', 'JavaFX (FXML)', 'Spring Boot', 'Spring JDBC', 'SQLite', 'Apache PDFBox', 'Maven', 'jpackage', 'GitHub Actions', 'BellSoft Liberica JDK'].map(tag => (
            <span key={tag} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', color: 'rgba(0,217,255,0.65)', border: '1px solid rgba(0,217,255,0.18)', padding: '0.35rem 0.85rem', borderRadius: '2px', backgroundColor: 'rgba(0,217,255,0.04)' }}>
              {tag}
            </span>
          ))}
        </div>

        {/* CTA */}
        <div className="cs-reveal opacity-0 flex flex-col sm:flex-row items-start sm:items-center gap-5 pt-8"
          style={{ borderTop: '1px solid rgba(0,217,255,0.1)' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
            This is a private project — but I&apos;m happy to talk through the engineering.
          </p>
          <a href="mailto:tanishnahata2002@gmail.com?subject=ESMON%20Project"
            className="flex items-center gap-2 shrink-0 px-6 py-3 transition-opacity duration-200 hover:opacity-80"
            style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-primary)', fontFamily: 'var(--font-body)', fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderRadius: '3px' }}>
            <Mail size={14} />
            Ask me about it
          </a>
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
