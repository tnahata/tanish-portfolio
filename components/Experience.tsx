'use client';

import { useEffect, useRef } from 'react';

const ROLES = [
  {
    period: 'Dec 2025 — Present',
    title: 'Software Engineer II',
    tech: 'Java, Spring Boot, JUnit, Jenkins, GitHub Copilot',
    highlights: [
      {
        metric: '5,000+ facilities',
        detail: 'Built and shipped core platform features for an operations management system used across North America and Europe.',
      },
      {
        metric: '350+ facilities',
        detail: 'Led European operations rollout by executing production data loads, coordinating across 3 teams to ensure zero data gaps at launch.',
      },
      {
        metric: '4 major releases',
        detail: 'Led cross-team release of major features, aligning dependencies across 3 teams to deliver on schedule with zero regressions.',
      },
      {
        metric: '25+ engineers',
        detail: 'Drove adoption of AI-assisted development (GitHub Copilot), standardizing development workflows across the team.',
      },
    ],
  },
  {
    period: 'Jun 2024 — Dec 2025',
    title: 'Software Engineer',
    tech: 'Redis, Java, Spring Boot, Angular, TypeScript, Jenkins',
    highlights: [
      {
        metric: '90% fewer escalations',
        detail: 'Introduced a Redis caching layer to surface real-time UI states, eliminating data inconsistencies across operations.',
      },
      {
        metric: '100+ hrs saved',
        detail: 'Built scalable Java/Spring Boot APIs for bulk CSV ingestion, enabling operations teams across 25+ European countries to onboard facility data.',
      },
      {
        metric: '500+ managers',
        detail: 'Developed an Angular-based scheduling calendar UI used by facility managers for daily planning and operational monitoring.',
      },
    ],
  },
];

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

        <div className="flex flex-col gap-5">
          {ROLES.map((role) => (
            <div
              key={role.period}
              className="exp-reveal opacity-0 grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-10 lg:gap-16 p-8 lg:p-10"
              style={{
                border: '1px solid rgba(0,217,255,0.12)',
                borderRadius: '4px',
                backgroundColor: '#0d1230',
              }}
            >
              {/* Left — role info */}
              <div className="flex flex-col gap-4">
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
                    {role.period}
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
                      marginBottom: '0.75rem',
                    }}
                  >
                    {role.title}
                  </p>
                  <p
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.6rem',
                      color: 'var(--color-text-muted)',
                      letterSpacing: '0.04em',
                      lineHeight: 1.6,
                    }}
                  >
                    {role.tech}
                  </p>
                </div>
              </div>

              {/* Right — highlights */}
              <div className="flex flex-col justify-center gap-5">
                {role.highlights.map(({ metric, detail }) => (
                  <div key={metric} className="flex gap-5 items-start">
                    <span
                      className="shrink-0 mt-0.5"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        color: 'var(--color-accent)',
                        letterSpacing: '0.04em',
                        minWidth: '8rem',
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
          ))}
        </div>
      </div>

      <style>{`
        .exp-reveal { transform: translateY(18px); transition: opacity 0.7s ease, transform 0.7s ease; }
        .exp-reveal.exp-visible { opacity: 1 !important; transform: translateY(0); }
        .exp-reveal:nth-child(2) { transition-delay: 80ms; }
        .exp-reveal:nth-child(3) { transition-delay: 160ms; }
      `}</style>
    </section>
  );
}
