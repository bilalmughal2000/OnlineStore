import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { api } from '@/lib/api';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  try {
    const { page } = await api.page(params.slug);
    return { title: page.title };
  } catch {
    return { title: 'Page' };
  }
}

export default async function StaticPage({ params }: { params: { slug: string } }) {
  let page;
  try {
    page = (await api.page(params.slug)).page;
  } catch {
    notFound();
  }
  return (
    <div className="container-x max-w-3xl py-12">
      <h1 className="mb-6 font-serif text-4xl font-bold">{page!.title}</h1>
      <div className="prose max-w-none text-ink/80" dangerouslySetInnerHTML={{ __html: page!.content }} />
    </div>
  );
}
