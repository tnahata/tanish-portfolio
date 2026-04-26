import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import UTMTracker from '@/components/UTMTracker';
import './globals.css';

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
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
        <UTMTracker />
      </body>
    </html>
  );
}
