import { MDXRemote } from 'next-mdx-remote/rsc';
import VideoEmbed from '@/components/VideoEmbed';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const mdxComponents = {
  h2: (props: React.ComponentProps<'h2'>) => (
    <h2
      {...props}
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'clamp(1.6rem, 3vw, 2.2rem)',
        fontWeight: 700,
        color: 'var(--color-text)',
        lineHeight: 1.15,
        letterSpacing: '-0.02em',
        marginTop: '3rem',
        marginBottom: '1.25rem',
      }}
    />
  ),
  h3: (props: React.ComponentProps<'h3'>) => (
    <h3
      {...props}
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'clamp(1.2rem, 2.2vw, 1.5rem)',
        fontWeight: 600,
        color: 'var(--color-text)',
        lineHeight: 1.2,
        marginTop: '2.5rem',
        marginBottom: '1rem',
      }}
    />
  ),
  p: (props: React.ComponentProps<'p'>) => (
    <p
      {...props}
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: '1rem',
        lineHeight: '1.85',
        color: 'var(--color-text-muted)',
        marginBottom: '1.5rem',
      }}
    />
  ),
  a: (props: React.ComponentProps<'a'>) => (
    <a
      {...props}
      style={{
        color: 'var(--color-accent)',
        textDecoration: 'underline',
        textDecorationColor: 'rgba(0,217,255,0.3)',
        textUnderlineOffset: '3px',
        transition: 'text-decoration-color 150ms ease',
      }}
      target={props.href?.startsWith('http') ? '_blank' : undefined}
      rel={props.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
    />
  ),
  blockquote: (props: React.ComponentProps<'blockquote'>) => (
    <blockquote
      {...props}
      style={{
        borderLeft: '3px solid var(--color-accent)',
        backgroundColor: 'rgba(99,102,241,0.06)',
        padding: '1rem 1.5rem',
        margin: '2rem 0',
        borderRadius: '0 4px 4px 0',
      }}
    />
  ),
  pre: (props: React.ComponentProps<'pre'>) => (
    <pre
      {...props}
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.875rem',
        lineHeight: '1.7',
        backgroundColor: '#0d1230',
        border: '1px solid rgba(0,217,255,0.12)',
        borderRadius: '4px',
        padding: '1.25rem 1.5rem',
        overflowX: 'auto',
        margin: '2rem 0',
      }}
    />
  ),
  code: (props: React.ComponentProps<'code'>) => {
    const isInline = typeof props.children === 'string';
    if (!isInline) return <code {...props} />;
    return (
      <code
        {...props}
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.85em',
          backgroundColor: 'rgba(0,217,255,0.08)',
          color: 'var(--color-accent)',
          padding: '0.15em 0.4em',
          borderRadius: '3px',
        }}
      />
    );
  },
  img: (props: React.ComponentProps<'img'>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      alt={props.alt ?? ''}
      style={{
        width: '100%',
        borderRadius: '6px',
        border: '1px solid rgba(0,217,255,0.12)',
        margin: '2rem 0',
      }}
    />
  ),
  ul: (props: React.ComponentProps<'ul'>) => (
    <ul
      {...props}
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: '1rem',
        lineHeight: '1.85',
        color: 'var(--color-text-muted)',
        paddingLeft: '1.5rem',
        marginBottom: '1.5rem',
        listStyleType: 'disc',
      }}
    />
  ),
  ol: (props: React.ComponentProps<'ol'>) => (
    <ol
      {...props}
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: '1rem',
        lineHeight: '1.85',
        color: 'var(--color-text-muted)',
        paddingLeft: '1.5rem',
        marginBottom: '1.5rem',
        listStyleType: 'decimal',
      }}
    />
  ),
  li: (props: React.ComponentProps<'li'>) => (
    <li {...props} style={{ marginBottom: '0.5rem' }} />
  ),
  VideoEmbed,
};

export default function BlogPostView({
  title,
  date,
  readingTime,
  content,
}: {
  title: string;
  date: string;
  readingTime: string;
  content: string;
}) {
  return (
    <div style={{ backgroundColor: 'var(--color-primary)', minHeight: '100vh', paddingTop: '60px' }}>
      {/* Hero */}
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 pt-16 pb-0">
        <div className="mb-6 flex items-center gap-5">
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              color: 'rgba(0,217,255,0.7)',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
            }}
          >
            {formatDate(date)} · {readingTime}
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(0,217,255,0.15)' }} />
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2.5rem, 6vw, 5rem)',
            fontWeight: 700,
            color: 'var(--color-text)',
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            marginBottom: '1.5rem',
            maxWidth: '55ch',
          }}
        >
          {title}
        </h1>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 pt-10 pb-24 lg:pt-12 lg:pb-32">
        <MDXRemote source={content} components={mdxComponents} />
      </div>
    </div>
  );
}
