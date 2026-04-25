'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ArrowRight } from 'lucide-react';

/* ─── Project Data ─────────────────────────────────────────────────────────── */
const PROJECTS = [
  {
    index: '01',
    title: 'Discovery Agent',
    subtitle: 'AI-Powered Twitter Discovery & Engagement Agent',
    description:
      'Personal productivity agent that searches Twitter for conversations worth joining, drafts replies that match your voice, and routes everything through Slack for approval before posting. The hard parts: orchestrating a multi-stage pipeline that pauses mid-execution for human decisions, enforcing cost controls before every external call, and teaching the model to write like you without claiming expertise you don\'t have.',
    tech: ['Python 3.12', 'LangGraph', 'Slack Bolt', 'Claude Haiku', 'PostgreSQL', 'pgvector', 'Docker'],
    status: 'Shipping',
    statusColor: '#6366f1',
    href: 'mailto:tanishnahata2002@gmail.com?subject=Discovery%20Agent',
    cta: 'Ask me about it',
    caseStudyLabel: 'View Case Study',
    slug: 'discovery-agent',
    visual: 'network' as const,
    featured: true,
  },
  {
    index: '02',
    title: 'ESMON',
    subtitle: 'Indian Railway Analytics Desktop App',
    description:
      'Analytics desktop app for Indian Railways that turns raw binary journey data into filterable reports, time-series charts, and multi-section PDF exports. The hard parts: parsing undocumented binary formats, keeping filter state consistent across tabs without coupling the controllers, and rendering charts offscreen to prevent JavaFX deadlocks during PDF generation.',
    tech: ['Java 21', 'JavaFX', 'Spring Boot', 'SQLite', 'Apache PDFBox', 'Maven', 'jpackage'],
    status: 'Finishing',
    statusColor: '#00d9ff',
    href: 'mailto:tanishnahata2002@gmail.com?subject=ESMON%20Project',
    cta: 'Ask me about it',
    caseStudyLabel: 'View Case Study',
    slug: 'esmon',
    visual: 'grid' as const,
    featured: false,
  },
  {
    index: '03',
    title: 'HybridFit',
    subtitle: 'Full-Stack Fitness Platform for Hybrid Athletes',
    description:
      "Training platform for hybrid athletes who don't fit neatly into one sport. The design challenge was making a complex system—multi-plan enrollment, flexible scheduling, granular workout logging—feel simple to use daily. Performance was non-negotiable: response caching and DB projections cut query load by over 99%. AI coaching recommendations are next.",
    tech: ['Next.js', 'TypeScript', 'NextAuth', 'MongoDB', 'Zod', 'Vercel', 'Puppeteer'],
    status: 'Live',
    statusColor: '#22c55e',
    href: 'https://github.com/tnahata/hybrid-fit',
    cta: 'View Project',
    caseStudyLabel: 'View Case Study',
    slug: 'hybrid-fit',
    visual: 'chart' as const,
    featured: false,
  },
];

/* ─── Abstract SVG Previews ─────────────────────────────────────────────────── */

function GridVisual() {
  return (
    <svg viewBox="0 0 280 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {[0, 1, 2, 3, 4, 5, 6].map(i => (
        <line key={`v${i}`} x1={i * 40 + 20} y1="0" x2={i * 40 + 20} y2="140"
          stroke="rgba(0,217,255,0.06)" strokeWidth="1" />
      ))}
      {[0, 1, 2, 3].map(i => (
        <line key={`h${i}`} x1="0" y1={i * 35 + 17} x2="280" y2={i * 35 + 17}
          stroke="rgba(0,217,255,0.06)" strokeWidth="1" />
      ))}
      <rect x="20" y="17" width="75" height="35" rx="2" fill="rgba(0,217,255,0.12)" />
      <rect x="100" y="17" width="40" height="35" rx="2" fill="rgba(99,102,241,0.18)" />
      <rect x="145" y="17" width="75" height="35" rx="2" fill="rgba(0,217,255,0.07)" />
      <rect x="225" y="17" width="35" height="35" rx="2" fill="rgba(99,102,241,0.10)" />
      <rect x="20" y="57" width="40" height="35" rx="2" fill="rgba(99,102,241,0.14)" />
      <rect x="65" y="57" width="115" height="35" rx="2" fill="rgba(0,217,255,0.09)" />
      <rect x="185" y="57" width="75" height="35" rx="2" fill="rgba(0,217,255,0.15)" />
      <rect x="20" y="97" width="185" height="35" rx="2" fill="rgba(0,217,255,0.06)" />
      <rect x="210" y="97" width="50" height="35" rx="2" fill="rgba(99,102,241,0.20)" />
      <rect x="20" y="17" width="6" height="6" fill="#00d9ff" opacity="0.7" />
      <rect x="145" y="57" width="4" height="4" fill="#6366f1" opacity="0.8" />
    </svg>
  );
}

