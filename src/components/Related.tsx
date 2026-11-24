'use client';

import Link from 'next/link';
import { ArrowUpRight, Link2, Network } from 'lucide-react';
import type { NotePayload } from '@/lib/types';

interface Props {
  note: NotePayload;
  related: { slug: string; title: string }[];
  siblings: { slug: string; title: string }[];
}

export function Related({ note, related, siblings }: Props) {
  const blocks: {
    key: string;
    title: string;
    icon: React.ReactNode;
    items: { slug: string; title: string }[];
  }[] = [
    { key: 'out', title: '本篇提到的笔记', icon: <Link2 size={12} />, items: related },
    { key: 'back', title: '引用了本篇的笔记', icon: <Network size={12} />, items: note.backlinks },
    { key: 'sib', title: `同目录（${note.meta.group}）`, icon: <ArrowUpRight size={12} />, items: siblings },
  ];

  return (
    <div>
      {blocks.map((block) => (
        <section className="related-block" key={block.key}>
          <div className="related-title">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {block.icon}
              {block.title}
              <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>· {block.items.length}</span>
            </span>
          </div>
          {block.items.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--ink-4)', padding: '4px 2px' }}>
              暂无——可以在 Obsidian 里用 [[双链]] 把它接进网络。
            </div>
          ) : (
            <div className="related-grid">
              {block.items.map((item) => (
                <Link key={`${block.key}-${item.slug}`} href={`/note/${encodeURIComponent(item.slug)}/`} className="related-card">
                  <div className="related-card-title">{item.title}</div>
                  <div className="related-card-meta">
                    {item.slug.startsWith('private') ? '私密' : '笔记'} · 点击阅读
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
