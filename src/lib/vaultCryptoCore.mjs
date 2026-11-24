/**
 * 运行时无关的 AES-GCM 加解密核心。
 * 浏览器（src/lib/vaultCrypto.ts）与 Node 构建脚本（scripts/encrypt-private.mjs）共用同一份实现，
 * 保证「构建期加密的密文」与「浏览器端解密」不会因为两套代码写法不同而对不上。
 *
 * 安全要点：
 * - 密钥来自 PBKDF2-SHA256 派生，源码里没有任何硬编码密钥；
 * - 每次加密都用新的随机 salt 与 IV，salt/IV 随密文一起存放；
 * - 只有密码正确时 AES-GCM 的认证标签才会校验通过，因此解密失败即代表密码错误。
 */

export const KDF_ITERATIONS = 310000;
export const PAYLOAD_VERSION = 2;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function deriveAesKey(password, salt, iterations = KDF_ITERATIONS) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * @param {unknown} value 任意可 JSON 序列化的数据
 * @param {string} password 主密码（只在内存中流转，不落盘）
 * @param {{encode: (bytes: Uint8Array) => string}} codec
 */
export async function encryptPayload(value, password, codec) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(password, salt);
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(value)),
  );
  return {
    v: PAYLOAD_VERSION,
    kdf: 'PBKDF2-SHA256',
    iter: KDF_ITERATIONS,
    salt: codec.encode(salt),
    iv: codec.encode(iv),
    data: codec.encode(new Uint8Array(cipher)),
  };
}

/**
 * @param {any} payload encryptPayload 的返回值
 * @param {string} password
 * @param {{decode: (text: string) => Uint8Array}} codec
 */
export async function decryptPayload(payload, password, codec) {
  if (!payload || typeof payload !== 'object' || !payload.data || !payload.salt || !payload.iv) {
    throw new Error('密文格式不正确');
  }
  const salt = codec.decode(payload.salt);
  const iv = codec.decode(payload.iv);
  const data = codec.decode(payload.data);
  const key = await deriveAesKey(password, salt, payload.iter || KDF_ITERATIONS);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return JSON.parse(decoder.decode(plain));
}