function ChartVisual() {
  const path = "M20,110 C40,105 55,90 75,75 C95,60 105,80 125,55 C145,30 160,45 180,35 C200,25 215,40 235,28 C248,20 258,18 268,15";
  return (
    <svg viewBox="0 0 280 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {[0, 1, 2, 3].map(i => (
        <line key={i} x1="20" y1={20 + i * 30} x2="268" y2={20 + i * 30}
          stroke="rgba(0,217,255,0.05)" strokeWidth="1" strokeDasharray="4 4" />
      ))}
      <path d={`${path} L268,120 L20,120 Z`} fill="url(#chartGrad)" opacity="0.4" />
      <path d={path} stroke="rgba(0,217,255,0.75)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {[[75, 75], [125, 55], [180, 35], [235, 28]].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="5" fill="rgba(10,14,39,1)" stroke="rgba(0,217,255,0.7)" strokeWidth="1.5" />
          <circle cx={x} cy={y} r="2" fill="#00d9ff" />
        </g>
      ))}
      <path d="M20,125 C50,120 80,115 110,108 C140,101 160,95 190,88 C215,82 240,78 268,72"
        stroke="rgba(99,102,241,0.45)" strokeWidth="1" strokeDasharray="3 3" />
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00d9ff" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#00d9ff" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function NetworkVisual() {
  const nodes = [
    { x: 60, y: 70, r: 5, accent: true },
    { x: 140, y: 35, r: 4, accent: false },
    { x: 140, y: 105, r: 4, accent: false },
    { x: 220, y: 55, r: 5, accent: true },
    { x: 220, y: 115, r: 3, accent: false },
    { x: 170, y: 70, r: 3, accent: false },
    { x: 95, y: 38, r: 3, accent: false },
    { x: 95, y: 105, r: 3, accent: false },
  ];
  const edges = [[0, 1], [0, 2], [1, 3], [2, 3], [1, 5], [2, 5], [3, 4], [0, 6], [0, 7], [6, 1], [7, 2]];
  return (
    <svg viewBox="0 0 280 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {edges.map(([a, b], i) => (
        <line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y}
          stroke={i % 3 === 0 ? 'rgba(99,102,241,0.35)' : 'rgba(0,217,255,0.2)'} strokeWidth="1" />
      ))}
      {nodes.filter(n => n.accent).map((n, i) => (
        <circle key={`pulse-${i}`} cx={n.x} cy={n.y} r={n.r + 6}
          stroke="rgba(0,217,255,0.12)" strokeWidth="1" fill="none" />
      ))}
      {nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r={n.r}
          fill={n.accent ? '#00d9ff' : 'rgba(99,102,241,0.7)'}
          opacity={n.accent ? 0.85 : 0.6} />
      ))}
      <text x="55" y="88" fontSize="7" fill="rgba(0,217,255,0.3)" fontFamily="monospace">agent</text>
      <text x="210" y="45" fontSize="7" fill="rgba(0,217,255,0.3)" fontFamily="monospace">tool</text>
      <text x="210" y="132" fontSize="7" fill="rgba(99,102,241,0.35)" fontFamily="monospace">mem</text>
    </svg>
  );
}

const VISUALS = { grid: GridVisual, chart: ChartVisual, network: NetworkVisual };

