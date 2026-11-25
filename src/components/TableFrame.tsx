'use client';

import { useEffect, useRef, useState } from 'react';

/** 表格外框：宽度溢出时显示左右渐隐，提示可横向滚动 */
export function TableFrame({ children }: { children?: React.ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: false, end: false });

  useEffect(() => {
    const el = scroller.current;
    if (!el) return undefined;

    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const start = el.scrollLeft > 1;
      const end = max > 1 && el.scrollLeft < max - 1;
      setEdge((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <div className="table-wrap">
      <div className="table-scroll" ref={scroller}>
        {children}
      </div>
      <span className={`table-edge left${edge.start ? ' on' : ''}`} aria-hidden="true" />
      <span className={`table-edge right${edge.end ? ' on' : ''}`} aria-hidden="true" />
    </div>
  );
}
