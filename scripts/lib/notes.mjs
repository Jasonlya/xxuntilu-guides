import path from 'node:path';
import crypto from 'node:crypto';
import GithubSlugger from 'github-slugger';
import {
  privateDirNames,
  privatePathPatterns,
  privateFrontmatterFlags,
} from '../../config/site.config.mjs';
import { splitFrontmatter, toArray, toDateString } from './frontmatter.mjs';

/** URL 用 slug：保留中英文，去掉标点，空白折叠成连字符 */
export function slugify(input) {
  return String(input)
    .replace(/\.md$/i, '')
    // 点号会让 Next 把路径当静态文件处理，尾斜杠被吞掉，预取地址变成 xxx.txt
    .replace(/\./g, '-')
    .trim()
    .replace(/[\s\u3000]+/g, '-')
    .replace(/[\\/:*?"<>|#%&{}$!'@+`=~^[\];,]+/g, '-')
    .replace(/[（(]/g, '-')
    .replace(/[）)]/g, '')
    .replace(/—|–/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

/** 私密判定：目录 / 路径敏感词 / frontmatter 显式声明 */
export function privacyVerdict(relPath, data = {}) {
  const segments = relPath.split(path.sep);
  const lowerSegments = segments.map((s) => s.toLowerCase());

  if (lowerSegments.some((s) => privateDirNames.has(s))) {
    return { private: true, reason: '私密目录' };
  }
  for (const pattern of privatePathPatterns) {
    if (pattern.test(relPath)) return { private: true, reason: `路径命中敏感词 ${pattern}` };
  }
  for (const [key, expected] of privateFrontmatterFlags) {
    if (data[key] === undefined) continue;
    const actual = data[key];
    if (actual === expected) return { private: true, reason: `frontmatter ${key}: ${expected}` };
    if (key === 'publish' && actual === 'false') return { private: true, reason: 'frontmatter publish: false' };
    if (key === 'private' && String(actual).toLowerCase() === 'true') {
      return { private: true, reason: 'frontmatter private: true' };
    }
    if (key === 'visibility' && String(actual).toLowerCase() === 'private') {
      return { private: true, reason: 'frontmatter visibility: private' };
    }
    if (key === 'sensitive' && String(actual).toLowerCase() === 'true') {
      return { private: true, reason: 'frontmatter sensitive: true' };
    }
  }
  return { private: false, reason: '' };
}

export function firstH1(body) {
  const m = /^#\s+(.+)$/m.exec(body);
  return m ? m[1].trim() : '';
}

/** 抽取某一级/二级标题段落（用于摘要、清单、自测解析） */
export function extractSection(body, headingText) {
  const lines = body.split('\n');
  const needle = headingText.trim();
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
    if (m && m[2].trim().replace(/\s+/g, ' ').startsWith(needle)) {
      start = i + 1;
      level = m[1].length;
      break;
    }
  }
  if (start < 0) return '';
  const out = [];
  for (let i = start; i < lines.length; i += 1) {
    const m = /^(#{1,6})\s+/.exec(lines[i]);
    if (m && m[1].length <= level) break;
    out.push(lines[i]);
  }
  return out.join('\n').trim();
}

function plainInline(text) {
  return String(text)
    .replace(/!?\[\[([^\]|\\]+?)(?:\\?\|([^\]]+?))?\]\]/g, (_m, a, b) => b || a)
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function summarize(body, data) {
  const explicit = data.summary || data.description;
  if (explicit) return plainInline(explicit);
  const oneLine = extractSection(body, '一句话')
    .split('\n')
    .map((l) => l.replace(/^>\s?/, '').trim())
    .filter(Boolean)
    .join(' ');
  if (oneLine) return plainInline(oneLine).slice(0, 140);
  const plain = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#{1,6}\s+.*$/gm, ' ')
    .replace(/\[\[([^\]|]+)(?:\\?\|([^\]]+))?\]\]/g, (_, a, b) => b || a)
    .replace(/[>*_`|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.slice(0, 140);
}

export function readingStats(body) {
  const cjk = (body.match(/[\u4e00-\u9fff]/g) || []).length;
  const latin = (body.match(/[A-Za-z][A-Za-z'-]*/g) || []).length;
  const codeBlocks = (body.match(/```/g) || []).length / 2;
  const minutes = Math.max(1, Math.round(cjk / 400 + latin / 220 + codeBlocks * 0.4));
  return { chars: cjk, words: cjk + latin, minutes };
}

export const WIKILINK_RE = /!?\[\[([^\]|\\]+?)(?:\\?\|([^\]]+?))?\]\]/g;

