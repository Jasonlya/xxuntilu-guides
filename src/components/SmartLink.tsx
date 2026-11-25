'use client';

import Link, { useLinkStatus } from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, type FocusEvent, type MouseEvent, type TouchEvent } from 'react';
import { queuePrefetch } from '@/lib/prefetchQueue';

/** 导航进行中的小提示：点下去立刻有反馈，不用干等正文 */
function PendingDot() {
  const { pending } = useLinkStatus();
  return pending ? <span className="nav-pending" aria-hidden="true" /> : null;
}

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
 * 侧栏有很多链接，Next 默认会把进入视口的全部并发预取（实测一页 28 个请求），
 * 带宽被预取占满，真正点击的请求只能排队 —— 这就是「切换很慢」的根因。
 *
 * 这里 prefetch={false} 关掉默认行为，改成：
 *   - 链接在视口里停留 260ms 后进入预取队列（串行限速，见 prefetchQueue）
 *   - 悬停 / 触屏按下 → 插队立刻发
 * 既不抢带宽，常见点击基本都命中热缓存。
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
  const anchor = useRef<HTMLAnchorElement>(null);
  const timer = useRef<number | null>(null);

  const cancel = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const warm = (priority: boolean) => {
    queuePrefetch(href, (target) => router.prefetch(target), priority);
  };

  useEffect(() => {
    const el = anchor.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      warm(false);
      return undefined;
    }

    // 只预热看得见的：停留 260ms 才开始排队，快速滚过去的链接不占带宽
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          cancel();
          timer.current = window.setTimeout(() => {
            timer.current = null;
            warm(false);
          }, 260);
        } else {
          cancel();
        }
      },
      { rootMargin: '120px 0px' },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href]);

  return (
    <Link
      ref={anchor}
      href={href}
      prefetch={false}
      className={className}
      title={title}
      aria-current={ariaCurrent}
      onClick={onClick}
      onMouseEnter={(event) => {
        warm(true);
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        warm(true);
        onFocus?.(event);
      }}
      onTouchStart={(event) => {
        // 触屏没有悬停，按下即插队预热，赶在手指抬起前发出
        warm(true);
        onTouchStart?.(event);
      }}
      onMouseLeave={onMouseLeave}
    >
      {children}
      <PendingDot />
    </Link>
  );
}
