import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { allNoteSlugs, getAdjacent, getDomain, getLinkmap, getManifest, getNote } from '@/lib/content';
import { NoteView } from '@/components/NoteView';

export const dynamicParams = false;

export function generateStaticParams() {
  return allNoteSlugs().map((slug) => ({ slug }));
}

/** 静态导出时非 ASCII 路由拿到的 param 可能仍是百分号编码，这里统一解码 */
function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const note = getNote(decodeSlug(slug));
  if (!note) return { title: '笔记不存在' };
  return {
    title: note.title,
    description: note.meta.summary,
    openGraph: { title: note.title, description: note.meta.summary },
  };
}

export default async function NotePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = decodeSlug(rawSlug);
  const note = getNote(slug);
  if (!note) notFound();

  const manifest = getManifest();
  const linkmap = getLinkmap();
  const domain = getDomain(note.meta.domain);
  const group = domain?.groups.find((item) => item.id === note.meta.group);
  const siblings = (group?.notes || [])
    .filter((item) => item.slug !== slug)
    .map((item) => ({ slug: item.slug, title: item.title }));

  return (
    <NoteView
      note={note}
      linkmap={linkmap}
      domains={manifest.domains}
      adjacent={getAdjacent(note.meta.domain, slug)}
      siblings={siblings}
    />
  );
}
