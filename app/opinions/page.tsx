'use client';

import { useEffect, useRef } from 'react';

const OPINIONS = [
  {
    category: '',
    categoryColor: 'var(--color-accent)',
    text: 'Coming soon!',
  },
];

export default function OpinionsPage() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('op-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    sectionRef.current?.querySelectorAll('.op-reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <section
        ref={sectionRef}
        style={{ backgroundColor: 'var(--color-primary)', minHeight: '100vh', paddingTop: '60px' }}
      >
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-24 py-32 lg:py-44">
          {/* Section label */}
          <div className="op-reveal opacity-0 mb-16 lg:mb-20 flex items-center gap-6">
            <span
              className="text-[10px] uppercase tracking-[0.35em] font-semibold"
              style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-body)' }}
            >
              Opinions
            </span>
            <div className="flex-1 h-px" style={{ background: 'rgba(0,217,255,0.15)' }} />
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.6fr] gap-16 lg:gap-24 items-start">
            {/* LEFT: sticky heading */}
            <div className="op-reveal opacity-0 lg:sticky lg:top-28 self-start">
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
                Things I{' '}
                <span style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>believe.</span>
              </h2>

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
                  Strong opinions, loosely held
                </span>
              </div>
            </div>

            {/* RIGHT: opinion list */}
            <div>
              {OPINIONS.map((opinion, i) => {
                const ordinal = String(i + 1).padStart(2, '0');
                return (
                  <div
                    key={i}
                    className="op-reveal opacity-0"
                    style={{
                      display: 'flex',
                      gap: '1.5rem',
                      alignItems: 'flex-start',
                      padding: '2rem 0',
                      borderBottom: i < OPINIONS.length - 1 ? '1px solid rgba(0,217,255,0.06)' : 'none',
                    }}
                  >
                    {/* Ordinal */}
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'clamp(2rem, 3.5vw, 2.8rem)',
                        fontWeight: 500,
                        color: 'rgba(0,217,255,0.12)',
                        lineHeight: 1,
                        flexShrink: 0,
                        minWidth: '3rem',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {ordinal}
                    </span>

                    <div style={{ flex: 1 }}>
                      {/* Category tag */}
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.6rem',
                          letterSpacing: '0.2em',
                          textTransform: 'uppercase',
                          color: opinion.categoryColor,
                          marginBottom: '0.6rem',
                          display: 'inline-block',
                        }}
                      >
                        {opinion.category}
                      </span>

                      {/* Statement */}
                      <p
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 'clamp(0.95rem, 1.4vw, 1.1rem)',
                          fontWeight: 600,
                          color: 'var(--color-text)',
                          lineHeight: 1.65,
                        }}
                      >
                        {opinion.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <style>{`
          .op-reveal {
            transform: translateY(18px);
            transition: opacity 0.7s ease, transform 0.7s ease;
          }
          .op-reveal.op-visible {
            opacity: 1 !important;
            transform: translateY(0);
          }
          .op-reveal:nth-child(1) { transition-delay: 0ms; }
          .op-reveal:nth-child(2) { transition-delay: 80ms; }
          .op-reveal:nth-child(3) { transition-delay: 160ms; }
          .op-reveal:nth-child(4) { transition-delay: 240ms; }
          .op-reveal:nth-child(5) { transition-delay: 320ms; }
          .op-reveal:nth-child(6) { transition-delay: 400ms; }
          .op-reveal:nth-child(7) { transition-delay: 480ms; }
          .op-reveal:nth-child(8) { transition-delay: 560ms; }
          .op-reveal:nth-child(9) { transition-delay: 640ms; }
        `}</style>
      </section>
    </>
  );
}
