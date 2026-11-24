/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig = {
  output: 'export',
  basePath,
  trailingSlash: true,
  reactStrictMode: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    // 本地 Obsidian 库名：用于「在 Obsidian 打开」深链，默认 Obsidian Vault
    NEXT_PUBLIC_OBSIDIAN_VAULT: process.env.NEXT_PUBLIC_OBSIDIAN_VAULT || 'Obsidian Vault',
  },
};

export default nextConfig;
