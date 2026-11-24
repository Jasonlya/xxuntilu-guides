import YAML from 'yaml';

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/;

/** 解析 Markdown 的 YAML Frontmatter；解析失败时保留空元数据，不抛错中断构建 */
export function splitFrontmatter(raw) {
  if (!raw.startsWith('---')) return { data: {}, body: raw, hasFrontmatter: false };
  const match = FM_RE.exec(raw);
  if (!match) return { data: {}, body: raw, hasFrontmatter: false };
  let data = {};
  try {
    const parsed = YAML.parse(match[1]);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed;
  } catch (err) {
    console.warn(`[frontmatter] YAML 解析失败：${err.message}`);
  }
  return { data, body: raw.slice(match[0].length), hasFrontmatter: true };
}

export function toArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map(String).map((v) => v.trim()).filter(Boolean);
  return String(value)
    .split(/[,，;；]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export function toDateString(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}
