#!/usr/bin/env node
/**
 * 00-Inbox 自动归档：
 *   1. 读取 Vault/00-Inbox/*.md
 *   2. 跳过任何带私密标记的草稿（不送外部接口）
 *   3. 让 LLM 判断「归属知识域 + 子目录 + 元数据」，只返回分类结果
 *   4. 程序侧合并 frontmatter 并移动文件（正文一字不改，避免模型改写导致内容损失）
 *
 * 默认 dry-run，只打印计划；加 --apply 才真正移动文件。
 * 用法：
 *   node scripts/archive-inbox.mjs                # 预演
 *   node scripts/archive-inbox.mjs --apply        # 归档
 *   node scripts/archive-inbox.mjs --apply --limit 5
 */
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { vaultDir, archiveTargets, domainMeta } from '../config/site.config.mjs';
import { privacyVerdict, slugify } from './lib/notes.mjs';
import { splitFrontmatter, toArray } from './lib/frontmatter.mjs';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const limitArg = args.indexOf('--limit');
const limit = limitArg >= 0 ? Number(args[limitArg + 1]) || 20 : 20;

const inboxDir = path.join(vaultDir, '00-Inbox');
const apiKey = (process.env.LLM_API_KEY || '').trim();
const baseUrl = (process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
const model = process.env.LLM_MODEL || 'deepseek-chat';

const today = new Date().toISOString().slice(0, 10);

function log(message) {
  console.log(`[archive] ${message}`);
}

function buildPrompt(fileName, body, existing) {
  const targets = Object.entries(archiveTargets)
    .map(([domain, groups]) => `- ${domain}（${domainMeta[domain]?.title || domain}）：${groups.join(' / ') || '（直接放域根目录）'}`)
    .join('\n');

  return `你是我的 Obsidian 知识库整理助手。下面是落在 \`00-Inbox/\` 的草稿，请判断它应该归档到哪个知识域与子目录，并补齐元数据。

可选目录（domain 必须完全等于左侧字符串，group 必须等于括号里列出的某一项；没有把握就用 ""）：
${targets}

规则：
1. 讲「怎么测」（接口套路、用例设计、测试工具与自动化）→ 1-软件测试
2. 讲「被测对象怎么运作」（协议、数据库、中间件、运维排查）→ 2-技术基础
3. 讲具体业务域（支付、行情、ERP、其他业务规则）→ 3-业务知识
4. 讲 Agent / RAG / 评测 / LLM 应用 → 5-AI与Agent
5. 纯前端框架与前端测试 → 6-前端
6. 面试题、答题骨架 → 4-面试
7. 判断不了就返回 domain:""、group:""、confidence:0，不要猜。

只返回 JSON，不要解释：
{"domain":"...","group":"...","title":"不超过 40 字的标题","level":"入门|进阶|专家 或 空","topics":["..."],"tags":["3-6 个具体标签"],"confidence":0.0,"reason":"一句话理由"}

文件名：${fileName}
现有 frontmatter：${JSON.stringify(existing)}
正文前 4000 字：
"""
${body.slice(0, 4000)}
"""`;
}

async function classify(fileName, body, existing) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: buildPrompt(fileName, body, existing) }],
      response_format: { type: 'json_object' },
      temperature: 0,
    }),
  });
  if (!response.ok) {
    throw new Error(`LLM 接口 ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content || '{}';
  return JSON.parse(content);
}

function safeFileName(title, fallback) {
  const base = (title || fallback)
    .replace(/[\\/:*?"<>|#%&{}$!'@+`=~^[\];,]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return `${base || slugify(fallback) || 'note'}.md`;
}

function mergeFrontmatter(existing, result) {
  const merged = {
    ...existing,
    title: result.title || existing.title || '',
    topics: toArray(result.topics).length ? toArray(result.topics) : toArray(existing.topics),
    tags: toArray(result.tags).length ? toArray(result.tags) : toArray(existing.tags),
    updated: today,
  };
  if (result.level && !merged.level) merged.level = result.level;
  if (!merged.created) merged.created = existing.created || today;
  merged.source = existing.source || 'Inbox 自动归档';
  if (!merged.id) {
    const stamp = today.replace(/-/g, '');
    const rand = Math.random().toString(16).slice(2, 6);
    merged.id = `inbox-${stamp}-${rand}`;
  }
  return merged;
}

async function main() {
  if (!fs.existsSync(inboxDir)) {
    log('00-Inbox 不存在，跳过');
    return;
  }
  const files = fs
    .readdirSync(inboxDir)
    .filter((name) => name.toLowerCase().endsWith('.md'))
    .sort();

  if (files.length === 0) {
    log('收件箱是空的');
    return;
  }
  if (!apiKey) {
    log(`收件箱有 ${files.length} 篇，但未配置 LLM_API_KEY，跳过自动归档（文件不会被移动）`);
    return;
  }

  log(`收件箱 ${files.length} 篇，本次最多处理 ${limit} 篇${apply ? '（将移动文件）' : '（预演，不改文件）'}`);

  let planned = 0;
  let skipped = 0;

  for (const name of files.slice(0, limit)) {
    const abs = path.join(inboxDir, name);
    const raw = fs.readFileSync(abs, 'utf8');
    const { data, body } = splitFrontmatter(raw);

    const verdict = privacyVerdict(path.join('00-Inbox', name), data);
    if (verdict.private) {
      log(`跳过私密草稿：${name}（${verdict.reason}）`);
      skipped += 1;
      continue;
    }

    let result;
    try {
      result = await classify(name, body, data);
    } catch (error) {
      log(`分类失败，保持原样：${name} → ${error.message}`);
      skipped += 1;
      continue;
    }

    const domain = String(result.domain || '').trim();
    const groups = archiveTargets[domain];
    const confidence = Number(result.confidence || 0);
    if (!groups || confidence < 0.5) {
      log(`把握不足，留在收件箱：${name}（domain="${domain}" confidence=${confidence}）`);
      skipped += 1;
      continue;
    }
    const group = groups.includes(String(result.group || '').trim()) ? String(result.group).trim() : '';
    const targetDir = group ? path.join(vaultDir, domain, group) : path.join(vaultDir, domain);

    let targetName = safeFileName(result.title, name.replace(/\.md$/i, ''));
    let target = path.join(targetDir, targetName);
    let suffix = 2;
    while (fs.existsSync(target)) {
      target = path.join(targetDir, `${path.basename(targetName, '.md')}-${suffix}.md`);
      suffix += 1;
    }

    const frontmatter = YAML.stringify(mergeFrontmatter(data, result)).trimEnd();
    const content = `---\n${frontmatter}\n---\n\n${body.replace(/^\s+/, '')}`;

    log(`${name} → ${path.relative(vaultDir, target)}（${result.reason || '无理由'}，confidence=${confidence}）`);
    planned += 1;
    if (apply) {
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(target, content, 'utf8');
      fs.unlinkSync(abs);
    }
  }

  log(
    apply
      ? `完成：已归档 ${planned} 篇，跳过 ${skipped} 篇`
      : `预演完成：${planned} 篇待归档，跳过 ${skipped} 篇（加 --apply 才会真正移动文件）`,
  );
}

main().catch((error) => {
  console.error('[archive] 执行失败：', error);
  process.exit(1);
});
