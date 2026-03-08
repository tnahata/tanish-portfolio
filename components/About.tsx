'use client';

import { useEffect, useRef } from 'react';
import { Activity, BrainCircuit, Bot, Code2, Layers } from 'lucide-react';

const INTERESTS = [
  {
    icon: Activity,
    label: 'Lifting',
    detail: 'Lifting weights. Squats, deadlifts, bench press, overhead press, etc.',
  },
  {
    icon: BrainCircuit,
    label: 'Logic Puzzles',
    detail: 'Pattern recognition, constraint solving, systematic play.',
  },
  {
    icon: Bot,
    label: 'AI Agents',
    detail: 'Agents that reason, plan, and act—not just generate.',
  },
  {
    icon: Code2,
    label: 'Clean Code',
    detail: 'Clarity as a proxy for competence. Signal over noise.',
  },
  {
    icon: Layers,
    label: 'Systems Thinking',
    detail: 'Every system is a network of components.',
  },
];

export default function About() {
  const sectionRef = useRef<HTMLElement>(null);
  const itemsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('about-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    const el = sectionRef.current;
    if (el) {
      el.querySelectorAll('.about-reveal').forEach((child) => observer.observe(child));
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="about"
      ref={sectionRef}
      style={{
        backgroundColor: 'var(--color-primary)',
        borderTop: '1px solid rgba(0,217,255,0.08)',
      }}
      className="relative overflow-hidden"
    >
      {/* Subtle decorative noise overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '256px 256px',
        }}
      />

      {/* Accent vertical rule — desktop only */}
      <div
        className="absolute left-[3.5rem] top-0 bottom-0 hidden lg:block"
        style={{ width: '1px', background: 'linear-gradient(to bottom, transparent, rgba(0,217,255,0.18) 20%, rgba(0,217,255,0.18) 80%, transparent)' }}
      />

      <div className="relative max-w-7xl mx-auto px-6 sm:px-10 lg:px-24 py-32 lg:py-44">

        {/* ── TOP STRIPE: section label ── */}
        <div className="about-reveal opacity-0 mb-16 lg:mb-20 flex items-center gap-6">
          <span
            className="text-[10px] uppercase tracking-[0.35em] font-semibold"
            style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-body)' }}
          >
            01 — About
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(0,217,255,0.15)' }} />
        </div>

        {/* ── MAIN GRID: heading (left col) + body (right col) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.6fr] gap-16 lg:gap-24 items-start">

          {/* LEFT — Display heading, sticky on large screens */}
          <div className="about-reveal opacity-0 lg:sticky lg:top-28 self-start">
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text)',
                fontSize: 'clamp(2.8rem, 5.5vw, 5rem)',
                lineHeight: '1.07',
                letterSpacing: '-0.025em',
                fontWeight: 700,
              }}
            >
              The person
              <br />
              behind the
              <br />
              <span style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>code.</span>
            </h2>

            {/* Small decorative signature line */}
            <div className="mt-8 flex items-center gap-3">
              <div
                style={{
                  width: '2.5rem',
                  height: '2px',
                  background: 'var(--color-secondary)',
                }}
              />
              <span
                className="text-xs tracking-widest uppercase"
                style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}
              >
                Tanish Nahata
              </span>
            </div>
          </div>

          {/* RIGHT — Paragraphs */}
          <div className="space-y-8">
            <p
              className="about-reveal opacity-0"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text)',
                fontSize: 'clamp(1rem, 1.4vw, 1.125rem)',
                lineHeight: '1.85',
                fontWeight: 400,
              }}
            >
              I'm a software engineer obsessed with building things that feel effortless to use but are
              surgically precise underneath. My work spans full-stack development—React, Next.js, TypeScript—
              and an increasingly deep focus on{' '}
              <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
                AI agents and agentic workflows
              </span>
              . I think about AI not as a feature to bolt on but as a new substrate for
              building software altogether.
            </p>

            <p
              className="about-reveal opacity-0"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-muted)',
                fontSize: 'clamp(0.9rem, 1.2vw, 1rem)',
                lineHeight: '1.9',
              }}
            >
              My engineering philosophy borrows from systems thinking: every component has a purpose,
              every interface a contract. I built{' '}
              <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>HybridFit</span> as a
              full-stack training tracker with NextAuth, Zod validation, and Vercel-optimised performance,
              and redesigned{' '}
              <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>ESMON</span> with a
              cohesive JavaFX design system that replaced visual chaos with hierarchy and intent.
              Both projects share a conviction: great software is inevitable once the mental model is right.
            </p>

            <p
              className="about-reveal opacity-0"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-muted)',
                fontSize: 'clamp(0.9rem, 1.2vw, 1rem)',
                lineHeight: '1.9',
              }}
            >
              Outside the terminal I'm a hybrid athlete—half-marathon training, tennis, golf, soccer,
              lifting. I treat runs the same way I treat hard engineering problems: show up, stay systematic,
              trust the process. I also spend a worrying amount of time on logic puzzles and electronic music.
              These aren't hobbies; they're how I stay sharp.
            </p>
          </div>
        </div>

        {/* ── WORK ── */}
        <div className="mt-28 lg:mt-36">
          <div className="about-reveal opacity-0 mb-12 flex items-center gap-6">
            <span
              className="text-[10px] uppercase tracking-[0.35em] font-semibold"
              style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-body)' }}
            >
              Currently
            </span>
            <div className="flex-1 h-px" style={{ background: 'rgba(0,217,255,0.15)' }} />
          </div>

          <div
            className="about-reveal opacity-0 grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-10 lg:gap-16 p-8 lg:p-10"
            style={{
              border: '1px solid rgba(0,217,255,0.12)',
              borderRadius: '4px',
              backgroundColor: '#0d1230',
            }}
          >
            {/* Left — company + role */}
            <div className="flex flex-col justify-between gap-6">
              <div>
                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.6rem',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'var(--color-accent)',
                    marginBottom: '0.75rem',
                  }}
                >
                  Jun 2024 — Present
                </p>
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(1.4rem, 2.5vw, 1.9rem)',
                    fontWeight: 700,
                    color: 'var(--color-text)',
                    lineHeight: 1.1,
                    letterSpacing: '-0.02em',
                    marginBottom: '0.4rem',
                  }}
                >
                  FedEx Corp
                </h3>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.14em',
                    color: 'var(--color-secondary)',
                    fontWeight: 500,
                  }}
                >
                  Full Stack Engineer II
                </p>
              </div>
              <span
                className="inline-flex items-center gap-1.5 self-start"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.6rem',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: '#22c55e',
                }}
              >
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }} />
                Promoted Dec &apos;25
              </span>
            </div>

            {/* Right — highlights */}
            <div className="flex flex-col justify-center gap-5">
              {[
                {
                  metric: '100+ hrs saved',
                  detail: 'Built production APIs in Java Spring Boot for bulk CSV ingestion, letting 25 European countries pipe data into core logistics systems without manual entry.',
                },
                {
                  metric: '60% latency cut',
                  detail: 'Introduced a Redis caching layer that eliminated static delays and unblocked faster frontend interactions across the network.',
                },
                {
                  metric: 'AI-first workflow',
                  detail: 'Currently exploring how IDE AI agents can accelerate the development lifecycle — from documentation to code quality — at enterprise scale.',
                },
              ].map(({ metric, detail }) => (
                <div key={metric} className="flex gap-5 items-start">
                  <span
                    className="shrink-0 mt-0.5"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      color: 'var(--color-accent)',
                      letterSpacing: '0.04em',
                      minWidth: '7rem',
                    }}
                  >
                    {metric}
                  </span>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.85rem',
                      lineHeight: '1.7',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    {detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── INTERESTS ── */}
        <div className="mt-28 lg:mt-36">
          <div className="about-reveal opacity-0 mb-12 flex items-center gap-6">
            <span
              className="text-[10px] uppercase tracking-[0.35em] font-semibold"
              style={{ color: 'var(--color-secondary)', fontFamily: 'var(--font-body)' }}
            >
              My Interests
            </span>
            <div className="flex-1 h-px" style={{ background: 'rgba(99,102,241,0.15)' }} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-px"
            style={{ border: '1px solid rgba(0,217,255,0.07)', borderRadius: '2px' }}>
            {INTERESTS.map((interest, i) => {
              const Icon = interest.icon;
              return (
                <div
                  key={interest.label}
                  ref={(el) => { itemsRef.current[i] = el; }}
                  className="about-reveal opacity-0 interest-card group relative cursor-default"
                  style={{
                    padding: '2rem 1.75rem',
                    borderRight: i < INTERESTS.length - 1 ? '1px solid rgba(0,217,255,0.07)' : 'none',
                    transition: 'background 300ms ease, border-color 300ms ease',
                  }}
                >
                  {/* Hover fill overlay */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{
                      background: 'linear-gradient(135deg, rgba(0,217,255,0.04) 0%, rgba(99,102,241,0.04) 100%)',
                    }}
                  />

                  {/* Top accent line on hover */}
                  <div
                    className="absolute top-0 left-0 right-0 h-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: 'var(--color-accent)' }}
                  />

                  <div className="relative z-10">
                    {/* Icon */}
                    <div
                      className="mb-4 transition-colors duration-300"
                      style={{ color: 'rgba(0,217,255,0.4)' }}
                    >
                      <Icon
                        size={22}
                        strokeWidth={1.5}
                        className="group-hover:text-cyan-400 transition-colors duration-300"
                        style={{ color: 'inherit' }}
                      />
                    </div>

                    {/* Label */}
                    <h3
                      className="mb-2 group-hover:text-[#00d9ff] transition-colors duration-300"
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: 'var(--color-text)',
                      }}
                    >
                      {interest.label}
                    </h3>

                    {/* Detail */}
                    <p
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.78rem',
                        lineHeight: '1.6',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      {interest.detail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        .about-reveal {
          transform: translateY(18px);
          transition: opacity 0.7s ease, transform 0.7s ease;
        }
        .about-reveal.about-visible {
          opacity: 1 !important;
          transform: translateY(0);
        }
        /* Stagger each .about-reveal inside the section */
        .about-reveal:nth-child(1)  { transition-delay: 0ms; }
        .about-reveal:nth-child(2)  { transition-delay: 80ms; }
        .about-reveal:nth-child(3)  { transition-delay: 160ms; }
        .about-reveal:nth-child(4)  { transition-delay: 240ms; }
        .about-reveal:nth-child(5)  { transition-delay: 320ms; }
        .about-reveal:nth-child(6)  { transition-delay: 400ms; }
        .about-reveal:nth-child(7)  { transition-delay: 480ms; }
        .about-reveal:nth-child(8)  { transition-delay: 560ms; }
      `}</style>
    </section>
  );
}
