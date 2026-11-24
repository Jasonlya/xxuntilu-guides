'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CornerDownLeft, FileText, Search } from 'lucide-react';
import { publicAsset } from '@/lib/vaultCrypto';
import type { SearchNote } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

let cachedIndex: SearchNote[] | null = null;

export function SearchDialog({ open, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState<SearchNote[]>(cachedIndex || []);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    if (!cachedIndex) {
      fetch(publicAsset('/search-index.json'))
        .then((res) => (res.ok ? res.json() : { notes: [] }))
        .then((data: { notes: SearchNote[] }) => {
          cachedIndex = data.notes || [];
          setIndex(cachedIndex);
        })
        .catch(() => setIndex([]));
    }
    return () => window.clearTimeout(timer);
  }, [open]);

  const results = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return [...index]
        .sort((a, b) => (b.updated || '').localeCompare(a.updated || ''))
        .slice(0, 8);
    }
    const tokens = keyword.split(/\s+/).filter(Boolean);
    return index
      .map((note) => {
        const title = note.title.toLowerCase();
        const haystack = [
          title,
          note.summary,
          note.group,
          note.domainTitle,
          note.topics.join(' '),
          note.tags.join(' '),
          note.id,
        ]
          .join(' ')
          .toLowerCase();
        let score = 0;
        for (const token of tokens) {
          if (!haystack.includes(token)) return { note, score: -1 };
          if (title.includes(token)) score += 6;
          if (note.tags.some((tag) => tag.toLowerCase().includes(token))) score += 3;
          if (note.topics.some((topic) => topic.toLowerCase().includes(token))) score += 2;
          score += 1;
        }
        return { note, score };
      })
      .filter((item) => item.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((item) => item.note);
  }, [index, query]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const go = (note: SearchNote) => {
    onClose();
    router.push(`/note/${encodeURIComponent(note.slug)}/`);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActive((prev) => Math.min(prev + 1, results.length - 1));
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActive((prev) => Math.max(prev - 1, 0));
      }
      if (event.key === 'Enter' && results[active]) {
        event.preventDefault();
        go(results[active]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, results, active, onClose]);

  if (!open) return null;

  return (
    <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="search-panel" role="dialog" aria-modal="true" aria-label="搜索笔记">
        <div className="search-input-row">
          <Search size={16} color="var(--ink-4)" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索标题、标签、主题、摘要…"
            aria-label="搜索"
          />
          <kbd>Esc</kbd>
        </div>
        <div className="search-results">
          {results.length === 0 ? (
            <div className="search-empty">没有匹配的笔记，换个关键词试试</div>
          ) : (
            results.map((note, i) => (
              <div
                key={note.slug}
                className={`search-item ${i === active ? 'active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(note)}
                role="option"
                aria-selected={i === active}
                tabIndex={-1}
              >
                <FileText size={14} color="var(--ink-4)" />
                <span className="search-item-title">{note.title}</span>
                <span className="search-item-path">
                  {note.domainTitle} · {note.group}
                </span>
              </div>
            ))
          )}
        </div>
        <div className="search-foot">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> 选择
          </span>
          <span>
            <kbd>
              <CornerDownLeft size={9} style={{ display: 'inline', verticalAlign: -1 }} />
            </kbd>{' '}
            打开
          </span>
          <span style={{ marginLeft: 'auto' }}>仅搜索公开笔记，私密内容不在索引里</span>
        </div>
      </div>
    </div>
  );
}