/** 提取笔记里所有内链目标（去掉别名与锚点） */
export function extractWikiTargets(body) {
  const targets = new Set();
  for (const match of body.matchAll(WIKILINK_RE)) {
    const target = match[1].trim().replace(/\\$/, '');
    if (!target) continue;
    targets.add(target.split('#')[0].split('|')[0].trim());
  }
  return [...targets];
}

export function noteId(relPath, data) {
  const id = data.id ? String(data.id).trim() : '';
  const base = path.basename(relPath, '.md');
  return id || base;
}

/** 构建期把 wikilink 解析成站内链接；私密目标统一替换成占位，避免标题泄漏 */
export function resolveWikiLinks(markdown, linkmap, privateKeys = new Set()) {
  const segments = markdown.split(/(```[\s\S]*?```|`[^`\n]*`)/g);
  let hidden = 0;
  const output = segments
    .map((segment, index) => {
      if (index % 2 === 1) return segment;
      return segment.replace(WIKILINK_RE, (full, target, alias) => {
        // [[笔记#小节]] 的锚点要单独拆出来：文件名用「#」前部分查 linkmap，
        // 锚点按 github-slugger 转成 id，和 rehype-slug 生成的标题 id 对齐。
        const hashAt = target.indexOf('#');
        const pathPart = hashAt === -1 ? target : target.slice(0, hashAt);
        const rawAnchor = hashAt === -1 ? '' : target.slice(hashAt + 1).trim();
        const label = (alias || (rawAnchor ? pathPart : target)).trim();
        const key = pathPart
          .replace(/\\/g, '/')
          .replace(/\.md$/i, '')
          .replace(/^\/+/, '')
          .trim()
          .toLowerCase();
        if (full.startsWith('!')) return `> 附件：${label}`;
        if (privateKeys.has(key)) {
          hidden += 1;
          return '🔒 私密笔记';
        }
        const slug = linkmap[key] || linkmap[key.split('/').pop() || key];
        if (!slug) return `[${label}](missing:${encodeURIComponent(label)})`;
        // 每次新建 slugger：同一个实例会对重复标题追加 -1，破坏锚点
        const frag = rawAnchor ? `#${encodeURIComponent(new GithubSlugger().slug(rawAnchor))}` : '';
        return `[${label}](/note/${encodeURIComponent(slug)}/${frag})`;
      });
    })
    .join('');
  return { markdown: output, hidden };
}

export function hashSuffix(input, len = 4) {
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, len);
}

export function buildMeta(relPath, raw) {
  const { data, body } = splitFrontmatter(raw);
  const base = path.basename(relPath, '.md');
  const title = String(data.title || '').trim() || firstH1(body) || base;
  return {
    data,
    body,
    meta: {
      id: noteId(relPath, data),
      title,
      slug: '',
      path: relPath.split(path.sep).join('/'),
      level: String(data.level || '').trim(),
      category: String(data.category || '').trim(),
      topics: toArray(data.topics),
      tags: toArray(data.tags),
      apiTypes: toArray(data.api_types || data.apiTypes),
      scenes: toArray(data.scenes),
      updated: toDateString(data.updated || data.created),
      created: toDateString(data.created),
      summary: summarize(body, data),
      ...readingStats(body),
    },
  };
}
