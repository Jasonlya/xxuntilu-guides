'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useRef, type FocusEvent, type MouseEvent, type TouchEvent } from 'react';

interface Props {
  href: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
  onMouseEnter?: (event: MouseEvent<HTMLAnchorElement>) => void;
  onMouseLeave?: (event: MouseEvent<HTMLAnchorElement>) => void;
  onFocus?: (event: FocusEvent<HTMLAnchorElement>) => void;
  onTouchStart?: (event: TouchEvent<HTMLAnchorElement>) => void;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  'aria-current'?: 'page' | undefined;
}

/**
 * 侧栏有 40+ 个链接，Next Link 默认会把进入视口的链接全部预取：
 * 一个笔记页打开就并发下 28 份 RSC 载荷（每份 60~80KB），把带宽占满，
 * 真正点击时反而排在预取后面 —— 表现就是「有的文档切换特别慢」。
 * 这里改成悬停/聚焦 90ms 后才预热，鼠标划过不触发，点击时仍是热缓存。
 */
export function SmartLink({
  href,
  className,
  title,
  children,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onTouchStart,
  onClick,
  'aria-current': ariaCurrent,
}: Props) {
  const router = useRouter();
  const timer = useRef<number | null>(null);

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const warm = useCallback(() => {
    cancel();
    timer.current = window.setTimeout(() => {
      timer.current = null;
      router.prefetch(href);
    }, 90);
  }, [cancel, href, router]);

  return (
    <Link
      href={href}
      prefetch={false}
      className={className}
      title={title}
      aria-current={ariaCurrent}
      onClick={onClick}
      onMouseEnter={(event) => {
        warm();
        onMouseEnter?.(event);
      }}
      onMouseLeave={(event) => {
        cancel();
        onMouseLeave?.(event);
      }}
      onFocus={(event) => {
        warm();
        onFocus?.(event);
      }}
      onBlur={cancel}
      onTouchStart={(event) => {
        // 触屏没有悬停，按下即预热，赶在手指抬起前发出请求
        router.prefetch(href);
        onTouchStart?.(event);
      }}
    >
      {children}
    </Link>
  );
}
