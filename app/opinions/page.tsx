import type { Metadata } from 'next';
import OpinionsPageClient from './OpinionsPageClient';

export const metadata: Metadata = {
  title: 'Opinions — Tanish Nahata',
  description: 'Strong opinions, loosely held: notes on engineering, AI agents, and building software.',
};

export default function OpinionsPage() {
  return <OpinionsPageClient />;
}
