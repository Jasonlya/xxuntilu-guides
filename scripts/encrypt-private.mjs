#!/usr/bin/env node
/**
 * 把私密笔记加密成密文包，随公开站点发布。
 *
 * - 没配置 VAULT_MASTER_PASSWORD：不生成密文包（私密笔记仅本地可见），并清掉历史遗留密文。
 * - 配置了：PBKDF2(310k) + AES-GCM(256) 加密整包，产物只有密文，无标题、无路径明文。
 *
 * 密文包 = public/private-vault.enc.json（已 gitignore，属构建产物）
 */
import fs from 'node:fs';
import path from 'node:path';
import { privateBundlePath } from '../config/site.config.mjs';
import { encryptPayload } from '../src/lib/vaultCryptoCore.mjs';

const root = process.cwd();
const privateIndexPath = path.join(root, 'content', 'private', 'index.json');
const linkmapPath = path.join(root, 'content', 'linkmap.json');
const outPath = path.join(root, privateBundlePath);

const nodeCodec = {
  encode: (bytes) => Buffer.from(bytes).toString('base64url'),
  decode: (text) => new Uint8Array(Buffer.from(text, 'base64url')),
};

const password = (process.env.VAULT_MASTER_PASSWORD || '').trim();

if (!fs.existsSync(privateIndexPath)) {
  fs.rmSync(outPath, { force: true });
  console.log('[private] 没有私密笔记，跳过加密');
  process.exit(0);
}

const notes = JSON.parse(fs.readFileSync(privateIndexPath, 'utf8'));
const linkmap = fs.existsSync(linkmapPath) ? JSON.parse(fs.readFileSync(linkmapPath, 'utf8')) : {};

if (notes.length === 0) {
  fs.rmSync(outPath, { force: true });
  console.log('[private] 私密笔记为 0，跳过加密');
  process.exit(0);
}

if (!password) {
  fs.rmSync(outPath, { force: true });
  console.log(
    `[private] 未配置 VAULT_MASTER_PASSWORD：${notes.length} 篇私密笔记不进公开产物（仅本地/Obsidian 可见）`,
  );
  process.exit(0);
}

if (password.length < 8) {
  console.error('[private] VAULT_MASTER_PASSWORD 太短（至少 8 位），拒绝生成可被暴力破解的密文包');
  process.exit(1);
}

// 私密笔记之间的内链只存在于密文包内部，不污染公开 linkmap
const privateLinkmap = { ...linkmap };
for (const note of notes) {
  const base = note.meta?.path ? note.meta.path.split('/').pop().replace(/\.md$/i, '') : note.slug;
  for (const key of [note.slug, base, note.title, note.meta?.id].filter(Boolean)) {
    const normalized = String(key).replace(/\.md$/i, '').trim().toLowerCase();
    privateLinkmap[normalized] = note.slug;
    privateLinkmap[normalized.split('/').pop()] = note.slug;
  }
  if (note.meta?.path) {
    privateLinkmap[note.meta.path.replace(/\.md$/i, '').toLowerCase()] = note.slug;
  }
}

const body = {
  count: notes.length,
  createdAt: new Date().toISOString(),
  notes,
  linkmap: privateLinkmap,
};

const payload = await encryptPayload(body, password, nodeCodec);
payload.meta = {
  count: notes.length,
  createdAt: body.createdAt,
  countsTowardNav: true,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload));

const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
console.log(`[private] 已加密 ${notes.length} 篇私密笔记 -> ${privateBundlePath}（${kb} KB，仅密文）`);
