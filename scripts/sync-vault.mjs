#!/usr/bin/env node
/**
 * 把 Obsidian Vault 的公开部分整理成站点可用的内容产物。
 *
 * 输入：VAULT_DIR（本地默认 ~/Documents/Obsidian Vault，CI 里是 checkout 出来的私库）
 * 输出：
 *   content/notes/<slug>.json    公开笔记正文（仅公开内容）
 *   content/manifest.json        导航树、索引、统计
 *   content/linkmap.json         wikilink -> 站内路由
 *   content/private/index.json   私密笔记（gitignore，仅供加密脚本与泄漏检查使用）
 *
 * 原则：私密笔记永远不进 content/notes 与 manifest 的可读字段。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  vaultDir,
  excludeDirs,
  publishExtensions,
  domainMeta,
  domainOrder,
  groupOrder,
  noteOrder,
} from '../config/site.config.mjs';
import { buildMeta, privacyVerdict, slugify, extractWikiTargets, hashSuffix, resolveWikiLinks } from './lib/notes.mjs';

const root = process.cwd();
const contentDir = path.join(root, 'content');
const notesDir = path.join(contentDir, 'notes');
const privateDir = path.join(contentDir, 'private');

const collator = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' });

function walk(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (excludeDirs.has(entry.name)) continue;
      walk(abs, base, out);
    } else if (entry.isFile()) {
      if (!publishExtensions.has(path.extname(entry.name).toLowerCase())) continue;
      if (path.basename(entry.name).toLowerCase() === 'readme.md' && dir === base) continue;
      out.push(path.relative(base, abs));
    }
  }
  return out;
}

function readVaultCommit() {
  try {
    return execFileSync('git', ['-C', vaultDir, 'rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function normalizeTarget(target) {
  return target
    .replace(/\\/g, '/')
    .replace(/\.md$/i, '')
    .replace(/^\/+/, '')
    .trim()
    .toLowerCase();
}

function main() {
  if (!fs.existsSync(vaultDir)) {
    console.error(`[content] 找不到 Vault：${vaultDir}`);
    console.error('[content] 请设置 VAULT_DIR 或在 config/site.config.mjs 中修改默认路径');
    process.exit(1);
  }

  fs.rmSync(notesDir, { recursive: true, force: true });
  fs.rmSync(privateDir, { recursive: true, force: true });
  fs.mkdirSync(notesDir, { recursive: true });
  fs.mkdirSync(privateDir, { recursive: true });

  const files = walk(vaultDir).sort((a, b) => collator.compare(a, b));
  const publicNotes = [];
  const privateNotes = [];
  const usedSlugs = new Set();

  for (const relPath of files) {
    const abs = path.join(vaultDir, relPath);
    let raw;
    try {
      raw = fs.readFileSync(abs, 'utf8');
    } catch (err) {
      console.warn(`[content] 读取失败，跳过 ${relPath}: ${err.message}`);
      continue;
    }

    const { data, body, meta } = buildMeta(relPath, raw);
    const verdict = privacyVerdict(relPath, data);

    const segments = relPath.split(path.sep);
    const domainId = segments.length > 1 ? segments[0] : '';
    const domain = domainMeta[domainId];
    const group = segments.length > 2 ? segments.slice(1, -1).join('/') : '总览';

    let slug = slugify(path.basename(relPath, '.md')) || `note-${hashSuffix(relPath)}`;
    if (usedSlugs.has(slug)) slug = `${slug}-${hashSuffix(relPath, 5)}`;
    usedSlugs.add(slug);

    const record = {
      ...meta,
      slug,
      domain: domainId,
      domainTitle: domain ? domain.title : '其他',
      group,
      private: verdict.private,
    };

    if (verdict.private) {
      privateNotes.push({ ...record, body, privateReason: verdict.reason });
      continue;
    }

    if (!domain) {
      // 根目录散落文件（README / 目录）没有归属知识域，不上站，避免与导航重复
      continue;
    }

    publicNotes.push({ ...record, body });
  }

  // ---- wikilink 索引：路径 / 文件名 / id 三种写法都能定位 ----
  const linkmap = {};
  const registerKey = (key, slug) => {
    if (!key) return;
    const k = normalizeTarget(key);
    if (!k) return;
    if (!linkmap[k]) linkmap[k] = slug;
  };
  for (const note of publicNotes) {
    registerKey(note.path, note.slug);
    registerKey(path.basename(note.path, '.md'), note.slug);
    registerKey(note.id, note.slug);
    registerKey(note.title, note.slug);
  }

  // ---- 反向链接：谁引用了这篇（只统计公开来源，私密来源不暴露） ----
  const backlinkMap = new Map();
  for (const note of publicNotes) {
    for (const target of extractWikiTargets(note.body)) {
      const resolved = linkmap[normalizeTarget(target)];
      if (!resolved || resolved === note.slug) continue;
      const list = backlinkMap.get(resolved) || [];
      if (!list.some((item) => item.slug === note.slug)) {
        list.push({ slug: note.slug, title: note.title });
      }
      backlinkMap.set(resolved, list);
    }
  }

  // ---- 私密目标指纹：公开笔记里指向它们的双链只留占位，不留标题 ----
  const privateKeys = new Set();
  for (const note of privateNotes) {
    const keys = [
      note.path.replace(/\.md$/i, ''),
      path.basename(note.path, '.md'),
      note.id,
      note.title,
    ];
    for (const key of keys) {
      if (key) privateKeys.add(normalizeTarget(key));
    }
  }

  // ---- 写出公开笔记 ----
  let hiddenLinks = 0;
  for (const note of publicNotes) {
    const resolved = resolveWikiLinks(note.body, linkmap, privateKeys);
    hiddenLinks += resolved.hidden;
    const payload = {
      slug: note.slug,
      title: note.title,
      body: resolved.markdown,
      meta: {
        id: note.id,
        title: note.title,
        path: note.path,
        domain: note.domain,
        domainTitle: note.domainTitle,
        group: note.group,
        level: note.level,
        category: note.category,
        topics: note.topics,
        tags: note.tags,
        apiTypes: note.apiTypes,
        scenes: note.scenes,
        updated: note.updated,
        created: note.created,
        summary: note.summary,
        chars: note.chars,
        words: note.words,
        minutes: note.minutes,
      },
      backlinks: (backlinkMap.get(note.slug) || []).sort((a, b) => collator.compare(a.title, b.title)),
    };
    fs.writeFileSync(path.join(notesDir, `${note.slug}.json`), JSON.stringify(payload));
  }

  // ---- 私密笔记落到隔离目录（不进 public，不写 manifest 标题） ----
  fs.writeFileSync(
    path.join(privateDir, 'index.json'),
    JSON.stringify(
      privateNotes.map((note) => ({
        slug: note.slug,
        title: note.title,
        body: note.body,
        privateReason: note.privateReason,
        meta: {
          title: note.title,
          path: note.path,
          domainTitle: note.domainTitle,
          group: note.group,
          level: note.level,
          topics: note.topics,
          tags: note.tags,
          updated: note.updated,
          summary: note.summary,
          minutes: note.minutes,
        },
      })),
    ),
  );

  /**
 * 组内排序键：文件名前缀里的编号（L2-07 / L1-11）决定顺序，
 * 没有编号的笔记（Redis、MySQL 这类）排到编号之后，组内按标题音序。
 * 不能用 frontmatter 的 id：有的笔记写的是 kb-method-xxx，会把顺序打乱。
 */
