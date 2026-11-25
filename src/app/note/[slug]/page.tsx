import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { allNoteSlugs, getAdjacent, getDomain, getLinkmap, getNavDomains, getNote } from '@/lib/content';
import {
  extractWikiLinks,
  preprocessWikiLinks,
  sectionBody,
  stripLeadingH1,
} from '@/lib/markdown';

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

/** 「相关笔记」小节里的 wikilink → slug */
function resolveRelated(body: string, slug: string, linkmap: Record<string, string>) {
  const seen = new Set<string>();
  return extractWikiLinks(sectionBody(body, '相关笔记'))
    .map((item) => {
      const resolved =
        linkmap[item.target.replace(/\.md$/i, '').trim().toLowerCase()] ||
        linkmap[item.target.split('/').pop()?.replace(/\.md$/i, '').trim().toLowerCase() || ''];
      return resolved ? { slug: resolved, title: item.label } : null;
    })
    .filter((item): item is { slug: string; title: string } => Boolean(item))
    .filter((item) => {
      if (item.slug === slug || seen.has(item.slug)) return false;
      seen.add(item.slug);
      return true;
    });
}

export default async function NotePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = decodeSlug(rawSlug);
  const note = getNote(slug);
  if (!note) notFound();

  const navDomains = getNavDomains();
  const linkmap = getLinkmap();
  const domain = getDomain(note.meta.domain);
  const group = domain?.groups.find((item) => item.id === note.meta.group);
  const siblings = (group?.notes || [])
    .filter((item) => item.slug !== slug)
    .map((item) => ({ slug: item.slug, title: item.title }));

  // 正文解析、目录提取、清单/自测抽取全部在构建期做完：
  // 客户端跳转时不再需要几万字 markdown，也不用把 react-markdown 打进包里。
  const source = stripLeadingH1(preprocessWikiLinks(note.body, linkmap));
  const related = resolveRelated(note.body, slug, linkmap);


  return (
    <NoteView
      note={{ ...note, body: '' }}
      source={source}
      related={related}
      domains={navDomains}
      adjacent={getAdjacent(note.meta.domain, slug)}
      siblings={siblings}
    />
  );
}
