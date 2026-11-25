#!/usr/bin/env node
/**
 * 把两份巨型题库按章节拆成「类型分册」，并生成 题号 → 分册 的映射，
 * 供 rewrite-bank-links.mjs 重写全库锚点链接使用。
 *
 *   node scripts/split-question-bank.mjs            # 预演
 *   node scripts/split-question-bank.mjs --apply    # 落盘
 */
import fs from 'node:fs';
import path from 'node:path';

const VAULT = process.env.VAULT_DIR || '/Users/xxuntilu/Documents/Obsidian Vault';
const APPLY = process.argv.includes('--apply');

const BANKS = [
  {
    src: '4-面试/题库/软件测试.md',
    outDir: '4-面试/01-软件测试题库',
    overviewFile: '软件测试题库总览.md',
    overviewTitle: '软件测试面试题库',
    domainTag: '软件测试',
    total: 137,
    chapters: [
      { h2: '一、测试基础、流程与质量', file: '01-基础流程与质量.md', title: '测试基础、流程与质量' },
      { h2: '二、用例设计与场景题', file: '02-用例设计与场景.md', title: '用例设计与场景' },
      { h2: '三、接口测试', file: '03-接口测试.md', title: '接口测试' },
      { h2: '四、自动化、UI 与 CI/CD', file: '04-自动化与CICD.md', title: '自动化、UI 与 CI/CD' },
      { h2: '五、性能测试', file: '05-性能测试.md', title: '性能测试' },
      { h2: '六、Linux、数据库、网络与中间件', file: '06-Linux与数据存储.md', title: 'Linux、数据库、网络与中间件' },
      { h2: '七、编程与多线程', file: '07-编程与多线程.md', title: '编程与多线程' },
    ],
  },
  {
    src: '4-面试/题库/AI与Agent测试题库.md',
    outDir: '4-面试/02-AI与Agent题库',
    overviewFile: 'AI与Agent题库总览.md',
    overviewTitle: 'AI 与 Agent 测试题库',
    domainTag: 'AI与Agent',
    total: 64,
    chapters: [
      { h2: '一、概念与范式差异', file: '01-概念与范式.md', title: '概念与范式差异' },
      { h2: '二、评测集、指标与输出质量', file: '02-评测集与输出质量.md', title: '评测集、指标与输出质量' },
      { h2: '三、Agent 链路、工具调用与 MCP', file: '03-Agent链路与工具调用.md', title: 'Agent 链路、工具调用与 MCP' },
      { h2: '四、记忆、多轮与幻觉', file: '04-记忆多轮与幻觉.md', title: '记忆、多轮与幻觉' },
      { h2: '五、评测体系、归因与成本', file: '05-评测体系与归因.md', title: '评测体系、归因与成本' },
      { h2: '六、Judge、安全与对抗', file: '06-Judge安全与对抗.md', title: 'Judge、安全与对抗' },
      { h2: '七、工程化与落地', file: '07-工程化与落地.md', title: '工程化与落地' },
    ],
  },
];

const read = (rel) => fs.readFileSync(path.join(VAULT, rel), 'utf8');

/** 把整篇按 `## ` 切成 [{heading, body}]，跳过 `## ` 之前的部分 */
function splitByH2(text) {
  const lines = text.split('\n');
  const blocks = [];
  let cur = null;
  for (const ln of lines) {
    if (ln.startsWith('## ')) {
      if (cur) blocks.push(cur);
      cur = { heading: ln.slice(3).trim(), body: [] };
    } else if (cur) {
      cur.body.push(ln);
    }
  }
  if (cur) blocks.push(cur);
  return blocks;
}

/** 去掉首尾空行与末尾 `---` 分隔线 */
function trimBody(lines) {
  let b = lines.slice();
  // 原章节首行的「> 22 题，Q1–Q22」与新导航重复，去掉
  b = b.filter((ln, i) => !(i < 3 && /^>\s*\d+\s*题[，,].*Q\d/.test(ln.trim())));
  while (b.length && !b[0].trim()) b.shift();
  while (b.length && !b[b.length - 1].trim()) b.pop();
  while (b.length && /^---+\s*$/.test(b[b.length - 1])) {
    b.pop();
    while (b.length && !b[b.length - 1].trim()) b.pop();
  }
  return b;
}

