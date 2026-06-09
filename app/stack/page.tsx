'use client';

import { useEffect, useRef } from 'react';

const STACK_DATA = [
  {
    category: 'Languages',
    items: ['TypeScript', 'Python', 'Java', 'SQL'],
  },
  {
    category: 'Frameworks',
    items: ['Next.js', 'React', 'Spring Boot', 'FastAPI'],
  },
  {
    category: 'AI/ML',
    items: ['LangGraph', 'Claude API', 'pgvector', 'LangChain'],
  },
  {
    category: 'Infrastructure',
    items: ['Docker', 'Vercel', 'PostgreSQL', 'Redis', 'MongoDB'],
  },
  {
    category: 'Tools',
    items: ['Git', 'VS Code', 'Cursor', 'Figma'],
  },
];

export default function StackPage() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('stack-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    sectionRef.current?.querySelectorAll('.stack-reveal').forEach((el) => observer.observe(el));
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
          <div className="stack-reveal opacity-0 mb-16 lg:mb-20 flex items-center gap-6">
            <span
              className="text-[10px] uppercase tracking-[0.35em] font-semibold"
              style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-body)' }}
            >
              Stack
            </span>
            <div className="flex-1 h-px" style={{ background: 'rgba(0,217,255,0.15)' }} />
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.6fr] gap-16 lg:gap-24 items-start">
            {/* LEFT: sticky heading */}
            <div className="stack-reveal opacity-0 lg:sticky lg:top-28 self-start">
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
                Tools I{' '}
                <span style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>use.</span>
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
                  Current favorites
                </span>
              </div>
            </div>

            {/* RIGHT: grouped grid */}
            <div className="space-y-10">
              {STACK_DATA.map((group) => (
                <div key={group.category} className="stack-reveal opacity-0">
                  {/* Category label */}
                  <p
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.6rem',
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      color: 'var(--color-text-muted)',
                      marginBottom: '0.85rem',
                      opacity: 0.6,
                    }}
                  >
                    {group.category}
                  </p>

                  {/* Items grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-px"
                    style={{ border: '1px solid rgba(0,217,255,0.07)', borderRadius: '2px' }}
                  >
                    {group.items.map((item) => (
                      <div
                        key={item}
                        className="group relative cursor-default"
                        style={{
                          padding: '1.25rem 1.25rem',
                          transition: 'background 300ms ease',
                          borderRight: '1px solid rgba(0,217,255,0.07)',
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLDivElement).style.background =
                            'linear-gradient(135deg, rgba(0,217,255,0.04) 0%, rgba(99,102,241,0.04) 100%)';
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                        }}
                      >
                        {/* Top accent line on hover */}
                        <div
                          className="absolute top-0 left-0 right-0 h-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          style={{ background: 'var(--color-accent)' }}
                        />

                        <span
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: '0.88rem',
                            fontWeight: 500,
                            color: 'var(--color-text)',
                            transition: 'color 200ms ease',
                          }}
                          className="group-hover:text-[#00d9ff]"
                        >
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <style>{`
          .stack-reveal {
            transform: translateY(18px);
            transition: opacity 0.7s ease, transform 0.7s ease;
          }
          .stack-reveal.stack-visible {
            opacity: 1 !important;
            transform: translateY(0);
          }
          .stack-reveal:nth-child(1) { transition-delay: 0ms; }
          .stack-reveal:nth-child(2) { transition-delay: 80ms; }
          .stack-reveal:nth-child(3) { transition-delay: 160ms; }
          .stack-reveal:nth-child(4) { transition-delay: 240ms; }
          .stack-reveal:nth-child(5) { transition-delay: 320ms; }
          .stack-reveal:nth-child(6) { transition-delay: 400ms; }
          .stack-reveal:nth-child(7) { transition-delay: 480ms; }
        `}</style>
      </section>
    </>
  );
}
