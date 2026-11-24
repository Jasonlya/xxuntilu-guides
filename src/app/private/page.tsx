import type { Metadata } from 'next';
import { getLinkmap, getManifest } from '@/lib/content';
import { PrivateArea } from '@/components/PrivateArea';

export const metadata: Metadata = {
  title: '私密随记',
  description: 'AES-GCM 密文隔离的个人随记，需主密码在浏览器本地解锁。',
  robots: { index: false, follow: false },
};

export default function PrivatePage() {
  return <PrivateArea domains={getManifest().domains} publicLinkmap={getLinkmap()} />;
}
