import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDomain, getManifest } from '@/lib/content';
import { DomainView } from '@/components/DomainView';

export const dynamicParams = false;

export function generateStaticParams() {
  return getManifest().domains.map((domain) => ({ domain: domain.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ domain: string }> }): Promise<Metadata> {
  const { domain: domainId } = await params;
  const domain = getDomain(decodeURIComponent(domainId));
  if (!domain) return { title: '知识域不存在' };
  return { title: domain.title, description: domain.desc };
}

export default async function DomainPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain: domainId } = await params;
  const id = decodeURIComponent(domainId);
  const domain = getDomain(id);
  if (!domain) notFound();
  return <DomainView domain={domain} domains={getManifest().domains} />;
}
