import GithubSlugger from 'github-slugger';
import type { LinkMap } from './types';

/** wikilink：[[目标]] / [[目标|别名]] / [[目标\|别名]] */
export const WIKI_RE = /!?\[\[([^\]|\\]+?)(?:\\?\|([^\]]+?))?\]\]/g;

export function normalizeWikiTarget(target: string): string {
  return target
    .replace(/\\/g, '/')
    .replace(/\.md$/i, '')
    .replace(/^\/+/, '')
    .trim()
    .toLowerCase();
}

export function resolveWiki(target: string, linkmap: LinkMap): string | undefined {
  const clean = target.split('#')[0].trim();
  if (!clean) return undefined;
  const key = normalizeWikiTarget(clean);
  return linkmap[key] || linkmap[normalizeWikiTarget(clean.split('/').pop() || clean)];
}

/**
 * 把 Obsidian wikilink 转成站内链接：
 * - 能解析 -> [别名](/note/slug)
 * - 解析不到（多为私密笔记或尚未创建） -> [别名](missing:别名)，渲染成不可点的占位
 * 代码块内的内容不处理，避免破坏示例代码。
 */
/** 手写的 /note/xxx/ 绝对链接：按 linkmap 校正到当前 slug（改名或旧路径也能跳对） */
const ABS_NOTE_RE = /\]\(\/note\/([^)\s]+?)\/?\)/g;

/**
 * 拼接目标链接，保留 `#小节` 锚点。
 * 锚点 id 与 rehype-slug 一致（github-slugger），否则会跳到页顶。
 */
function buildHref(slug: string, rawTarget: string): string {
  const base = `/note/${encodeURIComponent(slug)}/`;
  const hashAt = rawTarget.indexOf('#');
  if (hashAt === -1) return base;
  const raw = rawTarget.slice(hashAt + 1).trim();
  if (!raw) return base;
  return `${base}#${encodeURIComponent(new GithubSlugger().slug(raw))}`;
}

