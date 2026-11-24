/**
 * 浏览器端 AES-GCM 封装（PBKDF2 派生 + AES-GCM 加密）。
 * 核心算法在 vaultCryptoCore.mjs，与构建期加密脚本共用，避免两套实现漂移。
 */
import { encryptPayload, decryptPayload, KDF_ITERATIONS } from './vaultCryptoCore.mjs';

export { KDF_ITERATIONS };

export interface PrivateNoteMeta {
  title: string;
  path: string;
  domainTitle: string;
  group: string;
  level: string;
  topics: string[];
  tags: string[];
  updated: string;
  summary: string;
  minutes: number;
}

export interface PrivateNote {
  slug: string;
  title: string;
  body: string;
  privateReason?: string;
  meta: PrivateNoteMeta;
}

export interface PrivateBundle {
  count: number;
  createdAt: string;
  notes: PrivateNote[];
  linkmap: Record<string, string>;
}

export interface EncryptedPayload {
  v: number;
  kdf: string;
  iter: number;
  salt: string;
  iv: string;
  data: string;
  meta?: Record<string, unknown>;
}

const b64urlCodec = {
  encode(bytes: Uint8Array): string {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  decode(text: string): Uint8Array {
    const normalized = text.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  },
};

/** 加密任意文本，返回可直接存进 LocalStorage 的 JSON 字符串 */
export async function encryptVaultData(plainText: string, password: string): Promise<string> {
  const payload = await encryptPayload(plainText, password, b64urlCodec);
  return JSON.stringify(payload);
}

/** 解密 encryptVaultData 的产物 */
export async function decryptVaultData(cipherText: string, password: string): Promise<string> {
  const payload = JSON.parse(cipherText) as EncryptedPayload;
  const value = await decryptPayload(payload, password, b64urlCodec);
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/** 解密构建期打包的私密笔记密文 */
export async function decryptBundle(
  payload: EncryptedPayload,
  password: string,
): Promise<PrivateBundle> {
  const value = (await decryptPayload(payload, password, b64urlCodec)) as PrivateBundle;
  if (!value || !Array.isArray(value.notes)) throw new Error('密文内容不正确');
  return value;
}

export function emptyBundle(): PrivateBundle {
  return { count: 0, createdAt: '', notes: [], linkmap: {} };
}

/** 站点静态资源前缀（GitHub Pages 子路径部署时不为空） */
export function publicAsset(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