/* ─── Card Component ─────────────────────────────────────────────────────────── */
function ProjectCard({ project, delay }: { project: typeof PROJECTS[number]; delay: number }) {
  const Visual = VISUALS[project.visual];

  return (
    <div className="proj-card group relative" style={{ animationDelay: `${delay}ms` }}>
      {/* Card shell */}
      <div
        className="relative overflow-hidden h-full flex flex-col"
        style={{
          backgroundColor: '#0d1230',
          border: '1px solid rgba(0,217,255,0.12)',
          borderRadius: '4px',
          transition: 'transform 350ms cubic-bezier(0.25,0.46,0.45,0.94), box-shadow 350ms ease, border-color 350ms ease, background-color 350ms ease',
        }}
      >
        {/* Hover glow — top edge */}
        <div className="absolute top-0 left-0 right-0 h-[1px] opacity-0 group-hover:opacity-100"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(0,217,255,0.9) 50%, transparent)', transition: 'opacity 350ms ease' }} />
        <div className="absolute top-0 left-0 w-6 h-6 pointer-events-none"
          style={{ background: 'linear-gradient(135deg, rgba(0,217,255,0.25) 0%, transparent 60%)' }} />

        {/* Visual preview — links to case study */}
        <Link href={`/projects/${project.slug}`} className="block">
          <div className="relative overflow-hidden"
            style={{
              height: project.featured ? '160px' : '130px',
              borderBottom: '1px solid rgba(0,217,255,0.08)',
              background: 'linear-gradient(180deg, rgba(0,217,255,0.03) 0%, transparent 100%)',
            }}>
            <div className="absolute inset-0 flex items-center justify-center p-4"><Visual /></div>
            <div className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none"
              style={{ background: 'linear-gradient(to bottom, transparent, #0d1230)' }} />
          </div>
        </Link>

        {/* Content — links to case study */}
        <Link href={`/projects/${project.slug}`} className="block flex-1 p-7 lg:p-8 pb-5">
          <div className="flex items-center justify-between mb-5">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'rgba(0,217,255,0.45)', letterSpacing: '0.12em' }}>
              {project.index}
            </span>
            <span className="flex items-center gap-1.5"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: project.statusColor }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: project.statusColor, display: 'inline-block', opacity: 0.8 }} />
              {project.status}
            </span>
          </div>

          <h3 className="mb-1 group-hover:text-[#00d9ff] transition-colors duration-300"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.4rem, 2.2vw, 1.75rem)', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            {project.title}
          </h3>
          <p className="mb-5"
            style={{ fontFamily: 'var(--font-body)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--color-secondary)', fontWeight: 500 }}>
            {project.subtitle}
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', lineHeight: '1.75', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
            {project.description}
          </p>
          <div className="flex flex-wrap gap-2">
            {project.tech.map(tag => (
              <span key={tag} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', letterSpacing: '0.08em', color: 'rgba(0,217,255,0.55)', border: '1px solid rgba(0,217,255,0.15)', padding: '0.2rem 0.6rem', borderRadius: '2px', backgroundColor: 'rgba(0,217,255,0.04)' }}>
                {tag}
              </span>
            ))}
          </div>
        </Link>

        {/* Footer — dual CTA */}
        <div className="px-7 lg:px-8 pb-7 lg:pb-8 pt-4 flex items-center justify-between"
          style={{ borderTop: '1px solid rgba(0,217,255,0.07)' }}>
          {/* Secondary: Case study link */}
          <Link href={`/projects/${project.slug}`}
            className="flex items-center gap-1.5 transition-all duration-200 hover:gap-2.5"
            style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}>
            <span>{project.caseStudyLabel}</span>
            <ArrowRight size={11} strokeWidth={2} />
          </Link>
          {/* Primary: CTA */}
          <a href={project.href}
            className="flex items-center gap-1.5 transition-all duration-200 hover:gap-2.5"
            style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-accent)' }}>
            <span>{project.cta}</span>
            <ArrowUpRight size={13} strokeWidth={2} />
          </a>
        </div>
      </div>
    </div>
  );
}

/* ─── Section ────────────────────────────────────────────────────────────────── */
export default function Projects() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('proj-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 }
    );
    sectionRef.current?.querySelectorAll('.proj-reveal, .proj-card').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const regularProjects = PROJECTS.filter(p => !p.featured);
  const featuredProject = PROJECTS.find(p => p.featured)!;

  return (
    <section id="projects" ref={sectionRef}
      style={{ backgroundColor: 'var(--color-primary-dark)', borderTop: '1px solid rgba(0,217,255,0.08)' }}
      className="relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 70% 20%, rgba(99,102,241,0.05) 0%, transparent 70%)' }} />

      <div className="relative max-w-7xl mx-auto px-6 sm:px-10 lg:px-24 py-32 lg:py-44">
        <div className="proj-reveal opacity-0 mb-8 flex items-center gap-6">
          <span className="text-[10px] uppercase tracking-[0.35em] font-semibold"
            style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-body)' }}>
            02 — Projects
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(0,217,255,0.15)' }} />
        </div>

        <div className="proj-reveal opacity-0 mb-20 lg:mb-24 grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-8 items-end">
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.6rem, 5vw, 4.5rem)', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.05, letterSpacing: '-0.025em' }}>
            Things I&apos;ve{' '}
            <span style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>built.</span>
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', lineHeight: 1.8, color: 'var(--color-text-muted)', maxWidth: '38ch' }}>
            Each project is a system—designed from first principles, built with precision,
            and shipped with care about every detail that the user will never notice.
          </p>
        </div>

        <div className="mb-5">
          <ProjectCard project={featuredProject} delay={0} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {regularProjects.map((project, i) => (
            <ProjectCard key={project.title} project={project} delay={(i + 1) * 120} />
          ))}
        </div>
      </div>

      <style>{`
        .proj-reveal { transform: translateY(16px); transition: opacity 0.65s ease, transform 0.65s ease; }
        .proj-reveal.proj-visible { opacity: 1 !important; transform: translateY(0); }
        .proj-card { opacity: 0; transform: translateY(24px); transition: opacity 0.6s ease, transform 0.6s ease; }
        .proj-card.proj-visible { opacity: 1; transform: translateY(0); }
        .proj-card > div:hover {
          transform: translateY(-4px);
          border-color: rgba(0,217,255,0.5) !important;
          background-color: #111638 !important;
          box-shadow: 0 0 0 1px rgba(0,217,255,0.08), 0 12px 40px rgba(0,0,0,0.45), 0 0 24px rgba(0,217,255,0.07);
        }
      `}</style>
    </section>
  );
}
