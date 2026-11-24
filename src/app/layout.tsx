import type { Metadata, Viewport } from 'next';
import fs from 'node:fs';
import path from 'node:path';
import './globals.css';
import { getManifest } from '@/lib/content';
import { SiteHeader } from '@/components/SiteHeader';
import { NavProvider } from '@/components/NavContext';
import { ProgressProvider } from '@/lib/progress';
import { VaultProvider } from '@/components/VaultProvider';
import { VaultUnlockDialog } from '@/components/VaultUnlockDialog';

/** 私密密文包只在配置了主密码的构建里存在 */
const hasPrivateBundle = fs.existsSync(
  path.join(process.cwd(), 'public', 'private-vault.enc.json'),
);

export const metadata: Metadata = {
  title: {
    default: 'xxuntilu guides · 测试与 AI 工程知识库',
    template: '%s · xxuntilu guides',
  },
  description:
    '接口测试、用例设计、业务域与 Agent 评测的公开学习笔记：三栏阅读、清单勾选、自测卡片；私密笔记用 AES-GCM 密文隔离。',
  authors: [{ name: '梁尹澳' }],
  openGraph: {
    title: 'xxuntilu guides · 测试与 AI 工程知识库',
    description: '接口测试 / 业务知识 / Agent 评测的公开学习笔记',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f6f5f2',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const manifest = getManifest();
  return (
    <html lang="zh-CN">
      <body>
        <ProgressProvider>
          <VaultProvider available={hasPrivateBundle}>
            <NavProvider>
              <div className="shell">
                <SiteHeader totalNotes={manifest.stats.notes} repo="https://github.com/Jasonlya/xxuntilu-guides" />
                {children}
              </div>
              <VaultUnlockDialog />
            </NavProvider>
          </VaultProvider>
        </ProgressProvider>
      </body>
    </html>
  );
}
