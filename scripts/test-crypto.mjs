#!/usr/bin/env node
/**
 * 加解密自测：验证「构建期加密 -> 浏览器端解密」这条链路在字节层面是对得上的。
 * 用 Node 的 Buffer 版 base64url 与浏览器式 btoa/atob 版各跑一遍，两边必须互相解出同一份明文。
 */
import assert from 'node:assert/strict';
import { encryptPayload, decryptPayload, KDF_ITERATIONS } from '../src/lib/vaultCryptoCore.mjs';

const nodeCodec = {
  encode: (bytes) => Buffer.from(bytes).toString('base64url'),
  decode: (text) => new Uint8Array(Buffer.from(text, 'base64url')),
};

// 模拟浏览器：btoa/atob 只认 latin1 字符串，这里补上全局实现
const browserCodec = {
  encode(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  decode(text) {
    const normalized = text.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  },
};

const sample = {
  count: 2,
  notes: [
    { slug: 'a', title: '私密随记：转岗复盘', body: '这里包含中文、emoji 🚀 与 `代码` 片段\n\n- [ ] 待办' },
    { slug: 'b', title: 'Key', body: 'sk-test-123' },
  ],
  linkmap: { '私密随记': 'a' },
};

async function run() {
  assert.equal(typeof btoa, 'function', '当前 Node 需要提供 btoa/atob（Node 16+ 已内置）');

  // 1. 构建期（Node）加密 -> 浏览器 codec 解密
  const fromNode = await encryptPayload(sample, 'master-password-123', nodeCodec);
  assert.equal(fromNode.iter, KDF_ITERATIONS);
  const decryptedInBrowser = await decryptPayload(fromNode, 'master-password-123', browserCodec);
  assert.deepEqual(decryptedInBrowser, sample);
  console.log('✓ Node 加密 -> 浏览器解密：明文一致');

  // 2. 浏览器加密 -> 构建期解密（本地保险箱数据的回读路径）
  const fromBrowser = await encryptPayload(sample, 'master-password-123', browserCodec);
  const decryptedInNode = await decryptPayload(fromBrowser, 'master-password-123', nodeCodec);
  assert.deepEqual(decryptedInNode, sample);
  console.log('✓ 浏览器加密 -> Node 解密：明文一致');

  // 3. 错误密码必须抛错（AES-GCM 认证标签校验失败）
  await assert.rejects(
    () => decryptPayload(fromNode, 'wrong-password', browserCodec),
    /operation failed|bad decrypt|Unsupported state/i,
  );
  console.log('✓ 错误密码解密失败，未静默返回垃圾数据');

  // 4. salt / IV 每次都不同，同一明文不会产生相同密文
  const again = await encryptPayload(sample, 'master-password-123', nodeCodec);
  assert.notEqual(again.salt, fromNode.salt);
  assert.notEqual(again.iv, fromNode.iv);
  assert.notEqual(again.data, fromNode.data);
  console.log('✓ 随机 salt/IV 生效，密文不可比对');

  console.log('\n全部通过：密文包可被浏览器直接解密。');
}

run().catch((err) => {
  console.error('✗ 自测失败：', err);
  process.exit(1);
});
