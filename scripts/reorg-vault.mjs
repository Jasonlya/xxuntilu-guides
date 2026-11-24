#!/usr/bin/env node
/**
 * Vault 分类重排
 *
 * 现状问题：分类完全由文件夹承担，于是出现「其他业务」21 篇大杂烩、
 * 「协议与传输」25 篇混四种主题、AI 系列的 01–05 被拆到三个组。
 *
 * 本脚本按 PLAN 把 .md 移到新的二级分组里（只动路径，不动内容）。
 * 默认 dry-run，加 --apply 才真正 git mv。
 *
 * 安全性：
 * - wikilink 是[[按名解析]]的，移动不断链（全库无路径式 wikilink）
 * - 前置检查：每篇笔记必须恰好命中一条规则，否则整体中止
 * - 目标同名文件已存在则中止，绝不覆盖
 * - 移动后清理空目录
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const VAULT_DIR = process.env.VAULT_DIR || path.join(process.env.HOME, 'Documents', 'Obsidian Vault');
const APPLY = process.argv.includes('--apply');

/** 目标目录 → 命中的文件前缀（域名/组名两级） */
const PLAN = {
  '1-软件测试/用例设计方法': ['L2-01', 'L2-02', 'L2-03', 'L2-04', 'L2-05', 'L2-06', 'L2-07'],
  '1-软件测试/断言与归因': ['L2-13', 'L2-15', 'L2-18', 'L2-19', 'L2-20'],
  '1-软件测试/一致性验证': ['L2-08', 'L2-09', 'L2-10', 'L2-11', 'L2-12'],
  '1-软件测试/测试工程': ['L2-14', 'L2-16', 'L2-17', 'L2-21', 'L2-22', 'L2-23', 'L2-24', 'L2-25'],
  '1-软件测试/接口语义与 CRUD': [
    'L1-01', 'L1-02', 'L1-03', 'L1-04', 'L1-05',
    'L1-06', 'L1-07', 'L1-08', 'L1-09', 'L1-10',
  ],
  '1-软件测试/典型接口场景': ['L1-11', 'L1-12', 'L1-13', 'L1-14', 'L1-15', 'L1-18', 'L1-22', 'L1-23'],
  '1-软件测试/契约与集成': ['L1-19', 'L1-20', 'L1-21', 'L1-26', 'L1-27', 'L1-28'],
  '1-软件测试/可靠性与防护': ['L1-16', 'L1-17', 'L1-24', 'L1-25', 'L1-29', 'L1-30'],

  '2-技术基础/HTTP 与协议': [
    'L0-01', 'L0-02', 'L0-03', 'L0-04', 'L0-05', 'L0-06',
    'L0-07', 'L0-13', 'L0-14', 'L0-15', 'L0-16', 'L0-17',
  ],
  '2-技术基础/鉴权与会话': ['L0-08', 'L0-09', 'L0-10', 'L0-11'],
  '2-技术基础/接口形态': ['L0-20', 'L0-21', 'L0-22', 'L0-23', 'L0-24', 'L0-25'],
  '2-技术基础/网络与网关': ['L0-12', 'L0-18', 'L0-19', 'Nginx'],

  '3-业务知识/交易与营销': ['L3-O01', 'L3-O02', 'L3-O03', 'L3-O04', 'L3-O05'],
  '3-业务知识/内容与消息': ['L3-O06', 'L3-O07', 'L3-O09', 'L3-O21'],
  '3-业务知识/平台与数据': [
    'L3-O08', 'L3-O10', 'L3-O11', 'L3-O12',
    'L3-O13', 'L3-O14', 'L3-O19', 'L3-O20',
  ],
  '3-业务知识/设备与合规': ['L3-O15', 'L3-O16', 'L3-O17', 'L3-O18'],

  '5-AI与Agent/学习路线': ['AI与Agent学习路线', '48 小时方案'],
  '5-AI与Agent/主线 01-05': ['01-LLM', '02-Agent', '03-RAG', '04-Agent', '05-Trace'],
  '5-AI与Agent/体系与参考': ['Agent 测试与评估', 'magpie', '腾讯 Agent'],
};

