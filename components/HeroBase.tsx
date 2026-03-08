'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';

export default function HeroBase({ visualizer }: { visualizer: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const elements = containerRef.current?.querySelectorAll('[data-animate]');
    if (!elements) return;
    elements.forEach((el, idx) => {
      (el as HTMLElement).style.animation = `slideInUp 0.8s ease-out ${idx * 0.15}s both`;
    });
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative w-full min-h-screen overflow-hidden flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-primary)' }}
    >
      <div className="relative z-10 w-full max-w-3xl mx-auto px-6 sm:px-8 md:px-12 flex flex-col items-center justify-center">
        <h1
          data-animate
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-tight text-center mb-4 sm:mb-6 w-full"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)', letterSpacing: '-0.02em' }}
        >
          Tanish Nahata
        </h1>

        <p
          data-animate
          className="text-sm sm:text-base md:text-lg text-center mb-6 sm:mb-8 font-medium tracking-wider w-full"
          style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-body)', letterSpacing: '0.05em' }}
        >
          Software Engineer · AI Agent Builder · Electronic Music Lover · Athlete
        </p>

        <p
          data-animate
          className="text-xs sm:text-sm md:text-base leading-relaxed mb-8 sm:mb-12 text-center w-full"
          style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', lineHeight: '1.8' }}
        >
          Engineer by discipline. Builder by obsession. I work on AI-powered systems—
          agents that reason, adapt, and scale. Hybrid athlete across tennis, golf, soccer,
          lifting, and running. Music lover. Firm believer that the best products—like the
          best sets—are engineered to make you feel something.
        </p>

        <div
          data-animate
          className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-center justify-center mb-12 sm:mb-16 w-full"
        >
          <Link
            href="#projects"
            className="w-full sm:w-auto px-8 sm:px-10 py-3 sm:py-3.5 rounded-lg font-semibold transition-all duration-300 hover:shadow-lg active:scale-95 text-center"
            style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-primary)', fontFamily: 'var(--font-body)', fontSize: '0.9rem', letterSpacing: '0.05em' }}
          >
            View My Work
          </Link>
          <Link
            href="#contact"
            className="w-full sm:w-auto px-8 sm:px-10 py-3 sm:py-3.5 rounded-lg font-semibold transition-all duration-300 active:scale-95 text-center"
            style={{ border: '2px solid var(--color-accent)', color: 'var(--color-accent)', fontFamily: 'var(--font-body)', fontSize: '0.9rem', letterSpacing: '0.05em' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--color-accent)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--color-accent)'; }}
          >
            Get In Touch
          </Link>
        </div>

        <div data-animate className="w-full flex justify-center items-center pointer-events-none">
          {visualizer}
        </div>
      </div>
    </section>
  );
}
