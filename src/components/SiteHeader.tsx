'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Github, KeyRound, Lock, PanelLeft, Search, Unlock } from 'lucide-react';
import { useProgress } from '@/lib/progress';
import { Ring } from './Ring';
import { useVault } from './VaultProvider';
import { useNav } from './NavContext';
import { SearchDialog } from './SearchDialog';

interface Props {
  totalNotes: number;
  repo: string;
}

export function SiteHeader({ totalNotes, repo }: Props) {
  const { state, ready } = useProgress();
  const vault = useVault();
  const { setNavOpen } = useNav();
  const [searchOpen, setSearchOpen] = useState(false);

  const readCount = ready ? Object.keys(state.read).length : 0;
  const percent = totalNotes > 0 ? readCount / totalNotes : 0;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      } else if (event.key === '/' && !typing) {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <button
            type="button"
            className="icon-btn ghost mobile-only"
            aria-label="打开目录"
            onClick={() => setNavOpen(true)}
          >
            <PanelLeft size={17} />
          </button>

          <Link href="/" className="brand" aria-label="回到首页">
            <span className="brand-mark">知</span>
            <span className="brand-text">
              <span className="brand-name">xxuntilu guides</span>
              <span className="brand-sub">测试 · AI 工程</span>
            </span>
          </Link>

          <div className="topbar-spacer" />

          <button type="button" className="search-trigger" onClick={() => setSearchOpen(true)}>
            <Search size={13} />
            <span>搜索笔记</span>
            <span className="search-kbd">⌘K</span>
          </button>

          <span className="progress-pill" title={`已读 ${readCount} / ${totalNotes} 篇`}>
            <Ring percent={percent} />
            <span>
              {readCount}
              <span style={{ color: 'var(--ink-4)' }}> / {totalNotes}</span>
            </span>
          </span>

          {vault.status === 'unlocked' ? (
            <button type="button" className="lock-btn unlocked" onClick={vault.lock} title="点击立即锁定">
              <Unlock size={12} />
              <span className="lock-label">已解锁（锁定）</span>
            </button>
          ) : vault.status === 'locked' ? (
            <button type="button" className="lock-btn" onClick={vault.requestUnlock}>
              <Lock size={12} />
              <span className="lock-label">私密区 {vault.count > 0 ? vault.count : ''}</span>
            </button>
          ) : null}

          <Link className="icon-btn ghost" href="/vault/" title="个人保险箱（本地加密）">
            <KeyRound size={15} />
          </Link>

          <a className="icon-btn ghost" href={repo} target="_blank" rel="noreferrer noopener" title="GitHub 仓库">
            <Github size={15} />
          </a>
        </div>
      </header>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