/** 迁移后要删掉的空目录（仅当真的空了） */
const OBSOLETE_DIRS = [
  '1-软件测试/接口测试',
  '1-软件测试/测试方法',
  '2-技术基础/协议与传输',
  '3-业务知识/其他业务',
  '5-AI与Agent/RAG',
  '5-AI与Agent/agent相关',
  '5-AI与Agent/agent评测',
];

const DOMAINS = ['1-软件测试', '2-技术基础', '3-业务知识', '4-面试', '5-AI与Agent', '6-前端', '00-规范'];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

const files = DOMAINS.flatMap((domain) => {
  const abs = path.join(VAULT_DIR, domain);
  return fs.existsSync(abs) ? walk(abs) : [];
});

const byPrefix = new Map();
for (const [prefix, targets] of Object.entries(
  Object.fromEntries(
    Object.entries(PLAN).flatMap(([dir, prefixes]) => prefixes.map((p) => [p, dir])),
  ),
)) {
  byPrefix.set(prefix, targets);
}

const moves = [];
const problems = [];
const claimed = new Map();

for (const abs of files) {
  const rel = path.relative(VAULT_DIR, abs);
  const base = path.basename(abs, '.md');
  const hits = [...byPrefix.entries()].filter(([prefix]) => base.startsWith(prefix));
  if (hits.length === 0) continue;
  if (hits.length > 1) {
    problems.push(`前缀歧义 ${rel} 命中 ${hits.map(([p]) => p).join(', ')}`);
    continue;
  }
  const [prefix, target] = hits[0];
  if (claimed.has(prefix)) {
    problems.push(`前缀 ${prefix} 被多篇文件命中：${claimed.get(prefix)} 与 ${rel}`);
    continue;
  }
  claimed.set(prefix, rel);
  const nextRel = path.join(target, path.basename(abs));
  if (nextRel === rel) continue;
  if (fs.existsSync(path.join(VAULT_DIR, nextRel))) {
    problems.push(`目标已存在，拒绝覆盖：${nextRel}`);
    continue;
  }
  moves.push({ from: rel, to: nextRel, group: target });
}

const missing = [...byPrefix.keys()].filter((prefix) => !claimed.has(prefix));
if (missing.length) problems.push(`规则里的前缀没找到对应文件：${missing.join(', ')}`);

if (problems.length) {
  console.error('[reorg] 预检失败，未改动任何文件：');
  problems.forEach((p) => console.error('  -', p));
  process.exit(1);
}

const byGroup = new Map();
for (const m of moves) {
  if (!byGroup.has(m.group)) byGroup.set(m.group, []);
  byGroup.get(m.group).push(path.basename(m.from, '.md'));
}

console.log(`[reorg] 计划移动 ${moves.length} 篇，涉及 ${byGroup.size} 个分组\n`);
for (const [group, names] of [...byGroup.entries()].sort()) {
  console.log(`${group}  (${names.length})`);
  console.log('  ' + names.join(' / '));
}

if (!APPLY) {
  console.log('\n[reorg] 预演结束，加 --apply 才会真正移动');
  process.exit(0);
}

let done = 0;
for (const m of moves) {
  fs.mkdirSync(path.join(VAULT_DIR, path.dirname(m.to)), { recursive: true });
  execFileSync('git', ['mv', m.from, m.to], { cwd: VAULT_DIR, stdio: 'pipe' });
  done += 1;
}

let removed = 0;
for (const dir of OBSOLETE_DIRS) {
  const abs = path.join(VAULT_DIR, dir);
  if (!fs.existsSync(abs)) continue;
  const left = fs.readdirSync(abs);
  if (left.length === 0) {
    fs.rmdirSync(abs);
    removed += 1;
  } else {
    console.log(`[reorg] 目录非空，保留：${dir}（剩 ${left.length} 项）`);
  }
}

console.log(`\n[reorg] 已移动 ${done} 篇，清理空目录 ${removed} 个`);
