'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Lock, Search } from 'lucide-react';
import { useProgress } from '@/lib/progress';
import { useVault } from './VaultProvider';
import { useNav } from './NavContext';
import type { NavDomain } from '@/lib/types';

interface Props {
  domains: NavDomain[];
  activeSlug?: string;
  activeDomain?: string;
}

export function SideNav({ domains, activeSlug, activeDomain }: Props) {
  const { state, ready } = useProgress();
  const vault = useVault();
  const { navOpen, setNavOpen } = useNav();
  const [filter, setFilter] = useState('');
  const [openDomains, setOpenDomains] = useState<string[]>(() => {
    const initial = activeDomain || domains[0]?.id;
    return initial ? [initial] : [];
  });

  useEffect(() => {
    if (activeDomain && !openDomains.includes(activeDomain)) {
      setOpenDomains((prev) => [...prev, activeDomain]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDomain]);

  const toggleDomain = (id: string) => {
    setOpenDomains((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const keyword = filter.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!keyword) return null;
    return domains
      .flatMap((domain) =>
        domain.groups.flatMap((group) =>
          group.notes
            .filter(
              (note) =>
                note.title.toLowerCase().includes(keyword) ||
                note.tags.some((tag) => tag.toLowerCase().includes(keyword)) ||
                note.id.toLowerCase().includes(keyword),
            )
            .map((note) => ({ note, domain, group })),
        ),
      )
      .slice(0, 60);
  }, [domains, keyword]);

  return (
    <>
      {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}
      <aside className={`sidebar ${navOpen ? 'open' : ''}`} aria-label="知识目录">
      <div className="sidebar-head">
        <span className="sidebar-title">知识目录</span>
        <span className="nav-count">{domains.reduce((sum, domain) => sum + domain.count, 0)} 篇</span>
      </div>

      <label className="sidebar-filter">
        <Search size={12} color="var(--ink-4)" />
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="筛选笔记…"
          aria-label="筛选笔记"
        />
      </label>

      {filtered ? (
        filtered.length === 0 ? (
          <div className="nav-empty">没有匹配的笔记</div>
        ) : (
          <div>
            {filtered.map(({ note, domain, group }) => (
              <Link
                key={`${domain.id}-${note.slug}`}
                href={`/note/${encodeURIComponent(note.slug)}/`}
                className={`nav-link ${note.slug === activeSlug ? 'active' : ''}`}
                onClick={() => setNavOpen(false)}
              >
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {note.title}
                </span>
                <span className="nav-count" style={{ opacity: 0.8 }}>
                  {group.id}
                </span>
              </Link>
            ))}
          </div>
        )
      ) : (
        domains.map((domain) => {
          const open = openDomains.includes(domain.id);
          return (
            <div className="nav-domain" key={domain.id}>
              <button
                type="button"
                className="nav-domain-btn"
                onClick={() => toggleDomain(domain.id)}
                aria-expanded={open}
              >
                <ChevronRight size={12} className={`nav-caret ${open ? 'open' : ''}`} />
                <span className="nav-dot" style={{ background: domain.accent }} />
                {domain.title}
                <span className="nav-count">{domain.count}</span>
              </button>
              {open && (
                <div className="nav-groups">
                  {domain.groups.map((group) => (
                    <div key={group.id}>
                      {domain.groups.length > 1 && <span className="nav-group-title">{group.title}</span>}
                      {group.notes.map((note) => (
                        <Link
                          key={note.slug}
                          href={`/note/${encodeURIComponent(note.slug)}/`}
                          className={`nav-link ${note.slug === activeSlug ? 'active' : ''}`}
                          onClick={() => setNavOpen(false)}
                          title={note.title}
                        >
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {note.title}
                          </span>
                          {ready && state.read[note.slug] && <i className="nav-read" aria-label="已读" />}
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}

      <div className="nav-section-label">
        <Lock size={10} />
        加密区
      </div>
      {vault.status === 'unlocked' ? (
        <Link href="/private/" className="nav-link" onClick={() => setNavOpen(false)}>
          私密随记 <span className="nav-count">{vault.count}</span>
        </Link>
      ) : (
        <button type="button" className="nav-link" onClick={vault.requestUnlock} style={{ width: '100%', textAlign: 'left' }}>
          私密随记
          <span className="nav-count">
            {vault.status === 'locked' ? `${vault.count} 待解锁` : '未配置'}
          </span>
        </button>
      )}
    </aside>
    </>
  );
}
