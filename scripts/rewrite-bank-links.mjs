#!/usr/bin/env node
/**
 * 题库按类型拆册后，重写全库指向旧题库的链接。
 *
 *   [[软件测试#Q49. 接口自动化框架怎么分层？|框架分层]]  →  [[03-接口测试#Q49. ...|框架分层]]
 *   [[AI与Agent测试题库#Q43. 提示词注入怎么测|提示注入]] →  [[06-Judge安全与对抗#Q43. ...|提示注入]]
 *   [[软件测试]]                                        →  [[软件测试题库总览|软件测试面试题库]]
 *
 *   node scripts/rewrite-bank-links.mjs            # 预演
 *   node scripts/rewrite-bank-links.mjs --apply    # 落盘
 */
import fs from 'node:fs';
import path from 'node:path';

const VAULT = process.env.VAULT_DIR || '/Users/xxuntilu/Documents/Obsidian Vault';
const APPLY = process.argv.includes('--apply');
const qmap = JSON.parse(fs.readFileSync('/tmp/qmap.json', 'utf8'));

const BANKS = [
  { old: '软件测试', tag: '软件测试', overview: '软件测试题库总览', label: '软件测试面试题库' },
  { old: 'AI与Agent测试题库', tag: 'AI与Agent', overview: 'AI与Agent题库总览', label: 'AI 与 Agent 测试题库' },
];

const exists = (stem) => {
  // 在所有目录里找同名 md
  for (const dir of ['4-面试/01-软件测试题库', '4-面试/02-AI与Agent题库']) {
    if (fs.existsSync(path.join(VAULT, dir, `${stem}.md`))) return true;
  }
  return false;
};

/** 目标分册里是否真的有这道题（校验锚点不会悬空） */
const hasQuestion = (stem, q) => {
  for (const dir of ['4-面试/01-软件测试题库', '4-面试/02-AI与Agent题库']) {
    const f = path.join(VAULT, dir, `${stem}.md`);
    if (fs.existsSync(f)) {
      const s = fs.readFileSync(f, 'utf8');
      return new RegExp(`^## Q${q}\\.`, 'm').test(s);
    }
  }
  return false;
};

const SKIP = new Set(['.git', '.obsidian', '.trash', 'outputs']);
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.md')) files.push(p);
  }
})(VAULT);

const problems = [];
const touched = [];

for (const file of files) {
  const rel = path.relative(VAULT, file);
  let s = fs.readFileSync(file, 'utf8');
  const before = s;
  let n = 0;

  for (const bank of BANKS) {
    // 1) 带锚点：[[旧名#Q12. 标题|别名]]
    const anchored = new RegExp(`\\[\\[${escapeRe(bank.old)}#(Q(\\d+))([^\\]]*)\\]\\]`, 'g');
    s = s.replace(anchored, (m, qLabel, qNum, rest) => {
      const target = qmap[qNum]?.[bank.tag];
      if (!target) {
        problems.push(`${rel}: 找不到 ${bank.tag} Q${qNum} 的分册`);
        return m;
      }
      if (!exists(target)) {
        problems.push(`${rel}: 分册文件不存在 ${target}.md`);
        return m;
      }
      if (!hasQuestion(target, qNum)) {
        problems.push(`${rel}: ${target}.md 里没有 Q${qNum}`);
        return m;
      }
      n += 1;
      return `[[${target}#${qLabel}${rest}]]`;
    });

    // 2) 裸引用：[[旧名]] / [[旧名|别名]] / [[旧名\|别名]]
    const bare = new RegExp(`\\[\\[${escapeRe(bank.old)}((?:\\\\?\\|[^\\]]*)?)\\]\\]`, 'g');
    s = s.replace(bare, (m, alias) => {
      n += 1;
      const text = alias ? alias.replace(/^\\?\|/, '') : bank.label;
      return `[[${bank.overview}|${text}]]`;
    });
  }

  if (s !== before) {
    touched.push({ rel, n });
    if (APPLY) fs.writeFileSync(file, s);
  }
}

function escapeRe(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

console.log(`涉及 ${touched.length} 个文件，共重写 ${touched.reduce((a, b) => a + b.n, 0)} 处链接：`);
for (const t of touched.sort((a, b) => b.n - a.n)) console.log(`  ${String(t.n).padStart(3)}  ${t.rel}`);

if (problems.length) {
  console.error(`\n${problems.length} 处无法解析：`);
  for (const p of problems) console.error('  ' + p);
  process.exitCode = 1;
}

if (!APPLY) console.log('\n预演结束。加 --apply 执行。');
else console.log('\n已落盘。');
