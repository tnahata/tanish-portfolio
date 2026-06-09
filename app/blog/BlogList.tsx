'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { BlogPost } from '@/lib/blog';

type PostMeta = Omit<BlogPost, 'content'>;

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function BlogCard({ post, delay }: { post: PostMeta; delay: number }) {
  return (
    <div className="blog-card group relative" style={{ animationDelay: `${delay}ms` }}>
      <Link href={`/blog/${post.slug}`} className="block h-full">
        <div
          className="relative overflow-hidden h-full flex flex-col p-7 lg:p-8"
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
            className="flex-1"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.88rem',
              lineHeight: '1.75',
              color: 'var(--color-text-muted)',
              marginBottom: '1.5rem',
            }}
          >
            {post.excerpt}
          </p>

          <div
            className="flex items-center gap-1.5 transition-all duration-200 group-hover:gap-2.5"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.78rem',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase' as const,
              color: 'var(--color-accent)',
            }}
          >
            <span>Read</span>
            <ArrowRight size={13} strokeWidth={2} />
          </div>
        </div>
      </Link>
    </div>
  );
}

export default function BlogList({ posts }: { posts: PostMeta[] }) {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('blog-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 },
    );
    sectionRef.current
      ?.querySelectorAll('.blog-reveal, .blog-card')
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const featured = posts.find((p) => p.featured) ?? posts[0];
  const rest = posts.filter((p) => p.slug !== featured?.slug);

  return (
    <div style={{ backgroundColor: 'var(--color-primary)', minHeight: '100vh', paddingTop: '60px' }}>
      <section
        ref={sectionRef}
        style={{
          backgroundColor: 'var(--color-primary)',
          borderTop: '1px solid rgba(0,217,255,0.08)',
        }}
        className="relative overflow-hidden"
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 60% 40% at 70% 20%, rgba(99,102,241,0.05) 0%, transparent 70%)',
          }}
        />

        <div className="relative max-w-7xl mx-auto px-6 sm:px-10 lg:px-24 py-32 lg:py-44">
          <div className="blog-reveal opacity-0 mb-8 flex items-center gap-6">
            <span
              className="text-[10px] uppercase tracking-[0.35em] font-semibold"
              style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-body)' }}
            >
              03 — Blog
            </span>
            <div className="flex-1 h-px" style={{ background: 'rgba(0,217,255,0.15)' }} />
          </div>

          <div className="blog-reveal opacity-0 mb-20 lg:mb-24 grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-8 items-end">
            <h1
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
            </h1>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.9rem',
                lineHeight: 1.8,
                color: 'var(--color-text-muted)',
                maxWidth: '38ch',
              }}
            >
              Notes on building AI agents, engineering decisions, and lessons from shipping
              software.
            </p>
          </div>

          {posts.length === 0 && (
            <p
              className="blog-reveal opacity-0"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '1rem',
                color: 'var(--color-text-muted)',
              }}
            >
              No posts yet. Check back soon.
            </p>
          )}

          {featured && (
            <div className="mb-5">
              <BlogCard post={featured} delay={0} />
            </div>
          )}

          {rest.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {rest.map((post, i) => (
                <BlogCard key={post.slug} post={post} delay={(i + 1) * 120} />
              ))}
            </div>
          )}
        </div>

        <style>{`
          .blog-reveal { transform: translateY(16px); transition: opacity 0.65s ease, transform 0.65s ease; }
          .blog-reveal.blog-visible { opacity: 1 !important; transform: translateY(0); }
          .blog-card { opacity: 0; transform: translateY(24px); transition: opacity 0.6s ease, transform 0.6s ease; }
          .blog-card.blog-visible { opacity: 1; transform: translateY(0); }
          .blog-card > a > div:hover {
            transform: translateY(-4px);
            border-color: rgba(0,217,255,0.5) !important;
            background-color: #111638 !important;
            box-shadow: 0 0 0 1px rgba(0,217,255,0.08), 0 12px 40px rgba(0,0,0,0.45), 0 0 24px rgba(0,217,255,0.07);
          }
        `}</style>
      </section>
    </div>
  );
}
