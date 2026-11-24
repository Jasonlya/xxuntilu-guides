import type { Metadata } from 'next';
import { VaultWorkspace } from '@/components/VaultWorkspace';
import { getManifest } from '@/lib/content';
import { SideNav } from '@/components/SideNav';

export const metadata: Metadata = {
  title: '个人保险箱',
  description: '用主密码在本机加密保存临时记录，永不上传。',
  robots: { index: false, follow: false },
};

export default function VaultPage() {
  return (
    <div className="layout">
      <SideNav domains={getManifest().domains} />
      <div className="content-col">
        <div className="domain-page">
          <h1 className="domain-title" style={{ fontSize: 26 }}>
            个人保险箱
          </h1>
          <p className="domain-lead" style={{ marginBottom: 22 }}>
            只在本机浏览器加密保存，主密码派生的密钥不落盘、不上传。
          </p>
          <VaultWorkspace />
        </div>
      </div>
    </div>
  );
}