/** `### Q12` → `## Q12`，标题文字不变，锚点不变 */
function demoteHeading(lines) {
  return lines.map((ln) => (/^###\s/.test(ln) ? ln.replace(/^###\s/, '## ') : ln));
}

const qmap = {}; // 题号 → { file, bank }
const plan = [];

for (const bank of BANKS) {
  const text = read(bank.src);
  const blocks = splitByH2(text);

  for (const [i, ch] of bank.chapters.entries()) {
    const block = blocks.find((b) => b.heading === ch.h2);
    if (!block) throw new Error(`未找到章节「${ch.h2}」 in ${bank.src}`);
    const body = trimBody(demoteHeading(block.body));

    const qs = body.map((l) => l.match(/^## Q(\d+)\./)).filter(Boolean).map((m) => Number(m[1]));
    if (!qs.length) throw new Error(`章节「${ch.h2}」没有 Q 标题`);
    qs.forEach((q) => {
      if (!qmap[q]) qmap[q] = {};
      if (qmap[q][bank.domainTag]) {
        throw new Error(`同一库内题号重复：${bank.domainTag} Q${q}（${qmap[q][bank.domainTag]} 与 ${ch.file}）`);
      }
      qmap[q][bank.domainTag] = ch.file.replace(/\.md$/, '');
    });

    const sorted = [...qs].sort((a, b) => a - b);
    const spans = [];
    for (const q of sorted) {
      const last = spans[spans.length - 1];
      if (last && q === last[1] + 1) last[1] = q;
      else spans.push([q, q]);
    }
    const range = spans.map(([a, b]) => (a === b ? `Q${a}` : `Q${a}–Q${b}`)).join('、');
    const prev = i > 0 ? bank.chapters[i - 1] : null;
    const next = i < bank.chapters.length - 1 ? bank.chapters[i + 1] : null;

    const nav = [
      `> 所属主库：[[${bank.overviewFile.replace(/\.md$/, '')}|${bank.overviewTitle}]]（${bank.chapters.length} 个类型 / ${bank.total} 题）。本册 ${qs.length} 题，${range}。`,
      '>',
      `> ${prev ? `上一册 [[${prev.file.replace(/\.md$/, '')}|${prev.title}]]` : '已是第一册'}　·　${next ? `下一册 [[${next.file.replace(/\.md$/, '')}|${next.title}]]` : '已是最后一册'}`,
    ].join('\n');

    const content = [
      '---',
      `topics: [${bank.domainTag}, 面试题]`,
      'type: 面试题库分册',
      `bank: ${bank.overviewTitle}`,
      `range: ${range}`,
      `created: 2026-11-09`,
      `updated: 2026-11-26`,
      '---',
      '',
      `# ${ch.title}（${range}）`,
      '',
      nav,
      '',
      body.join('\n'),
      '',
    ].join('\n');

    plan.push({ file: path.join(bank.outDir, ch.file), content, qs: qs.length, range });
  }
}

// 题号在两库各自独立，只校验同库内不重复（已在写入时抛错）
const missing = [];
let grand = 0;
for (const bank of BANKS) {
  const seen = Object.values(qmap).filter((v) => v[bank.domainTag]).length;
  grand += seen;
  if (seen !== bank.total) missing.push(`${bank.domainTag} 期望 ${bank.total} 题，实际 ${seen}`);
}
if (missing.length) throw new Error(missing.join('；'));

console.log(`将写出 ${plan.length} 个分册，覆盖 ${grand} 道题（软测 + AI 各自独立编号）：`);
for (const p of plan) console.log(`  ${p.qs.toString().padStart(3)} 题  ${p.range.padEnd(12)} ${p.file}`);

if (!APPLY) {
  console.log('\n预演结束。加 --apply 执行。');
  process.exit(0);
}

for (const p of plan) {
  const abs = path.join(VAULT, p.file);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, p.content);
}
fs.writeFileSync('/tmp/qmap.json', JSON.stringify(qmap, null, 1));
console.log(`\n已写出 ${plan.length} 个文件；题号映射 → /tmp/qmap.json`);
