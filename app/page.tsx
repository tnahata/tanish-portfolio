import { getAllPosts } from '@/lib/blog';
import HomeClient from './HomeClient';

export default function Home() {
  const posts = getAllPosts().slice(0, 3);
  const latestPosts = posts.map(({ title, date, excerpt, slug }) => ({
    title,
    date,
    excerpt,
    slug,
  }));

  return <HomeClient latestPosts={latestPosts} />;
}
