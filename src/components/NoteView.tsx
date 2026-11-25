'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Check,
  CircleDot,
  Clock,
  Copy,
  FileText,
  ListChecks,
  Network,
  PenLine,
  Sparkles,
} from 'lucide-react';
import { ScrollProgressBar, useProgress } from '@/lib/progress';
import {
  extractChecklist,
  extractHeadings,
  extractQuiz,
  extractWikiLinks,
  preprocessWikiLinks,
  sectionBody,
  stripLeadingH1,
  type Heading,
} from '@/lib/markdown';
import type { LinkMap, NavDomain, NotePayload } from '@/lib/types';
import { Markdown } from './Markdown';
import { Checklist } from './Checklist';
import { Quiz } from './Quiz';
import { Related } from './Related';
import { Ring } from './Ring';
import { SideNav } from './SideNav';

interface Props {
  note: NotePayload;
  linkmap: LinkMap;
  domains: NavDomain[];
  adjacent: { prev: { slug: string; title: string } | null; next: { slug: string; title: string } | null };
  siblings: { slug: string; title: string }[];
}

type TabKey = 'read' | 'check' | 'quiz' | 'related';

const FONT_SIZES = [14.5, 15.5, 16.5, 17.5];

/** 目录滚动高亮：状态收在自己身上，滚动时不牵连整篇文章重渲染 */
function TocRail({ headings }: { headings: Heading[] }) {
  const [active, setActive] = useState('');

  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      let current = headings[0]?.id || '';
      for (const heading of headings) {
        const el = document.getElementById(heading.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= 130) current = heading.id;
        else break;
      }
      setActive((prev) => (prev === current ? prev : current));
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [headings]);

  return (
    <div className="toc">
      {headings.map((heading) => (
        <a
          key={heading.id}
          href={`#${heading.id}`}
          className={`${heading.level === 3 ? 'level-3' : ''} ${active === heading.id ? 'active' : ''}`}
        >
          {heading.text}
        </a>
      ))}
    </div>
  );
}

