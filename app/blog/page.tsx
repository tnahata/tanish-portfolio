import type { Metadata } from 'next';
import { getAllPosts } from '@/lib/blog';
import BlogList from './BlogList';

export const metadata: Metadata = {
  title: 'Blog — Tanish Nahata',
  description: 'Writing about AI agents, software engineering, and building systems.',
  openGraph: {
    title: 'Blog — Tanish Nahata',
    description: 'Writing about AI agents, software engineering, and building systems.',
    url: 'https://tanishnahata.com/blog',
    siteName: 'Tanish Nahata',
    type: 'website',
  },
};

export default function BlogPage() {
  const posts = getAllPosts();

  return <BlogList posts={posts} />;
}
