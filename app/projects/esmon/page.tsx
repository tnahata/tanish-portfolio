import type { Metadata } from 'next';
import { Mail } from 'lucide-react';

export const metadata: Metadata = {
  title: 'ESMON — Tanish Nahata',
  description: 'Analytics desktop app for Indian Railways that turns raw binary journey data into filterable reports, time-series charts, and PDF exports.',
};

/* ─── Hero SVG: ESMON System Architecture ──────────────────────────────────── */

/** Column geometry for the pipeline row. */
const ARCH_COL_W = 136;
const ARCH_COLS = [
  { x: 42, label: 'SOURCES' },
  { x: 212, label: 'PARSE' },
  { x: 382, label: 'STORE' },
  { x: 552, label: 'QUERY' },
  { x: 722, label: 'OUTPUT' },
];

/** Vertical slots for stacked boxes within a column. */
const ARCH_ROWS = [148, 212, 276];
const ARCH_BOX_H = 52;

function ArchBox({ col, row, title, sub }: { col: number; row: number; title: string; sub: string }) {
  const x = ARCH_COLS[col].x;
  const y = ARCH_ROWS[row];
  return (
    <g>
      <rect x={x} y={y} width={ARCH_COL_W} height={ARCH_BOX_H} rx="3"
        fill="#0d1230" stroke="rgba(0,217,255,0.15)" strokeWidth="1" />
      <rect x={x} y={y} width="2" height={ARCH_BOX_H} rx="1" fill="rgba(0,217,255,0.35)" />
      <text x={x + 14} y={y + 22} fontSize="10" fill="rgba(245,245,245,0.75)" fontFamily="monospace">{title}</text>
      <text x={x + 14} y={y + 38} fontSize="8" fill="rgba(245,245,245,0.35)" fontFamily="monospace">{sub}</text>
    </g>
  );
}

/** Horizontal connector between two adjacent columns, centred on the middle row. */
function ArchArrow({ fromCol }: { fromCol: number }) {
  const start = ARCH_COLS[fromCol].x + ARCH_COL_W + 4;
  const end = ARCH_COLS[fromCol + 1].x - 4;
  const y = ARCH_ROWS[1] + ARCH_BOX_H / 2;
  return (
    <g>
      <line x1={start} y1={y} x2={end - 7} y2={y} stroke="rgba(0,217,255,0.3)" strokeWidth="1.5" />
      <polygon points={`${end - 7},${y - 4} ${end},${y} ${end - 7},${y + 4}`} fill="rgba(0,217,255,0.45)" />
    </g>
  );
}

