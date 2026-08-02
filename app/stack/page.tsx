import type { Metadata } from 'next';
import StackPageClient from './StackPageClient';

export const metadata: Metadata = {
  title: 'Stack — Tanish Nahata',
  description: 'Languages, frameworks, and tools I use to build AI agents and full-stack systems.',
};

export default function StackPage() {
  return <StackPageClient />;
}
