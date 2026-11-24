'use client';

import { useEffect, useRef, useState } from 'react';

export function Mermaid({ chart }: { chart: string }) {
  const holder = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
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
  }, [chart]);

  return (
    <div className="mermaid-block">
      {failed ? (
        <pre className="mermaid-fallback">{chart}</pre>
      ) : (
        <div ref={holder} aria-label="架构图" />
      )}
    </div>
  );
}
