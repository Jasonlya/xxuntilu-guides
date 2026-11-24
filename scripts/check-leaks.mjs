#!/usr/bin/env node
/**
 * 公开产物泄漏检查：构建完成后扫描 out/，确认私密笔记的标题 / 路径 / 正文片段
 * 都没有以明文出现在任何 HTML、JS、JSON 里。
 *
 * 用法：node scripts/check-leaks.mjs [outDir]
 * 失败时退出码 1，CI 会因此中断发布。
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.resolve(root, process.argv[2] || 'out');
const privateIndex = path.join(root, 'content', 'private', 'index.json');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, out);
    else if (/\.(html|js|mjs|json|txt|xml|map|css)$/i.test(entry.name)) out.push(abs);
  }
  return out;
}

function snippetsOf(body) {
  const lines = body
    .replace(/```[\s\S]*?```/g, '\n')
    .split('\n')
    .map((line) => line.replace(/^[#>\-*\s]+/, '').replace(/[`*]/g, '').trim())
    .filter((line) => line.length >= 24 && !/^[-|]/.test(line));
  if (!lines.length) return [];
  // 取最长的一行中段，降低与公开内容偶然重合的概率
  const longest = lines.sort((a, b) => b.length - a.length)[0];
  const start = Math.floor(longest.length / 3);
  return [longest.slice(start, start + 28)].filter((text) => text.trim().length >= 20);
}

if (!fs.existsSync(outDir)) {
  console.error(`[leak] 找不到构建产物目录：${outDir}`);
  process.exit(1);
}

const files = walk(outDir);
const fileTexts = new Map();
for (const file of files) {
  try {
    fileTexts.set(file, fs.readFileSync(file, 'utf8'));
  } catch {
    /* 跳过二进制/不可读 */
  }
}

let notes = [];
try {
  notes = JSON.parse(fs.readFileSync(privateIndex, 'utf8'));
} catch {
  notes = [];
}

const findings = [];
for (const note of notes) {
  const needles = [
    { kind: '标题', text: note.title },
    { kind: '路径', text: note.meta?.path?.replace(/\.md$/i, '') },
    ...snippetsOf(note.body || '').map((text) => ({ kind: '正文片段', text })),
  ].filter((item) => item.text && item.text.length >= 4);

  for (const needle of needles) {
    for (const [file, text] of fileTexts) {
      if (text.includes(needle.text)) {
        findings.push({ note: note.title, kind: needle.kind, needle: needle.text, file: path.relative(outDir, file) });
        break;
      }
    }
  }
}

const encPath = path.join(outDir, 'private-vault.enc.json');
const hasEnc = fs.existsSync(encPath);

console.log(`[leak] 扫描 ${fileTexts.size} 个产物文件，针对 ${notes.length} 篇私密笔记`);
console.log(`[leak] 密文包：${hasEnc ? `存在（${(fs.statSync(encPath).size / 1024).toFixed(1)} KB）` : '未生成（未配置主密码）'}`);

if (findings.length === 0) {
  console.log('[leak] ✓ 未发现私密笔记明文');
  process.exit(0);
}

console.error('[leak] ✗ 发现私密内容明文，禁止发布：');
for (const item of findings) {
  console.error(`  - [${item.kind}] 「${item.needle}」出现在 ${item.file}`);
}
process.exit(1);
