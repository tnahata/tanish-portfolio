import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { ClerkProvider } from '@clerk/nextjs';
import { BotIdClient } from 'botid/client';
import UTMTracker from '@/components/UTMTracker';
import Nav from '@/components/Nav';
import FooterBar from '@/components/FooterBar';
import './globals.css';

const PROTECTED_ROUTES = [{ path: '/api/ask', method: 'POST' }];

export const metadata: Metadata = {
  title: 'Tanish Nahata — Software Engineer',
  description: 'Building systems and AI agents. Thoughtful engineering, ambitious goals.',
  openGraph: {
    title: 'Tanish Nahata — Software Engineer',
    description: 'Software Engineer — AI Agents, Full-Stack, Startups',
    url: 'https://tanishnahata.com',
    siteName: 'Tanish Nahata',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: 'Tanish Nahata — Software Engineer',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tanish Nahata — Software Engineer',
    description: 'Software Engineer — AI Agents, Full-Stack, Startups',
    images: ['/api/og'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Computed once on the server and passed down so the client never re-derives
  // it (which could disagree with the server-rendered value at a year boundary).
  const currentYear = new Date().getFullYear();

  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <BotIdClient protect={PROTECTED_ROUTES} />
          <Nav />
          {children}
          <FooterBar year={currentYear} />
          <Analytics />
          <UTMTracker />
        </ClerkProvider>
      </body>
    </html>
  );
}
