'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { ChevronRight, Lock, Search } from 'lucide-react';
import { useProgress } from '@/lib/progress';
import { useVault } from './VaultProvider';
import { useNav } from './NavContext';
import { SmartLink } from './SmartLink';
import type { NavDomain } from '@/lib/types';

interface Props {
  domains: NavDomain[];
  activeSlug?: string;
  activeDomain?: string;
}

export function SideNav({ domains, activeSlug, activeDomain }: Props) {
  const { state, ready } = useProgress();
  const vault = useVault();
  const { navOpen, setNavOpen, openDomains, filter, setFilter, toggleDomain, ensureDomainOpen, sidebarScroll } =
    useNav();
  const scroller = useRef<HTMLElement>(null);

  // 默认展开当前知识域；从笔记页跳到另一个域时把新域一并展开，不折叠用户已展开的
  const fallbackDomain = activeDomain || domains[0]?.id;
  useLayoutEffect(() => {
    if (openDomains === null) {
      if (fallbackDomain) ensureDomainOpen(fallbackDomain);
      return;
    }
    if (activeDomain) ensureDomainOpen(activeDomain);
    // 只在路由变化 / 首次挂载时校正，用户手动折叠当前域时不强行展开
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDomain, fallbackDomain, ensureDomainOpen]);

  const isDomainOpen = (id: string) =>
    openDomains === null ? id === fallbackDomain : openDomains.includes(id);

  /**
   * 换页前先把位置存下来。不能只靠 scroll 事件：
   * 旧侧栏从 DOM 移除时浏览器会把 scrollTop 归零并抛一次 scroll，
   * 那个 0 会覆盖掉真实位置，导致新页面「弹回头部」。
   */
  const rememberScroll = () => {
    const el = scroller.current;
    if (el) sidebarScroll.current = el.scrollTop;
  };

  // 换页时 SideNav 会重建：这里把上一次的滚动位置还原回去，避免「列表弹回头部」
  const revealedFor = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;

    const saved = sidebarScroll.current;
    if (saved !== null) el.scrollTop = saved;

    const active = el.querySelector<HTMLElement>('.nav-link.active');
    const slugChanged = activeSlug !== revealedFor.current;
    if (active && (saved === null || slugChanged)) {
      const box = el.getBoundingClientRect();
      const rect = active.getBoundingClientRect();
      const outOfView = rect.top < box.top || rect.bottom > box.bottom;
      // 首次进入、或从筛选结果跳到另一个域时，把当前文章滚到列表可视区中间
      if (saved === null || outOfView) {
        el.scrollTop += rect.top - box.top - (el.clientHeight - rect.height) / 2;
      }
    }

    revealedFor.current = activeSlug;
    sidebarScroll.current = el.scrollTop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDomains, activeSlug]);

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
      <aside
        ref={scroller}
        className={`sidebar ${navOpen ? 'open' : ''}`}
        aria-label="知识目录"
        onScroll={(event) => {
          // 元素已从 DOM 摘掉时的 scroll 是浏览器归零造成的噪音，直接忽略
          if (!event.currentTarget.isConnected) return;
          sidebarScroll.current = event.currentTarget.scrollTop;
        }}
      >
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
            <div className="nav-filtered">
              {filtered.map(({ note, domain, group }) => (
                <SmartLink
                  key={`${domain.id}-${note.slug}`}
                  href={`/note/${encodeURIComponent(note.slug)}/`}
                  className={`nav-link ${note.slug === activeSlug ? 'active' : ''}`}
                  onClick={() => {
                    rememberScroll();
                    setNavOpen(false);
                  }}
                >
                  <span className="nav-link-text">{note.title}</span>
                  <span className="nav-count" style={{ opacity: 0.8 }}>
                    {group.id}
                  </span>
                </SmartLink>
              ))}
            </div>
          )
        ) : (
          domains.map((domain) => {
            const open = isDomainOpen(domain.id);
            return (
              <div className={`nav-domain ${open ? 'open' : ''}`} key={domain.id}>
                <button
                  type="button"
                  className="nav-domain-btn"
                  onClick={() => toggleDomain(domain.id)}
                  aria-expanded={open}
                >
                  <ChevronRight size={12} className={`nav-caret ${open ? 'open' : ''}`} />
                  <span className="nav-dot" style={{ background: domain.accent }} />
                  <span className="nav-domain-name">{domain.title}</span>
                  <span className="nav-count">{domain.count}</span>
                </button>
                {open && (
                  <div className="nav-groups">
                    {domain.groups.map((group) => (
                      <div key={group.id}>
                        {domain.groups.length > 1 && (
                          <span className="nav-group-title">{group.title}</span>
                        )}
                        {group.notes.map((note) => (
                          <SmartLink
                            key={note.slug}
                            href={`/note/${encodeURIComponent(note.slug)}/`}
                            className={`nav-link ${note.slug === activeSlug ? 'active' : ''}`}
                            onClick={() => {
                              rememberScroll();
                              setNavOpen(false);
                            }}
                            title={note.title}
                          >
                            <span className="nav-link-text">{note.title}</span>
                            {ready && state.read[note.slug] && <i className="nav-read" aria-label="已读" />}
                          </SmartLink>
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
          <SmartLink href="/private/" className="nav-link" onClick={() => setNavOpen(false)}>
            私密随记 <span className="nav-count">{vault.count}</span>
          </SmartLink>
        ) : (
          <button
            type="button"
            className="nav-link"
            onClick={vault.requestUnlock}
            style={{ width: '100%', textAlign: 'left' }}
          >
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
