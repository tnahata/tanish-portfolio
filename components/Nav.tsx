'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

const LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Blog', href: '/blog' },
  { label: 'Stack', href: '/stack' },
  { label: 'Opinions', href: '/opinions' },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        fontFamily: 'var(--font-body)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        backgroundColor: scrolled ? 'rgba(10,14,39,0.85)' : 'rgba(10,14,39,0.4)',
        borderBottom: scrolled ? '1px solid rgba(0,217,255,0.08)' : '1px solid transparent',
        transition: 'background-color 300ms ease, border-color 300ms ease',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-24 flex items-center justify-center h-[60px]">
        {/* Desktop links */}
        <ul className="hidden md:flex gap-8 list-none m-0 p-0">
          {LINKS.map(({ label, href }) => {
            const isActive = pathname === href;
            return (
              <li key={label}>
                <Link
                  href={href}
                  className="relative"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    letterSpacing: '0.06em',
                    color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    textDecoration: 'none',
                    transition: 'color 150ms ease',
                    paddingBottom: '4px',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text-muted)';
                    }
                  }}
                >
                  {label}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-0 right-0"
                      style={{
                        height: '1.5px',
                        backgroundColor: 'var(--color-accent)',
                        borderRadius: '1px',
                      }}
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center justify-center md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-text)',
            cursor: 'pointer',
            padding: '4px',
          }}
        >
          {open ? <X size={22} strokeWidth={1.5} /> : <Menu size={22} strokeWidth={1.5} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className="md:hidden"
          style={{
            backgroundColor: 'rgba(10,14,39,0.97)',
            borderTop: '1px solid rgba(0,217,255,0.08)',
            padding: '1.5rem clamp(1.5rem, 5vw, 3rem)',
          }}
        >
          <ul className="list-none m-0 p-0 flex flex-col gap-5">
            {LINKS.map(({ label, href }) => {
              const isActive = pathname === href;
              return (
                <li key={label}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.95rem',
                      fontWeight: 500,
                      letterSpacing: '0.04em',
                      color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)',
                      textDecoration: 'none',
                      display: 'block',
                      padding: '0.25rem 0',
                    }}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </nav>
  );
}
