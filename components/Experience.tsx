'use client';

import { useEffect, useRef } from 'react';

export default function Experience() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('exp-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    sectionRef.current?.querySelectorAll('.exp-reveal').forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      style={{
        backgroundColor: 'var(--color-primary-dark)',
        borderTop: '1px solid rgba(0,217,255,0.08)',
      }}
      className="relative overflow-hidden"
    >
      <div className="relative max-w-7xl mx-auto px-6 sm:px-10 lg:px-24 py-32 lg:py-44">
        <div className="exp-reveal opacity-0 mb-12 flex items-center gap-6">
          <span
            className="text-[10px] uppercase tracking-[0.35em] font-semibold"
            style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-body)' }}
          >
            02 — Experience
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(0,217,255,0.15)' }} />
        </div>

        <div
          className="exp-reveal opacity-0 grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-10 lg:gap-16 p-8 lg:p-10"
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

      <style>{`
        .exp-reveal { transform: translateY(18px); transition: opacity 0.7s ease, transform 0.7s ease; }
        .exp-reveal.exp-visible { opacity: 1 !important; transform: translateY(0); }
        .exp-reveal:nth-child(2) { transition-delay: 80ms; }
      `}</style>
    </section>
  );
}