function seqKey(slug) {
  const m = /^([A-Za-z]+)-(\d+)/.exec(String(slug));
  return m ? `${m[1]}-${m[2].padStart(3, '0')}` : `~${slug}`;
}

/**
 * 组内排序键：文件名前缀里的编号（L2-07 / L1-11）决定顺序，
 * 没有编号的笔记（Redis、MySQL 这类）排到编号之后，组内按标题音序。
 * 不能用 frontmatter 的 id：有的笔记写的是 kb-method-xxx，会把顺序打乱。
 */
function seqKey(slug) {
  const m = /^([A-Za-z]+)-(\d+)/.exec(String(slug));
  return m ? `${m[1]}-${m[2].padStart(3, '0')}` : `~${slug}`;
}

// ---- 导航树 ----
  const domainBuckets = new Map();
  for (const note of publicNotes) {
    if (!domainBuckets.has(note.domain)) domainBuckets.set(note.domain, new Map());
    const groups = domainBuckets.get(note.domain);
    if (!groups.has(note.group)) groups.set(note.group, []);
    groups.get(note.group).push({
      slug: note.slug,
      title: note.title,
      id: note.id,
      seq: seqKey(note.slug),
      seq: seqKey(note.slug),
      level: note.level,
      updated: note.updated,
      minutes: note.minutes,
      chars: note.chars,
      summary: note.summary,
      topics: note.topics,
      tags: note.tags,
    });
  }

  const orderedDomains = [...domainBuckets.keys()].sort((a, b) => {
    const ia = domainOrder.indexOf(a);
    const ib = domainOrder.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return collator.compare(a, b);
  });

  const domains = orderedDomains.map((id) => {
    const order = groupOrder[id] || [];
    const rank = (name) => {
      const i = order.indexOf(name);
      return i === -1 ? order.length + 1 : i;
    };
    const groups = [...domainBuckets.get(id).entries()]
      .sort(([a], [b]) => rank(a) - rank(b) || collator.compare(a, b))
      .map(([groupId, list]) => ({
        id: groupId,
        title: groupId,
        notes: list.sort((a, b) => {
          const seq = noteOrder[groupId] || [];
          const seqRank = (item) => {
            const i = seq.findIndex((p) => item.slug.startsWith(p));
            return i === -1 ? seq.length : i;
          };
          return (
            seqRank(a) - seqRank(b) ||
            collator.compare(a.seq, b.seq) ||
            collator.compare(a.title, b.title)
          );
        }),
        count: list.length,
      }));
    const count = groups.reduce((sum, g) => sum + g.count, 0);
    const meta = domainMeta[id] || { title: id, desc: '', accent: '#475569' };
    return { id, title: meta.title, desc: meta.desc, accent: meta.accent, groups, count };
  });

  const manifest = {
    generatedAt: new Date().toISOString(),
    vaultCommit: readVaultCommit(),
    domain: {
      name: 'xxuntilu guides',
      title: '测试与 AI 工程知识库',
    },
    stats: {
      notes: publicNotes.length,
      chars: publicNotes.reduce((sum, n) => sum + n.chars, 0),
      minutes: publicNotes.reduce((sum, n) => sum + n.minutes, 0),
      privateNotes: privateNotes.length,
    },
    domains,
    notes: publicNotes
      .map((note) => ({
        slug: note.slug,
        title: note.title,
        domain: note.domain,
        domainTitle: note.domainTitle,
        group: note.group,
        level: note.level,
        updated: note.updated,
        minutes: note.minutes,
        chars: note.chars,
        summary: note.summary,
        topics: note.topics,
        tags: note.tags,
        id: note.id,
      }))
      .sort((a, b) => collator.compare(a.title, b.title)),
  };

  fs.writeFileSync(path.join(contentDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(contentDir, 'linkmap.json'), JSON.stringify(linkmap));

  // 搜索索引单独放 public，按需 fetch，避免每页内联几十 KB
  fs.mkdirSync(path.join(root, 'public'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'public', 'search-index.json'),
    JSON.stringify({ generatedAt: manifest.generatedAt, notes: manifest.notes }),
  );

  const privateList = privateNotes.length
    ? `私密 ${privateNotes.length} 篇（${privateNotes.map((n) => n.path).join('、')}）`
    : '无私密笔记';
  console.log(`[content] 公开 ${publicNotes.length} 篇 / ${manifest.stats.chars} 汉字；${privateList}`);
  if (hiddenLinks) console.log(`[content] 已把 ${hiddenLinks} 处指向私密笔记的双链替换为占位符`);
  console.log(`[content] 来源 ${vaultDir}${manifest.vaultCommit ? ` @${manifest.vaultCommit}` : ''}`);
}

main();
