import fs from 'node:fs';
import path from 'node:path';
import type { LinkMap, Manifest, NotePayload } from './types';

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
  // slug 来自 URL，禁止路径穿越
  if (!/^[\w\u4e00-\u9fff.\-]+$/u.test(slug)) {
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
