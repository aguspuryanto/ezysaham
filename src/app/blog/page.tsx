import { Metadata } from 'next';
import { BlogListPage } from '@/presentation/features/blog/BlogListPage';
import { getAllPosts } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'Blog | EzySaham AI',
  description: 'Analisis saham, tips trading, dan pembaruan seputar EzySaham AI.',
};

export default function Page() {
  const posts = getAllPosts();
  return <BlogListPage posts={posts} />;
}