function ESMONArchitectureVisual() {
  return (
    <svg viewBox="0 0 900 440" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="900" height="440" fill="#080c1f" />

      {/* Title strip */}
      <rect width="900" height="36" fill="#0d1230" />
      <rect y="36" width="900" height="1" fill="rgba(0,217,255,0.12)" />
      <text x="24" y="23" fontSize="11" fill="rgba(245,245,245,0.6)" fontFamily="monospace" letterSpacing="1">ESMON · System Architecture</text>
      <circle cx="682" cy="18" r="3" fill="#22c55e" opacity="0.7" />
      <text x="876" y="22" textAnchor="end" fontSize="8" fill="rgba(34,197,94,0.65)" fontFamily="monospace">Local · Offline · No server dependency</text>

      {/* ── Presentation layer ── */}
      <rect x="42" y="52" width="816" height="62" rx="3"
        fill="rgba(99,102,241,0.06)" stroke="rgba(99,102,241,0.22)" strokeWidth="1" />
      <text x="56" y="70" fontSize="8" fill="#818cf8" fontFamily="monospace" letterSpacing="2">DESKTOP UI</text>

      {/* Tab chips */}
      {['Import', 'Reports', 'Graphs', 'Export', 'Data'].map((tab, i) => {
        const x = 150 + i * 84;
        return (
          <g key={tab}>
            <rect x={x} y={60} width="74" height="20" rx="2"
              fill="rgba(99,102,241,0.1)" stroke="rgba(99,102,241,0.2)" strokeWidth="1" />
            <text x={x + 37} y={74} textAnchor="middle" fontSize="8" fill="rgba(245,245,245,0.5)" fontFamily="monospace">{tab}</text>
          </g>
        );
      })}

      {/* Shared filter state, bracketing only the tabs that consume it */}
      <line x1="234" y1="84" x2="234" y2="92" stroke="rgba(99,102,241,0.35)" strokeWidth="1" />
      <line x1="476" y1="84" x2="476" y2="92" stroke="rgba(99,102,241,0.35)" strokeWidth="1" />
      <line x1="234" y1="92" x2="476" y2="92" stroke="rgba(99,102,241,0.35)" strokeWidth="1" />
      <text x="490" y="96" fontSize="8" fill="#818cf8" fontFamily="monospace">one filter context, shared across every consuming tab</text>

      {/* UI → pipeline: import is triggered from the UI */}
      <line x1="110" y1="114" x2="110" y2="134" stroke="rgba(0,217,255,0.25)" strokeWidth="1.5" strokeDasharray="3 3" />
      <polygon points="106,134 110,141 114,134" fill="rgba(0,217,255,0.4)" />

      {/* pipeline → UI: results render back into the tabs */}
      <line x1="620" y1="141" x2="620" y2="121" stroke="rgba(0,217,255,0.25)" strokeWidth="1.5" strokeDasharray="3 3" />
      <polygon points="616,121 620,114 624,121" fill="rgba(0,217,255,0.4)" />

      {/* ── Column headers ── */}
      {ARCH_COLS.map(({ x, label }) => (
        <text key={label} x={x} y="136" fontSize="8" fill="rgba(0,217,255,0.75)" fontFamily="monospace" letterSpacing="2">{label}</text>
      ))}

      {/* ── Pipeline flow ── */}
      <ArchBox col={0} row={0} title="Removable media" sub="SD card · USB drive" />
      <ArchBox col={0} row={1} title="Direct device" sub="Serial connection" />
      <ArchBox col={0} row={2} title="Backup archive" sub="Restore prior state" />

      <ArchBox col={1} row={0} title="Binary decoders" sub="Multiple record formats" />
      <ArchBox col={1} row={1} title="Integrity checks" sub="Framing · checksums" />
      <ArchBox col={1} row={2} title="Derived metrics" sub="Computed on ingest" />

      <ArchBox col={2} row={0} title="Embedded database" sub="Single local file" />
      <ArchBox col={2} row={1} title="Transactional writes" sub="All or nothing import" />
      <ArchBox col={2} row={2} title="Versioned schema" sub="Created on first run" />

      <ArchBox col={3} row={0} title="Filtered reads" sub="Paginated result sets" />
      <ArchBox col={3} row={1} title="Series downsampling" sub="Large spans stay smooth" />
      <ArchBox col={3} row={2} title="Aggregations" sub="Journey level rollups" />

      <ArchBox col={4} row={0} title="PDF reports" sub="Offscreen chart render" />
      <ArchBox col={4} row={1} title="In-app preview" sub="Review before saving" />
      <ArchBox col={4} row={2} title="Tabular exports" sub="Spreadsheet · delimited" />

      {/* Connectors */}
      {[0, 1, 2, 3].map(i => <ArchArrow key={i} fromCol={i} />)}

      {/* ── Footer note ── */}
      <line x1="42" y1="356" x2="858" y2="356" stroke="rgba(0,217,255,0.08)" strokeWidth="1" />
      <text x="42" y="378" fontSize="8" fill="rgba(245,245,245,0.35)" fontFamily="monospace">
        Imports, exports and device downloads run on background workers. The interface stays responsive throughout.
      </text>
      <text x="42" y="398" fontSize="8" fill="rgba(245,245,245,0.28)" fontFamily="monospace">
        Nothing leaves the machine. No network calls, no remote storage, no telemetry.
      </text>

      {/* Runtime badge */}
      <rect x="700" y="366" width="158" height="34" rx="3"
        fill="rgba(0,217,255,0.04)" stroke="rgba(0,217,255,0.12)" strokeWidth="1" />
      <text x="714" y="380" fontSize="8" fill="rgba(0,217,255,0.75)" fontFamily="monospace">Ships as native installers</text>
      <text x="714" y="392" fontSize="7" fill="rgba(245,245,245,0.3)" fontFamily="monospace">Windows · macOS · one pipeline</text>
    </svg>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */
export default function ESMONPage() {
  return (
    <div style={{ backgroundColor: 'var(--color-primary)', minHeight: '100vh', paddingTop: '60px' }}>

      {/* ── Hero ── */}
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 pt-16 pb-0">
        <div className="mb-6 flex items-center gap-5">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'rgba(0,217,255,0.75)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Indian Railway · Desktop App · Java
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(0,217,255,0.1)' }} />
          <span className="flex items-center gap-1.5"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#00d9ff', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#00d9ff', display: 'inline-block' }} />
            Beta
          </span>
        </div>

        <h1 className=""
          style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(3rem, 7vw, 6.5rem)', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.0, letterSpacing: '-0.03em', marginBottom: '1rem' }}>
          ESMON
        </h1>
        <p className="mb-10"
          style={{ fontFamily: 'var(--font-body)', fontSize: 'clamp(1rem, 1.5vw, 1.2rem)', color: 'var(--color-text-muted)', maxWidth: '55ch', lineHeight: 1.6 }}>
          Desktop analytics platform for the Indian Railway Speed and Energy Monitoring System.
        </p>

        {/* Hero visual — the diagram is dense, so it pans horizontally rather than
            shrinking past the point where its labels stay legible. */}
        <div className="relative overflow-x-auto"
          style={{ borderRadius: '6px', border: '1px solid rgba(0,217,255,0.15)', boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(0,217,255,0.05)' }}>
          <div style={{ minWidth: '760px' }}>
            <ESMONArchitectureVisual />
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 py-24 lg:py-32">

        {/* Overview */}
        <div className="mb-6 flex items-center gap-5">
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: 'var(--color-accent)', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 600 }}>
            01 — Overview
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(0,217,255,0.1)' }} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-12 lg:gap-20 mb-24 items-start">
          <div className="lg:sticky lg:top-28">
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 3.5vw, 3rem)', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
              Turning binary recordings into actionable insight.
            </h2>
          </div>
          <div className="space-y-6">
            <p className="" style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', lineHeight: '1.85', color: 'var(--color-text)' }}>
              Monitoring devices on locomotives record detailed journey data (speed, energy, events) that engineers need to analyse and report on. The raw output from these devices is binary and completely unusable without software built specifically to decode it. I built the application that bridges that gap: import recordings from SD cards, USB drives, or directly from the device over a serial connection, parse them into structured data, and surface everything through filterable reports, time-series charts, and composed PDF exports with an in-app preview before saving.
            </p>
            <p className="" style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', lineHeight: '1.85', color: 'var(--color-text-muted)' }}>
              A core constraint shaped the architecture from the start: the application needs to work in environments where internet access cannot be assumed. These devices operate in remote areas, depots, and fieldwork settings. Connectivity is unreliable or simply not there. Running everything locally with no server dependency wasn&apos;t a simplification, it was a requirement. Data stays on the machine, analysis happens offline, and the tool is usable anywhere the device is.
            </p>
            <p className="" style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', lineHeight: '1.85', color: 'var(--color-text-muted)' }}>
              The people using this daily are operations engineers, not software engineers. It had to be fast, reliable, and self-explanatory. Charts downsample large datasets automatically so the interface stays responsive regardless of file size. It ships as native installers on Windows and macOS, produced from a single CI pipeline, with no manual packaging steps required.
            </p>
          </div>
        </div>

        {/* Hard Parts */}
        <div className="mb-6 flex items-center gap-5">
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: '#818cf8', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 600 }}>
            02 — The Hard Parts
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(99,102,241,0.15)' }} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-24">
          {[
            {
              num: '01',
              title: 'Binary Parsing & Data Integrity',
              body: 'The devices produce binary output in multiple formats, each with its own structure, field layout, and edge cases. Parsing binary data correctly means handling byte alignment, distinguishing between valid records and noise, and gracefully dealing with corruption: partial writes, truncated files, and malformed records that occur naturally in field conditions. The parser had to be defensive enough to recover from bad data without silently producing wrong results.',
            },
            {
              num: '02',
              title: 'Designing Without a Net',
              body: 'I had no designer, no senior to review my decisions, and no existing pattern to follow for this kind of tool. The filter system spans multiple tabs, each needing independent state but sharing the same UI panel. A non-trivial UX problem I had to reason through on my own. A lot of the design work happened in cycles of building, using it myself, noticing what felt wrong, and iterating. That process taught me more about interface design than any resource I\'ve read.',
            },
            {
              num: '03',
              title: 'PDF Generation Deadlocks',
              body: 'Embedding charts in PDFs required rendering them as images during generation, but the UI framework and the PDF pipeline have conflicting threading requirements. The rendering process needs to happen on the UI thread, while PDF generation runs in the background. Getting these two to cooperate without deadlocking, particularly on older machines, required understanding where the conflict originated and separating the rendering step from the export pipeline entirely using offscreen rendering techniques.',
            },
          ].map(({ num, title, body }) => (
            <div key={num} className="p-7"
              style={{ backgroundColor: '#0d1230', border: '1px solid rgba(0,217,255,0.1)', borderRadius: '4px' }}>
              <div className="flex items-start gap-4 mb-4">
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'rgba(0,217,255,0.75)', letterSpacing: '0.1em', marginTop: '2px' }}>{num}</span>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.2 }}>{title}</h3>
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', lineHeight: '1.75', color: 'var(--color-text-muted)' }}>{body}</p>
            </div>
          ))}
        </div>

        {/* Outcomes */}
        <div className="mb-6 flex items-center gap-5">
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: 'var(--color-accent)', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 600 }}>
            03 — Outcomes
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(0,217,255,0.1)' }} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-24">
          {[
            { metric: '0', label: 'Infrastructure to procure. No server, no accounts, no connectivity.' },
            { metric: '100%', label: 'Of journey data stays on the machine it was imported on.' },
            { metric: '1', label: 'Install to go from raw device dump to analysis. The runtime ships inside it.' },
            { metric: 'PDF', label: 'Every review ends in a document a reviewer can file, share, and act on.' },
          ].map(({ metric, label }) => (
            <div key={label} className="p-6"
              style={{ backgroundColor: '#0d1230', border: '1px solid rgba(0,217,255,0.08)', borderRadius: '4px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.5rem, 4vw, 3.5rem)', fontWeight: 700, color: 'var(--color-accent)', lineHeight: 1, letterSpacing: '-0.03em', marginBottom: '0.5rem' }}>
                {metric}
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Tech stack */}
        <div className="mb-6 flex items-center gap-5">
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: '#818cf8', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 600 }}>
            04 — Stack
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(99,102,241,0.15)' }} />
        </div>

        <div className="flex flex-wrap gap-3 mb-24">
          {['Java 17', 'JavaFX (FXML)', 'Spring Boot', 'Spring JDBC', 'SQLite', 'Apache PDFBox', 'Maven', 'jpackage', 'GitHub Actions', 'BellSoft Liberica JDK'].map(tag => (
            <span key={tag} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', color: 'rgba(0,217,255,0.75)', border: '1px solid rgba(0,217,255,0.18)', padding: '0.35rem 0.85rem', borderRadius: '2px', backgroundColor: 'rgba(0,217,255,0.04)' }}>
              {tag}
            </span>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pt-8"
          style={{ borderTop: '1px solid rgba(0,217,255,0.1)' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
            This is a private project, but I&apos;m happy to talk through the engineering.
          </p>
          <a href="mailto:tanishnahata2002@gmail.com?subject=ESMON%20Project"
            className="flex items-center gap-2 shrink-0 px-6 py-3 transition-opacity duration-200 hover:opacity-80"
            style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-primary)', fontFamily: 'var(--font-body)', fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderRadius: '3px' }}>
            <Mail size={14} />
            Ask me about it
          </a>
        </div>
      </div>

    </div>
  );
}
