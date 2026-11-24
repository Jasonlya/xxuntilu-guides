import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  Code2,
  Layers,
  Lock,
  Server,
  ShieldCheck,
  TestTube2,
  Wallet,
} from 'lucide-react';
import { getManifest } from '@/lib/content';
import { ContinueLearning } from '@/components/ContinueLearning';

const DOMAIN_ICONS: Record<string, React.ReactNode> = {
  '1-软件测试': <TestTube2 size={15} />,
  '2-技术基础': <Server size={15} />,
  '3-业务知识': <Wallet size={15} />,
  '4-面试': <BriefcaseBusiness size={15} />,
  '5-AI与Agent': <Bot size={15} />,
  '6-前端': <Code2 size={15} />,
  '00-规范': <Layers size={15} />,
};

function hexAlpha(hex: string, alpha: string) {
  return /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${alpha}` : hex;
}

export default function HomePage() {
  const manifest = getManifest();
  const { stats, domains } = manifest;
  const mainDomains = domains.filter((domain) => domain.id !== '00-规范');
  const specDomain = domains.find((domain) => domain.id === '00-规范');
  const firstNote = domains[0]?.groups[0]?.notes[0];
  const recent = [...manifest.notes]
    .filter((note) => note.updated)
    .sort((a, b) => b.updated.localeCompare(a.updated))
    .slice(0, 8);
  const hours = Math.max(1, Math.round(stats.minutes / 60));
  const wan = (stats.chars / 10000).toFixed(1);

  return (
    <main>
      <section className="hero">
        <div className="hero-inner">
          <div>
            <span className="hero-eyebrow">
              <span style={{ width: 5, height: 5, borderRadius: 3, background: 'var(--accent)' }} />
              Obsidian 公开分享版 · {manifest.vaultCommit || 'local'}
            </span>
            <h1>
              把接口测试与 Agent 评测
              <br />
              写成<em>能照着做</em>的笔记
            </h1>
            <p>
              {stats.notes} 篇结构化笔记，按知识域组织：每篇都有「一句话 → 为什么会出问题 → 必查清单 →
              常见 bug」的骨架，清单可勾选、问答可自测，进度存在你自己的浏览器里。
            </p>
            <div className="hero-actions">
              {firstNote && (
                <Link href={`/note/${encodeURIComponent(firstNote.slug)}/`} className="btn primary">
                  开始阅读 <ArrowRight size={13} />
                </Link>
              )}
              <Link href="#domains" className="btn">
                浏览知识域
              </Link>
              <Link href="/vault/" className="btn subtle">
                <Lock size={13} /> 个人保险箱
              </Link>
            </div>
          </div>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.notes}</div>
              <div className="stat-label">公开笔记</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{wan} 万</div>
              <div className="stat-label">汉字正文</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{hours} 小时</div>
              <div className="stat-label">预计通读</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{mainDomains.length}</div>
              <div className="stat-label">知识域</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="domains">
        <div className="section-head">
          <h2 className="section-title">按知识域浏览</h2>
          <span className="section-desc">
            公开内容全部来自 Obsidian 仓库的自动同步
            {specDomain && (
              <>
                {' · '}
                <Link href={`/domain/${encodeURIComponent(specDomain.id)}/`} style={{ textDecoration: 'underline' }}>
                  库规范 {specDomain.count} 篇
                </Link>
              </>
            )}
          </span>
        </div>
        <div className="domain-grid">
          {mainDomains.map((domain) => (
            <Link
              key={domain.id}
              href={`/domain/${encodeURIComponent(domain.id)}/`}
              className="domain-card"
              style={{
                ['--accent' as string]: domain.accent,
                ['--tint' as string]: hexAlpha(domain.accent, '16'),
              }}
            >
              <div className="domain-card-head">
                <span className="domain-icon">{DOMAIN_ICONS[domain.id] || <Layers size={15} />}</span>
                <span className="domain-name">{domain.title}</span>
                <span className="domain-count">{domain.count}</span>
              </div>
              <p className="domain-desc">{domain.desc}</p>
              <div className="domain-groups">
                {domain.groups.slice(0, 4).map((group) => (
                  <span className="group-tag" key={group.id}>
                    {group.id} {group.count}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="home-split">
          <div>
            <div className="section-head">
              <h2 className="section-title">最近更新</h2>
              <span className="section-desc">按 frontmatter 的 updated 排序</span>
            </div>
            <div className="recent-list">
              {recent.map((note) => (
                <Link key={note.slug} href={`/note/${encodeURIComponent(note.slug)}/`} className="recent-row">
                  <span className="recent-title">{note.title}</span>
                  <span className="recent-domain">
                    {note.domainTitle} · {note.group}
                  </span>
                  <span className="recent-date">{note.updated}</span>
                </Link>
              ))}
            </div>
          </div>
          <div>
            <div className="section-head">
              <h2 className="section-title" style={{ fontSize: 16 }}>
                我的进度
              </h2>
            </div>
            <ContinueLearning
              totalNotes={stats.notes}
              fallback={{ slug: firstNote?.slug || '', title: firstNote?.title || '' }}
            />
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <h2 className="section-title">公开 / 私密 / 本地，三层隔离</h2>
          <span className="section-desc">不是隐藏按钮，是构建期剔除 + 密文解密</span>
        </div>
        <div className="privacy-grid">
          <div className="privacy-card">
            <h3>
              <ShieldCheck size={14} color="var(--ok)" /> 公开笔记
            </h3>
            <p>
              正常目录下、未标记 private 的笔记。同步时生成静态页面，带清单勾选、自测与学习进度，任何人可读。
            </p>
          </div>
          <div className="privacy-card">
            <h3>
              <Lock size={14} color="var(--accent)" /> 私密笔记
            </h3>
            <p>
              <code>99-Private/</code> 或 frontmatter 标 <code>private: true</code> 的笔记：默认构建期直接剔除；
              配置主密码后只发布 AES-GCM 密文，访客看到的只是一把锁。
            </p>
          </div>
          <div className="privacy-card">
            <h3>
              <Lock size={14} color="var(--warn)" /> 本地保险箱
            </h3>
            <p>
              你临时写的项目故事、Key、复盘，用主密码加密后只存在本机浏览器 LocalStorage，关页即锁定，永不上传。
            </p>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-inner">
          <span>
            © {new Date().getFullYear()} xxuntilu guides · 内容同步自私有 Obsidian 仓库 @
            {manifest.vaultCommit || 'local'}
          </span>
          <span style={{ marginLeft: 'auto' }}>
            构建于 {manifest.generatedAt ? new Date(manifest.generatedAt).toLocaleString('zh-CN') : '—'}
          </span>
        </div>
      </footer>
    </main>
  );
}
