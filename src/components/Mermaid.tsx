'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 架构图渲染。mermaid 本体是一个 ~640KB 的独立 chunk，而且 render 是同步阻塞的：
 * 一篇带 3 张图的笔记如果在跳转瞬间全渲染，主线程会被按住几百毫秒。
 * 这里改成「进入视口前 400px 才渲染」，首屏只画看得见的那张。
 */
export function Mermaid({ chart }: { chart: string }) {
  const holder = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = holder.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'neutral',
          securityLevel: 'strict',
          fontFamily:
            '-apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
          flowchart: { curve: 'basis', padding: 12 },
          sequence: { actorMargin: 40 },
        });
        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
        const { svg } = await mermaid.render(id, chart);
        if (!cancelled && holder.current) {
          holder.current.innerHTML = svg;
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart, visible]);

  return (
    <div className="mermaid-block">
      {failed ? (
        <pre className="mermaid-fallback">{chart}</pre>
      ) : (
        <div ref={holder} aria-label="架构图" style={visible ? undefined : { minHeight: 180 }} />
      )}
    </div>
  );
}
