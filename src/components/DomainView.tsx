'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, Search } from 'lucide-react';
import { useProgress } from '@/lib/progress';
import { SideNav } from './SideNav';
import type { NavDomain } from '@/lib/types';

interface Props {
  domain: NavDomain;
  domains: NavDomain[];
  prevHref?: string;
  nextHref?: string;
}

export function DomainView({ domain, domains }: Props) {
  const { state, ready } = useProgress();
  const [filter, setFilter] = useState('');

  const groups = useMemo(() => {
    const keyword = filter.trim().toLowerCase();
    if (!keyword) return domain.groups;
    return domain.groups
      .map((group) => ({
        ...group,
        notes: group.notes.filter(
          (note) =>
            note.title.toLowerCase().includes(keyword) ||
            note.tags.some((tag) => tag.toLowerCase().includes(keyword)) ||
            note.summary.toLowerCase().includes(keyword),
        ),
      }))
      .filter((group) => group.notes.length > 0);
  }, [domain.groups, filter]);

  const readInDomain = ready
    ? domain.groups.flatMap((group) => group.notes).filter((note) => state.read[note.slug]).length
    : 0;

  return (
    <div className="layout">
      <SideNav domains={domains} activeDomain={domain.id} />
      <div className="content-col">
        <div className="domain-page">
          <Link href="/" className="btn small subtle" style={{ marginBottom: 16 }}>
            <ArrowLeft size={12} /> 全部知识域
          </Link>
          <h1 className="domain-title" style={{ color: domain.accent }}>
            {domain.title}
          </h1>
          <p className="domain-lead">
            {domain.desc} · 共 {domain.count} 篇，已读 {readInDomain} 篇
          </p>

          <label className="sidebar-filter" style={{ margin: '0 0 20px', maxWidth: 320 }}>
            <Search size={12} color="var(--ink-4)" />
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder={`在「${domain.title}」内筛选…`}
              aria-label="筛选本域笔记"
            />
          </label>

          {groups.length === 0 && <div className="tab-empty">没有匹配的笔记</div>}

          {groups.map((group) => (
            <section className="group-block" key={group.id}>
              <div className="group-block-head">
                <span className="group-block-title">{group.title}</span>
                <span className="group-block-count">{group.count}</span>
                <span className="group-block-line" />
              </div>
              {group.notes.map((note) => (
                <Link key={note.slug} href={`/note/${encodeURIComponent(note.slug)}/`} className="note-row">
                  <div className="note-row-main">
                    <div className="note-row-title">
                      {note.title}
                      {ready && state.read[note.slug] && <i className="read-dot" aria-label="已读" />}
                    </div>
                    <div className="note-row-summary">{note.summary}</div>
                  </div>
                  <span className="note-row-meta">
                    <Clock size={9} style={{ verticalAlign: -1 }} /> {note.minutes}m
                  </span>
                </Link>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
