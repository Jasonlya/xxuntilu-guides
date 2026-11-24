'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { Check, Copy } from 'lucide-react';
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

function CodeBlock({ children }: { children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const child = Array.isArray(children) ? children[0] : children;
  const props = (child as { props?: { className?: string; children?: unknown } } | null)?.props;
  const className = props?.className || '';
  const lang = /language-([\w-]+)/.exec(className)?.[1] || '';
  const code = flattenText(props?.children ?? children).replace(/\n$/, '');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* 剪贴板不可用时静默失败 */
    }
  };

  return (
    <div className="code-block">
      <pre>
        <code className={className}>{code}</code>
      </pre>
      {lang && <span className="code-lang">{lang}</span>}
      <button type="button" className="copy-btn" onClick={copy} aria-label="复制代码">
        {copied ? <Check size={11} /> : <Copy size={11} />}
        {copied ? '已复制' : '复制'}
      </button>
    </div>
  );
}

export function Markdown({ source, className }: Props) {
  return (
    <div className={`prose ${className || ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={{
          pre: ({ children }) => {
            const child = Array.isArray(children) ? children[0] : children;
            const props = (child as { props?: { className?: string; children?: unknown } } | null)?.props;
            const className = props?.className || '';
            if (/language-mermaid/.test(className)) {
              return <Mermaid chart={flattenText(props?.children)} />;
            }
            return <CodeBlock>{children}</CodeBlock>;
          },
          table: ({ children }) => (
            <div className="table-wrap">
              <div className="table-scroll">
                <table>{children}</table>
              </div>
            </div>
          ),
          a: ({ href, children }) => {
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
          img: ({ src, alt }) => {
            const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
            const resolved = typeof src === 'string' && src.startsWith('/') ? `${base}${src}` : src;
            // eslint-disable-next-line @next/next/no-img-element
            return <img src={resolved} alt={alt || ''} loading="lazy" />;
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
