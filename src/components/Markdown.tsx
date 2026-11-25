'use client';

import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { CodeBlock } from './CodeBlock';
import { TableFrame } from './TableFrame';
import { Mermaid } from './Mermaid';

interface Props {
  source: string;
  className?: string;
}

function flattenText(node: unknown): string {
  if (node == null || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join('');
  if (typeof node === 'object' && node !== null && 'props' in node) {
    const props = (node as { props?: { children?: unknown } }).props;
    return flattenText(props?.children);
  }
  return '';
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

// 组件映射提到模块级：保持引用稳定，避免每次渲染都让全篇 markdown 重新计算
const COMPONENTS = {
  pre: ({ children }: { children?: React.ReactNode }) => {
    const child = Array.isArray(children) ? children[0] : children;
    const props = (child as { props?: { className?: string; children?: unknown } } | null)?.props;
    const className = props?.className || '';
    const code = flattenText(props?.children ?? children).replace(/\n$/, '');

    if (/language-mermaid/.test(className)) {
      return <Mermaid chart={code} />;
    }
    const lang = /language-([\w-]+)/.exec(className)?.[1] || '';
    return <CodeBlock code={code} lang={lang} />;
  },
  table: ({ children }: { children?: React.ReactNode }) => (
    <TableFrame>
      <table>{children}</table>
    </TableFrame>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
    if (href?.startsWith('missing:')) {
      return (
        <span className="wikilink-missing" title="该笔记未公开或尚未创建">
          {children}
        </span>
      );
    }
    if (href?.startsWith('/')) {
      return <Link href={href}>{children}</Link>;
    }
    return (
      <a href={href} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    );
  },
  img: ({ src, alt }: { src?: string | Blob; alt?: string }) => {
    const resolved =
      typeof src === 'string' && src.startsWith('/') ? `${basePath}${src}` : (src as string | undefined);
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={resolved} alt={alt || ''} loading="lazy" />;
  },
};

/**
 * 客户端 markdown 渲染：只给自测答案、私密随记这类「运行时才知道正文」的地方用。
 * 公开笔记的正文走构建期 renderArticle()，不会用到这里。
 */
export function Markdown({ source, className }: Props) {
  return (
    <div className={`prose ${className || ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]} components={COMPONENTS}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
