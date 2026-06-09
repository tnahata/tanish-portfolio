'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface PostPreview {
  title: string;
  date: string;
  excerpt: string;
  slug: string;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function LatestWriting({ posts }: { posts: PostPreview[] }) {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('lw-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 },
    );
    sectionRef.current
      ?.querySelectorAll('.lw-reveal, .lw-card')
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  if (posts.length === 0) return null;

  return (
    <section
      ref={sectionRef}
      style={{
        backgroundColor: 'var(--color-primary)',
        borderTop: '1px solid rgba(0,217,255,0.08)',
      }}
      className="relative overflow-hidden"
    >
      <div className="relative max-w-7xl mx-auto px-6 sm:px-10 lg:px-24 py-32 lg:py-44">
        <div className="lw-reveal opacity-0 mb-8 flex items-center gap-6">
          <span
            className="text-[10px] uppercase tracking-[0.35em] font-semibold"
            style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-body)' }}
          >
            03 — Latest Writing
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(0,217,255,0.15)' }} />
        </div>

        <div className="lw-reveal opacity-0 mb-16 lg:mb-20 grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-8 items-end">
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.6rem, 5vw, 4.5rem)',
              fontWeight: 700,
              color: 'var(--color-text)',
              lineHeight: 1.05,
              letterSpacing: '-0.025em',
            }}
          >
            Things I&apos;ve{' '}
            <span style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>written.</span>
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.9rem',
              lineHeight: 1.8,
              color: 'var(--color-text-muted)',
              maxWidth: '38ch',
            }}
          >
            Notes on building AI agents, engineering decisions, and lessons from shipping software.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
          {posts.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="block lw-card group">
              <div
                className="relative overflow-hidden h-full p-7 lg:p-8"
                style={{
                  backgroundColor: '#0d1230',
                  border: '1px solid rgba(0,217,255,0.12)',
                  borderRadius: '4px',
                  transition:
                    'transform 350ms cubic-bezier(0.25,0.46,0.45,0.94), box-shadow 350ms ease, border-color 350ms ease, background-color 350ms ease',
                }}
              >
                <div
                  className="absolute top-0 left-0 right-0 h-[1px] opacity-0 group-hover:opacity-100"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent, rgba(0,217,255,0.9) 50%, transparent)',
                    transition: 'opacity 350ms ease',
                  }}
                />
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.65rem',
                    color: 'rgba(0,217,255,0.45)',
                    letterSpacing: '0.12em',
                    marginBottom: '1rem',
                    display: 'block',
                  }}
                >
                  {formatDate(post.date)}
                </span>
                <h3
                  className="mb-3 group-hover:text-[#00d9ff] transition-colors duration-300"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(1.3rem, 2vw, 1.6rem)',
                    fontWeight: 700,
                    color: 'var(--color-text)',
                    lineHeight: 1.15,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {post.title}
                </h3>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.88rem',
                    lineHeight: '1.75',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  {post.excerpt}
                </p>
              </div>
            </Link>
          ))}
        </div>

        <div className="lw-reveal opacity-0 flex justify-end">
          <Link
            href="/blog"
            className="flex items-center gap-2 group transition-all duration-200 hover:gap-3"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.85rem',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--color-accent)',
            }}
          >
            <span>See all posts</span>
            <ArrowRight size={15} strokeWidth={2} />
          </Link>
        </div>
      </div>

      <style>{`
        .lw-reveal { transform: translateY(16px); transition: opacity 0.65s ease, transform 0.65s ease; }
        .lw-reveal.lw-visible { opacity: 1 !important; transform: translateY(0); }
        .lw-card { opacity: 0; transform: translateY(24px); transition: opacity 0.6s ease, transform 0.6s ease; }
        .lw-card.lw-visible { opacity: 1; transform: translateY(0); }
        .lw-card > div:hover {
          transform: translateY(-4px);
          border-color: rgba(0,217,255,0.5) !important;
          background-color: #111638 !important;
          box-shadow: 0 0 0 1px rgba(0,217,255,0.08), 0 12px 40px rgba(0,0,0,0.45), 0 0 24px rgba(0,217,255,0.07);
        }
      `}</style>
    </section>
  );
}