export function NoteView({ note, linkmap, domains, adjacent, siblings }: Props) {
  const [tab, setTab] = useState<TabKey>('read');
  const [fontIndex, setFontIndex] = useState(1);
  const [copied, setCopied] = useState(false);
  const { isRead, markRead, checkedSet, quizMarks } = useProgress();

  const processed = useMemo(
    () => stripLeadingH1(preprocessWikiLinks(note.body, linkmap)),
    [note.body, linkmap],
  );

  // 深链到本地 Obsidian：只有本机装了 Obsidian 且库名一致才会响应，对访客无害
  const obsidianHref = useMemo(() => {
    const vaultPath = note.meta.path;
    if (!vaultPath) return '';
    const vault = process.env.NEXT_PUBLIC_OBSIDIAN_VAULT || 'Obsidian Vault';
    const file = vaultPath
      .replace(/\.md$/i, '')
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    return `obsidian://open?vault=${encodeURIComponent(vault)}&file=${file}`;
  }, [note.meta.path]);
  const headings = useMemo<Heading[]>(() => extractHeadings(note.body), [note.body]);
  const checklist = useMemo(() => extractChecklist(note.body), [note.body]);
  const quiz = useMemo(() => extractQuiz(note.body), [note.body]);
  const related = useMemo(() => {
    const section = sectionBody(note.body, '相关笔记');
    const seen = new Set<string>();
    return extractWikiLinks(section)
      .map((item) => {
        const slug = linkmap[item.target.replace(/\.md$/i, '').trim().toLowerCase()] ||
          linkmap[item.target.split('/').pop()?.replace(/\.md$/i, '').trim().toLowerCase() || ''];
        return slug ? { slug, title: item.label } : null;
      })
      .filter((item): item is { slug: string; title: string } => Boolean(item))
      .filter((item) => {
        if (item.slug === note.slug || seen.has(item.slug)) return false;
        seen.add(item.slug);
        return true;
      });
  }, [note.body, note.slug, linkmap]);

  const read = isRead(note.slug);
  const doneChecks = checkedSet(note.slug);
  const checkCount = checklist.items.filter((item) => doneChecks.has(item.index)).length;
  const marks = quizMarks(note.slug);
  const quizOk = Object.values(marks).filter((mark) => mark === 'ok').length;

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem('xxg.font') || '1');
      if (Number.isFinite(saved) && saved >= 0 && saved < FONT_SIZES.length) setFontIndex(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const changeFont = (index: number) => {
    const next = Math.max(0, Math.min(FONT_SIZES.length - 1, index));
    setFontIndex(next);
    try {
      window.localStorage.setItem('xxg.font', String(next));
    } catch {
      /* ignore */
    }
  };

  // 读完（滚动到 85%）自动记为已读，也可在右栏手动切换；
  // 只在越过阈值时写一次状态，滚动过程中不做任何 setState
  useEffect(() => {
    if (read) return undefined;
    let frame = 0;
    let done = false;

    const check = () => {
      frame = 0;
      if (done) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max >= 0.85) {
        done = true;
        markRead(note.slug, note.title, true);
      }
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(check);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, [read, markRead, note.slug, note.title]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const tabs: ({ key: TabKey; label: string; icon: React.ReactNode; badge?: number } | null)[] = [
    { key: 'read', label: '原文', icon: <FileText size={13} /> },
    checklist.items.length > 0
      ? { key: 'check' as TabKey, label: '必查清单', icon: <ListChecks size={13} />, badge: checklist.items.length }
      : null,
    { key: 'quiz', label: '自测', icon: <Sparkles size={13} />, badge: quiz.length || undefined },
    { key: 'related', label: '相关', icon: <Network size={13} /> },
  ];
  const visibleTabs = tabs.filter((item): item is { key: TabKey; label: string; icon: React.ReactNode; badge?: number } => Boolean(item));

  return (
    <>
      <ScrollProgressBar />
      <div className="layout with-rail">
        <SideNav domains={domains} activeSlug={note.slug} activeDomain={note.meta.domain} />

        <div className="content-col">
          <div className="note-wrap" style={{ ['--prose-size' as string]: `${FONT_SIZES[fontIndex]}px` }}>
            <div className="note-head">
              <div className="head-bar">
                <div className="crumbs">
                  <Link href="/">首页</Link>
                  <span>/</span>
                  <Link href={`/domain/${encodeURIComponent(note.meta.domain)}/`}>{note.meta.domainTitle}</Link>
                  <span>/</span>
                  <span>{note.meta.group}</span>
                </div>
                {obsidianHref && (
                  <a
                    className="head-action"
                    href={obsidianHref}
                    title={`在 Obsidian 中打开：${note.meta.path}`}
                  >
                    <PenLine size={12} />
                    <span className="head-action-label">在 Obsidian 打开</span>
                  </a>
                )}
              </div>
              <h1 className="note-title">{note.title}</h1>
              {note.meta.summary && <p className="note-summary">{note.meta.summary}</p>}
              <div className="meta-row">
                {note.meta.level && <span className="chip level">{note.meta.level}</span>}
                {note.meta.id && <span className="chip mono">{note.meta.id}</span>}
                <span className="chip ghost">
                  <Clock size={11} />约 {note.meta.minutes} 分钟
                </span>
                <span className="chip ghost hide-sm">{note.meta.chars.toLocaleString('zh-CN')} 汉字</span>
                {note.meta.updated && <span className="chip ghost">更新 {note.meta.updated}</span>}
                {read && (
                  <span className="chip accent">
                    <Check size={10} /> 已读
                  </span>
                )}
              </div>
              {(note.meta.topics.length > 0 || note.meta.tags.length > 0) && (
                <div className="meta-row" style={{ marginTop: 8 }}>
                  {note.meta.topics.map((topic) => (
                    <span className="chip" key={`t-${topic}`}>
                      # {topic}
                    </span>
                  ))}
                  {note.meta.tags.slice(0, 8).map((tag) => (
                    <span className="chip ghost" key={`g-${tag}`}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="tabs" role="tablist">
              {visibleTabs.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.key}
                  className={`tab ${tab === item.key ? 'active' : ''}`}
                  onClick={() => {
                    setTab(item.key);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  {item.icon}
                  {item.label}
                  {item.badge ? <span className="tab-badge">{item.badge}</span> : null}
                </button>
              ))}
              <div className="tab-tools">
                <button type="button" className="icon-btn ghost" onClick={copyLink} title="复制本篇链接">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {tab === 'read' && <Markdown source={processed} />}
            {tab === 'check' && (
              <Checklist slug={note.slug} items={checklist.items} fromSection={checklist.fromSection} />
            )}
            {tab === 'quiz' && <Quiz slug={note.slug} items={quiz} linkmap={linkmap} />}
            {tab === 'related' && <Related note={note} related={related} siblings={siblings} />}

            <nav className="pager">
              {adjacent.prev && (
                <Link href={`/note/${encodeURIComponent(adjacent.prev.slug)}/`}>
                  <div className="pager-label">← 上一篇</div>
                  <div className="pager-title">{adjacent.prev.title}</div>
                </Link>
              )}
              {adjacent.next && (
                <Link href={`/note/${encodeURIComponent(adjacent.next.slug)}/`}>
                  <div className="pager-label">下一篇 →</div>
                  <div className="pager-title">{adjacent.next.title}</div>
                </Link>
              )}
            </nav>
          </div>
        </div>

        <aside className="rail" aria-label="目录与进度">
          {tab === 'read' && headings.length > 0 && (
            <div className="rail-block">
              <div className="rail-title">本页目录</div>
              <TocRail headings={headings} />
            </div>
          )}

          <div className="rail-block">
            <div className="rail-title">学习状态</div>
            <div className="rail-card">
              <div className="rail-progress-row">
                <Ring
                  percent={
                    checklist.items.length
                      ? checkCount / checklist.items.length
                      : quiz.length
                        ? quizOk / quiz.length
                        : 0
                  }
                  size={32}
                  stroke={3}
                />
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  {checklist.items.length > 0 ? (
                    <div>
                      清单 <b style={{ color: 'var(--ink-2)' }}>{checkCount}/{checklist.items.length}</b>
                    </div>
                  ) : (
                    <div>技术篇 · 问答链</div>
                  )}
                  {quiz.length > 0 && (
                    <div style={{ marginTop: 2 }}>
                      自测掌握 <b style={{ color: 'var(--ink-2)' }}>{quizOk}/{quiz.length}</b>
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                className={`read-btn ${read ? 'done' : ''}`}
                onClick={() => markRead(note.slug, note.title, !read)}
              >
                <CircleDot size={12} />
                {read ? '已读（点击取消）' : '标记为已读'}
              </button>
              <div className="rail-stat">
                <span>字号</span>
                <span className="mono">{FONT_SIZES[fontIndex]}px</span>
              </div>
              <div className="font-size-ctrl">
                <button type="button" onClick={() => changeFont(fontIndex - 1)} aria-label="缩小字号">
                  A−
                </button>
                <button type="button" onClick={() => changeFont(fontIndex + 1)} aria-label="放大字号">
                  A+
                </button>
              </div>
            </div>
          </div>

          <div className="rail-block">
            <div className="rail-title">继续</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {adjacent.prev && (
                <Link href={`/note/${encodeURIComponent(adjacent.prev.slug)}/`} className="related-card">
                  <div className="related-card-title" style={{ fontSize: 12.5 }}>
                    ← {adjacent.prev.title}
                  </div>
                </Link>
              )}
              {adjacent.next && (
                <Link href={`/note/${encodeURIComponent(adjacent.next.slug)}/`} className="related-card">
                  <div className="related-card-title" style={{ fontSize: 12.5 }}>
                    {adjacent.next.title} →
                  </div>
                </Link>
              )}
              <Link href={`/domain/${encodeURIComponent(note.meta.domain)}/`} className="related-card">
                <div className="related-card-title" style={{ fontSize: 12.5 }}>
                  <BookOpen size={11} style={{ verticalAlign: -1 }} /> {note.meta.domainTitle}全部笔记
                </div>
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
