'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Copy, Check, ArrowUpRight, FileText } from 'lucide-react';

const EMAIL = 'tanishnahata2002@gmail.com';

function IconGitHub({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function IconLinkedIn({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function IconX({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.736l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const SOCIALS = [
  {
    icon: IconGitHub,
    label: 'GitHub',
    href: 'https://github.com/tnahata',
  },
  {
    icon: IconLinkedIn,
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/tanish-nahata',
  },
  {
    icon: IconX,
    label: 'X',
    href: 'https://x.com/NahataTanish',
  },
];

const NAV = [
  { label: 'About', href: '#about' },
  { label: 'Projects', href: '#projects' },
  { label: 'Contact', href: '#contact' },
];

export default function Footer() {
  const [copied, setCopied] = useState(false);

  const copyEmail = useCallback(() => {
    navigator.clipboard.writeText(EMAIL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return (
    <footer
      id="contact"
      style={{
        backgroundColor: 'var(--color-primary)',
        borderTop: '1px solid rgba(0,217,255,0.12)',
        boxShadow: '0 -1px 0 0 rgba(0,217,255,0.06)',
        fontFamily: 'var(--font-body)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle background glyph */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: '-2rem',
          bottom: '-3rem',
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(12rem, 28vw, 22rem)',
          fontWeight: 700,
          color: 'rgba(0,217,255,0.025)',
          lineHeight: 1,
          userSelect: 'none',
          pointerEvents: 'none',
          letterSpacing: '-0.05em',
        }}
      >
        ∞
      </div>

      {/* Main content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'clamp(4rem,8vw,7rem) clamp(1.5rem,5vw,3rem) 0' }}>

        {/* Top section — CTA left, links right */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'clamp(3rem,6vw,5rem)',
            alignItems: 'flex-start',
          }}
        >

          {/* Left: CTA block */}
          <div>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                letterSpacing: '0.25em',
                color: 'var(--color-accent)',
                textTransform: 'uppercase',
                marginBottom: '1.25rem',
                opacity: 0.8,
              }}
            >
              Open to opportunities
            </p>

            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(3rem, 7vw, 5.5rem)',
                fontWeight: 700,
                lineHeight: 0.95,
                letterSpacing: '-0.03em',
                color: 'var(--color-text)',
                marginBottom: '1.75rem',
              }}
            >
              Let&rsquo;s
              <br />
              talk.
            </h2>

            <p
              style={{
                color: 'var(--color-text-muted)',
                fontSize: '0.9rem',
                lineHeight: 1.85,
                maxWidth: '360px',
                marginBottom: '2.25rem',
              }}
            >
              Open to new roles, working on interesting projects, and conversations
              about AI agents or agentic workflows. If you&rsquo;re
              building something interesting, I want to hear about it.
            </p>

            <a
              href={`mailto:${EMAIL}`}
              className="footer-cta"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: 'var(--color-accent)',
                color: 'var(--color-primary)',
                fontWeight: 600,
                fontSize: '0.875rem',
                letterSpacing: '0.06em',
                padding: '0.85rem 1.75rem',
                borderRadius: '6px',
                textDecoration: 'none',
                transition: 'transform 200ms ease, box-shadow 200ms ease, opacity 200ms ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 8px 32px rgba(0,217,255,0.3)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = 'none';
              }}
            >
              Send a message
              <ArrowUpRight size={16} strokeWidth={2.5} />
            </a>
          </div>

          {/* Right: email + socials + resume */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', paddingTop: '0.5rem' }}>

            {/* Email */}
            <div>
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  letterSpacing: '0.2em',
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  marginBottom: '0.65rem',
                  opacity: 0.6,
                }}
              >
                Email
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'clamp(0.8rem,1.4vw,0.95rem)',
                    color: 'var(--color-text)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {EMAIL}
                </span>
                <button
                  onClick={copyEmail}
                  aria-label={copied ? 'Copied!' : 'Copy email'}
                  title={copied ? 'Copied!' : 'Copy email'}
                  style={{
                    background: 'none',
                    border: '1px solid rgba(245,245,245,0.12)',
                    borderRadius: '4px',
                    padding: '4px 6px',
                    cursor: 'pointer',
                    color: copied ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'color 150ms ease, border-color 150ms ease',
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => {
                    if (!copied) {
                      (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text)';
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(245,245,245,0.3)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!copied) {
                      (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)';
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(245,245,245,0.12)';
                    }
                  }}
                >
                  {copied ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} strokeWidth={2} />}
                </button>
              </div>
            </div>

            {/* Resume */}
            <div>
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  letterSpacing: '0.2em',
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  marginBottom: '0.65rem',
                  opacity: 0.6,
                }}
              >
                Resume
              </p>
              <a
                href="/Tanish_Nahata-Resume.pdf"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  textDecoration: 'none',
                  borderBottom: '1px solid rgba(245,245,245,0.15)',
                  paddingBottom: '2px',
                  transition: 'color 150ms ease, border-color 150ms ease',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-accent)';
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--color-accent)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text)';
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(245,245,245,0.15)';
                }}
              >
                <FileText size={14} strokeWidth={1.75} />
                View PDF
                <ArrowUpRight size={13} strokeWidth={2} />
              </a>
            </div>

            {/* Socials */}
            <div>
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  letterSpacing: '0.2em',
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  marginBottom: '0.9rem',
                  opacity: 0.6,
                }}
              >
                Socials
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {SOCIALS.map(({ icon: Icon, label, href }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    title={label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.5rem',
                      border: '1px solid rgba(245,245,245,0.1)',
                      borderRadius: '6px',
                      color: 'var(--color-text-muted)',
                      textDecoration: 'none',
                      transition: 'color 150ms ease, border-color 150ms ease, background 150ms ease',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLAnchorElement;
                      el.style.color = 'var(--color-accent)';
                      el.style.borderColor = 'rgba(0,217,255,0.35)';
                      el.style.background = 'rgba(0,217,255,0.05)';
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLAnchorElement;
                      el.style.color = 'var(--color-text-muted)';
                      el.style.borderColor = 'rgba(245,245,245,0.1)';
                      el.style.background = 'transparent';
                    }}
                  >
                    <Icon size={16} />
                  </a>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Glowing divider */}
        <div
          style={{
            marginTop: 'clamp(3.5rem,7vw,5.5rem)',
            height: '1px',
            background: 'linear-gradient(90deg, transparent 0%, rgba(0,217,255,0.25) 30%, rgba(99,102,241,0.2) 60%, transparent 100%)',
          }}
        />

        {/* Bottom bar */}
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
    </footer>
  );
}
