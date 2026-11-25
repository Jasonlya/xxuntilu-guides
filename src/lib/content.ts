import fs from 'node:fs';
import path from 'node:path';
import type { LinkMap, Manifest, NavDomain, NotePayload } from './types';

const contentDir = path.join(process.cwd(), 'content');

let manifestCache: Manifest | null = null;

export function getManifest(): Manifest {
  if (manifestCache) return manifestCache;
  try {
    manifestCache = JSON.parse(fs.readFileSync(path.join(contentDir, 'manifest.json'), 'utf8')) as Manifest;
  } catch {
    manifestCache = {
      generatedAt: '',
      vaultCommit: '',
      domain: { name: 'xxuntilu guides', title: '测试与 AI 工程知识库' },
      stats: { notes: 0, chars: 0, minutes: 0, privateNotes: 0 },
      domains: [],
      notes: [],
    };
  }
  return manifestCache;
}

const noteCache = new Map<string, NotePayload | null>();

export function getNote(slug: string): NotePayload | null {
  if (noteCache.has(slug)) return noteCache.get(slug) ?? null;
  // slug 来自 URL：只拦住路径穿越与非法字符，不要再按「只许中英文数字」的白名单卡，
  // 否则 Obsidian 文件名里的全角标点（：、（）…）会让整篇笔记变成空白错误页。
  if (!slug || slug.length > 120 || slug.includes('..') || /[/\\\u0000-\u001f]/.test(slug)) {
    if (process.env.DEBUG_CONTENT) console.error('[content] slug 校验未通过', JSON.stringify(slug));
    return null;
  }
  try {
    const raw = fs.readFileSync(path.join(contentDir, 'notes', `${slug}.json`), 'utf8');
    const note = JSON.parse(raw) as NotePayload;
    noteCache.set(slug, note);
    return note;
  } catch (error) {
    if (process.env.DEBUG_CONTENT) console.error('[content] getNote 失败', slug, error);
    noteCache.set(slug, null);
    return null;
  }
}

export function getLinkmap(): LinkMap {
  try {
    return JSON.parse(fs.readFileSync(path.join(contentDir, 'linkmap.json'), 'utf8')) as LinkMap;
  } catch {
    return {};
  }
}

export function allNoteSlugs(): string[] {
  return getManifest().notes.map((note) => note.slug);
}

/** 同一知识域内的上一篇/下一篇，便于顺序阅读 */
export function getAdjacent(domainId: string, slug: string) {
  const domain = getManifest().domains.find((item) => item.id === domainId);
  if (!domain) return { prev: null, next: null };
  const flat = domain.groups.flatMap((group) =>
    group.notes.map((note) => ({ slug: note.slug, title: note.title })),
  );
  const index = flat.findIndex((note) => note.slug === slug);
  return {
    prev: index > 0 ? flat[index - 1] : null,
    next: index >= 0 && index < flat.length - 1 ? flat[index + 1] : null,
  };
}

export function getDomain(domainId: string) {
  return getManifest().domains.find((item) => item.id === domainId) || null;
}

/**
 * 侧栏用的导航树：去掉侧栏和搜索都用不到的字段（摘要、topics 等）。
 * 笔记页每次跳转都要重新下载这棵树，原样下发约 141KB，正文只有十几 KB；
 * 摘要一项就占 53KB，裁掉后单页载荷能瘦三分之一以上。
 */
export function getNavDomains(): NavDomain[] {
  return getManifest().domains.map((domain) => ({
    ...domain,
    groups: domain.groups.map((group) => ({
      ...group,
      notes: group.notes.map((note) => ({
        slug: note.slug,
        title: note.title,
        id: note.id,
      })),
    })),
  }));
}
