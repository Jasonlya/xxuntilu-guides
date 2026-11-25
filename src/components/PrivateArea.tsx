'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { FileLock2, Lock, LockOpen, Sparkles, ListChecks, FileText } from 'lucide-react';
import { useVault } from './VaultProvider';
import { Markdown } from './Markdown';
import { Checklist } from './Checklist';
import { Quiz } from './Quiz';
import { SideNav } from './SideNav';
import { extractChecklist, extractQuiz, preprocessWikiLinks, stripLeadingH1 } from '@/lib/markdown';
import type { LinkMap, NavDomain } from '@/lib/types';

interface Props {
  domains: NavDomain[];
  publicLinkmap: LinkMap;
}

export function PrivateArea({ domains, publicLinkmap }: Props) {
  const vault = useVault();
  const [activeSlug, setActiveSlug] = useState('');
  const [tab, setTab] = useState<'read' | 'check' | 'quiz'>('read');

  const notes = vault.bundle?.notes || [];
  const active = useMemo(
    () => notes.find((note) => note.slug === activeSlug) || notes[0] || null,
    [notes, activeSlug],
  );

  const processed = useMemo(() => {
    if (!active) return '';
    const map = { ...publicLinkmap, ...(vault.bundle?.linkmap || {}) };
    return stripLeadingH1(preprocessWikiLinks(active.body, map));
  }, [active, publicLinkmap, vault.bundle]);

  const checklist = useMemo(() => (active ? extractChecklist(active.body) : { items: [], fromSection: false }), [active]);
  const quiz = useMemo(() => (active ? extractQuiz(active.body) : []), [active]);
  const linkmap = useMemo(
    () => ({ ...publicLinkmap, ...(vault.bundle?.linkmap || {}) }),
    [publicLinkmap, vault.bundle],
  );

  const body = (() => {
    if (vault.status === 'loading') {
      return <div className="locked-panel">读取密文包…</div>;
    }
    if (vault.status === 'unavailable') {
      return (
        <div className="locked-panel">
          <div className="locked-icon">
            <FileLock2 size={20} />
          </div>
          <h2>私密区还没有启用</h2>
          <p>
            当前构建没有生成密文包：说明没配置 <code>VAULT_MASTER_PASSWORD</code>，或 Vault 里确实没有私密笔记。
            私密笔记只留在本地 Obsidian，不会进公开站点。
          </p>
          <Link href="/" className="btn">
            回到首页
          </Link>
        </div>
      );
    }
    if (vault.status === 'locked') {
      return (
        <div className="locked-panel">
          <div className="locked-icon">
            <Lock size={20} />
          </div>
          <h2>私密随记已加密</h2>
          <p>
            这里有 {vault.count} 篇仅自己可见的随记，整包用 AES-GCM 加密后随站点发布。
            输入主密码在浏览器本地解密，密码不会上传，关闭页面自动锁定。
          </p>
          <button type="button" className="btn primary" onClick={vault.requestUnlock}>
            <LockOpen size={13} /> 输入主密码解锁
          </button>
        </div>
      );
    }
    if (!active) {
      return <div className="tab-empty">密文包里没有笔记</div>;
    }

    return (
      <div className="private-layout">
        <div className="private-list">
          <div className="rail-title" style={{ padding: '0 8px 6px' }}>
            私密随记 · {notes.length}
          </div>
          {notes.map((note) => (
            <button
              key={note.slug}
              type="button"
              className={`private-item ${note.slug === active.slug ? 'active' : ''}`}
              onClick={() => {
                setActiveSlug(note.slug);
                setTab('read');
              }}
            >
              {note.title}
            </button>
          ))}
          <button type="button" className="btn small subtle" style={{ marginTop: 10 }} onClick={vault.lock}>
            <Lock size={11} /> 立即锁定
          </button>
        </div>

        <article>
          <div className="meta-row" style={{ marginBottom: 10 }}>
            <span className="chip accent">
              <Lock size={9} /> 仅本机解密
            </span>
            <span className="chip ghost">{active.meta.domainTitle}</span>
            <span className="chip ghost">更新 {active.meta.updated}</span>
          </div>
          <h1 className="note-title" style={{ fontSize: 26 }}>
            {active.title}
          </h1>
          {active.meta.summary && <p className="note-summary">{active.meta.summary}</p>}

          <div className="tabs" style={{ marginTop: 14 }}>
            <button
              type="button"
              className={`tab ${tab === 'read' ? 'active' : ''}`}
              onClick={() => setTab('read')}
            >
              <FileText size={13} /> 原文
            </button>
            <button
              type="button"
              className={`tab ${tab === 'check' ? 'active' : ''}`}
              onClick={() => setTab('check')}
            >
              <ListChecks size={13} /> 清单
              {checklist.items.length > 0 && <span className="tab-badge">{checklist.items.length}</span>}
            </button>
            <button
              type="button"
              className={`tab ${tab === 'quiz' ? 'active' : ''}`}
              onClick={() => setTab('quiz')}
            >
              <Sparkles size={13} /> 自测
              {quiz.length > 0 && <span className="tab-badge">{quiz.length}</span>}
            </button>
          </div>

          {tab === 'read' && <Markdown source={processed} />}
          {tab === 'check' && (
            <Checklist slug={`private:${active.slug}`} items={checklist.items} fromSection={checklist.fromSection} />
          )}
          {tab === 'quiz' && <Quiz slug={`private:${active.slug}`} items={quiz} />}
        </article>
      </div>
    );
  })();

  return (
    <div className="layout">
      <SideNav domains={domains} />
      <div className="content-col">
        <div className="domain-page">{body}</div>
      </div>
    </div>
  );
}