export function preprocessWikiLinks(markdown: string, linkmap: LinkMap): string {
  const segments = markdown.split(/(```[\s\S]*?```|`[^`\n]*`)/g);
  return segments
    .map((segment, index) => {
      if (index % 2 === 1) return segment;
      const segmentWithAbs = segment.replace(ABS_NOTE_RE, (full, raw: string) => {
        let decoded = raw;
        try {
          decoded = decodeURIComponent(raw);
        } catch {
          return full;
        }
        const slug = resolveWiki(decoded, linkmap);
        return slug ? `](${buildHref(slug, decoded)})` : full;
      });
      return segmentWithAbs.replace(WIKI_RE, (full, target: string, alias: string | undefined) => {
        const label = (alias || target).replace(/#.*$/, '').trim() || alias || target;
        if (full.startsWith('!')) {
          return `> 附件：${label}`;
        }
        const slug = resolveWiki(target, linkmap);
        if (!slug) return `[${label}](missing:${encodeURIComponent(label)})`;
        return `[${label}](${buildHref(slug, target)})`;
      });
    })
    .join('');
}

/** 去掉正文开头的 H1：标题已经在页面头部渲染过，避免重复 */
export function stripLeadingH1(markdown: string): string {
  return markdown.replace(/^\s*#\s+[^\n]+\n+/, '');
}

/** 去掉行内 Markdown 标记，得到纯文本（用于标题锚点与目录） */
export function inlineToText(input: string): string {
  return input
    .replace(WIKI_RE, (_full, target: string, alias?: string) => (alias || target).trim())
    .replace(/!?\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\\\|/g, '|')
    .trim();
}

export interface Heading {
  id: string;
  text: string;
  level: number;
}

/** 与 rehype-slug 一致（github-slugger）地生成目录，保证锚点可跳转 */
export function extractHeadings(markdown: string): Heading[] {
  const slugger = new GithubSlugger();
  const headings: Heading[] = [];
  let inFence = false;
  for (const line of markdown.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const text = inlineToText(match[2]);
    if (!text) continue;
    headings.push({ id: slugger.slug(text), text, level: match[1].length });
  }
  return headings;
}

/** 抽取某个二级标题下的正文 */
export function sectionBody(markdown: string, heading: string): string {
  const lines = markdown.split('\n');
  let start = -1;
  let level = 0;
  let inFence = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const match = /^(#{1,6})\s+(.*)$/.exec(line);
    if (!match) continue;
    if (match[1].length >= 2 && inlineToText(match[2]).startsWith(heading)) {
      start = i + 1;
      level = match[1].length;
      break;
    }
  }
  if (start < 0) return '';
  const out: string[] = [];
  inFence = false;
  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const match = !inFence ? /^(#{1,6})\s+/.exec(line) : null;
    if (match && match[1].length <= level) break;
    out.push(line);
  }
  return out.join('\n').trim();
}

export interface CheckItem {
  index: number;
  text: string;
  checked: boolean;
}

/** 解析必查清单（没有就退化为全文所有任务项） */
export function extractChecklist(markdown: string): { items: CheckItem[]; fromSection: boolean } {
  const scope = sectionBody(markdown, '必查清单');
  const fromSection = scope.length > 0;
  const source = fromSection ? scope : markdown;
  const lines = source.split('\n');
  const items: CheckItem[] = [];
  let current: { text: string[]; checked: boolean } | null = null;

  const flush = () => {
    if (!current) return;
    const text = current.text.join(' ').replace(/\s+/g, ' ').trim();
    if (text) items.push({ index: items.length, text, checked: current.checked });
    current = null;
  };

  for (const line of lines) {
    const match = /^\s*[-*+]\s+\[( |x|X)\]\s+(.*)$/.exec(line);
    if (match) {
      flush();
      current = { text: [match[2]], checked: match[1].toLowerCase() === 'x' };
      continue;
    }
    if (current) {
      if (/^\s{2,}\S/.test(line) && line.trim()) {
        current.text.push(line.trim());
      } else if (line.trim() === '') {
        // 空行不打断（清单里常夹空行）
      } else {
        flush();
      }
    }
  }
  flush();
  return { items, fromSection };
}

export interface QuizItem {
  index: number;
  question: string;
  answer: string;
}

/**
 * 自测题：优先解析「面试问答」，其次解析技术篇的 `## Q1：...` 结构
 */
export function extractQuiz(markdown: string): QuizItem[] {
  const section = sectionBody(markdown, '面试问答');
  if (section) {
    const items: QuizItem[] = [];
    const pattern = /^\*\*Q\d*[：:]\s*([\s\S]*?)\*\*\s*$/gm;
    const matches = [...section.matchAll(pattern)];
    matches.forEach((match, i) => {
      const start = (match.index ?? 0) + match[0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index ?? section.length : section.length;
      const answer = section
        .slice(start, end)
        .replace(/^\s*\*\*参考答案\*\*\s*/m, '')
        .trim();
      const question = match[1].replace(/\s+/g, ' ').trim();
      if (question) items.push({ index: items.length, question, answer });
    });
    if (items.length) return items;
  }

  // 技术篇：## Q1：xxx / ## Q2：xxx
  const lines = markdown.split('\n');
  const heads: { line: number; question: string; level: number }[] = [];
  let inFence = false;
  lines.forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) return;
    const match = /^(#{2,4})\s+Q(\d+)\s*[：:]\s*(.+)$/.exec(line);
    if (match) heads.push({ line: i, question: match[3].trim(), level: match[1].length });
  });
  return heads.map((head, i) => {
    const end = i + 1 < heads.length ? heads[i + 1].line : lines.length;
    return {
      index: i,
      question: head.question,
      answer: lines.slice(head.line + 1, end).join('\n').trim(),
    };
  });
}

export function extractWikiLinks(markdown: string): { target: string; label: string }[] {
  const out: { target: string; label: string }[] = [];
  for (const match of markdown.matchAll(WIKI_RE)) {
    const target = match[1].trim();
    const label = (match[2] || match[1]).trim();
    out.push({ target, label });
  }
  return out;
}

/** 清单条目的轻量行内渲染：处理 `code`、**粗体**、[链接](url) */
export function renderInlineSegments(text: string): { type: 'text' | 'code' | 'strong' | 'link'; value: string; href?: string }[] {
  const segments: { type: 'text' | 'code' | 'strong' | 'link'; value: string; href?: string }[] = [];
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ type: 'text', value: text.slice(last, index) });
    const token = match[0];
    if (token.startsWith('`')) segments.push({ type: 'code', value: token.slice(1, -1) });
    else if (token.startsWith('**')) segments.push({ type: 'strong', value: token.slice(2, -2) });
    else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (link) segments.push({ type: 'link', value: link[1], href: link[2] });
    }
    last = index + token.length;
  }
  if (last < text.length) segments.push({ type: 'text', value: text.slice(last) });
  return segments;
}
