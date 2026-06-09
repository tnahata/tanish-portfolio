'use client';

import Link from 'next/link';

const NAV = [
  { label: 'About', href: '/#about' },
  { label: 'Projects', href: '/#projects' },
  { label: 'Blog', href: '/blog' },
  { label: 'Stack', href: '/stack' },
  { label: 'Opinions', href: '/opinions' },
  { label: 'Contact', href: '/#contact' },
];

export default function FooterBar() {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-primary)',
        borderTop: '1px solid rgba(0,217,255,0.08)',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 clamp(1.5rem,5vw,3rem)',
        }}
      >
        <div
          style={{
            height: '1px',
            background: 'linear-gradient(90deg, transparent 0%, rgba(0,217,255,0.25) 30%, rgba(99,102,241,0.2) 60%, transparent 100%)',
          }}
        />

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            padding: 'clamp(1.25rem,2.5vw,1.75rem) 0',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              color: 'var(--color-text-muted)',
              opacity: 0.45,
              letterSpacing: '0.05em',
            }}
          >
            © {new Date().getFullYear()} Tanish Nahata
          </p>

          <nav aria-label="Footer navigation">
            <ul
              style={{
                display: 'flex',
                gap: '2rem',
                listStyle: 'none',
                margin: 0,
                padding: 0,
              }}
            >
              {NAV.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.75rem',
                      color: 'var(--color-text-muted)',
                      textDecoration: 'none',
                      letterSpacing: '0.08em',
                      opacity: 0.55,
                      transition: 'opacity 150ms ease, color 150ms ease',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLAnchorElement).style.opacity = '1';
                      (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLAnchorElement).style.opacity = '0.55';
                      (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text-muted)';
                    }}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
}
