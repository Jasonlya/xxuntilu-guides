'use client';

import Link from 'next/link';
import { ArrowRight, Clock3 } from 'lucide-react';
import { useProgress } from '@/lib/progress';
import { Ring } from './Ring';

interface Props {
  totalNotes: number;
  fallback: { slug: string; title: string };
}

export function ContinueLearning({ totalNotes, fallback }: Props) {
  const { state, ready } = useProgress();
  const last = state.last;
  const readCount = ready ? Object.keys(state.read).length : 0;
  const percent = totalNotes ? readCount / totalNotes : 0;

  if (!ready) {
    return (
      <div className="rail-card" style={{ minHeight: 92 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>读取本地学习进度…</div>
      </div>
    );
  }

  return (
    <div className="rail-card">
      <div className="rail-progress-row">
        <Ring percent={percent} size={38} stroke={3} />
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          <div style={{ fontWeight: 600, color: 'var(--ink-2)', fontSize: 13 }}>
            已读 {readCount} / {totalNotes} 篇
          </div>
          <div style={{ marginTop: 2 }}>进度只存本机浏览器</div>
        </div>
      </div>
      <Link
        href={`/note/${encodeURIComponent(last?.slug || fallback.slug)}/`}
        className="btn primary"
        style={{ width: '100%', marginTop: 12, height: 33 }}
      >
        {last ? (
          <>
            <Clock3 size={12} /> 继续：{last.title.slice(0, 16)}
            {last.title.length > 16 ? '…' : ''}
          </>
        ) : (
          <>
            从第一篇开始 <ArrowRight size={12} />
          </>
        )}
      </Link>
    </div>
  );
}
