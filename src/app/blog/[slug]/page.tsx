import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BlogPostPage } from '@/presentation/features/blog/BlogPostPage';
import { getPostBySlug, getPostSlugs } from '@/lib/blog';

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  return {
    title: `${post.title} | EzySaham AI`,
    description: post.description,
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  return <BlogPostPage post={post} />;
}
