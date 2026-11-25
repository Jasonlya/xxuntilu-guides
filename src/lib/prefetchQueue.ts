type Prefetch = (href: string) => void;

interface Task {
  href: string;
  prefetch: Prefetch;
}

/**
 * 预取队列：串行 + 固定间隔发送。
 *
 * 之前的两种极端都不对：
 *   - Next 默认：44 个侧栏链接一进视口就全量并发预取，一个页面能打出 28 个请求，
 *     带宽瞬间打满，真正点击的那一次反而排在队尾（用户感受就是「切换很慢」）。
 *   - 完全不预取：每次点击都要等一整轮 TTFB（GitHub Pages 约 0.8s），同样慢。
 *
 * 这里取中间：进视口的链接排队、按间隔逐个发；悬停/按下的插到队首。
 * 顺序发送不抢带宽，侧栏可见部分能在 2 秒内全部预热，点击命中即是热缓存。
 */
const queue: Task[] = [];
/** href → 上次预取时间；超过 TTL 要重发，否则 Router Cache 过期后点击仍要等网络 */
const prefetched = new Map<string, number>();
const TTL_MS = 25_000;

const GAP_MS = 220;
const MIN_GAP_MS = 70;
let timer: number | null = null;
let lastSent = 0;

function clearTimer() {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
}

function pump() {
  timer = null;
  const task = queue.shift();
  if (!task) return;

  if (!isFresh(task.href)) {
    lastSent = Date.now();
    try {
      task.prefetch(task.href);
      prefetched.set(task.href, lastSent);
    } catch {
      prefetched.delete(task.href);
    }
  }

  if (queue.length > 0) {
    timer = window.setTimeout(pump, GAP_MS);
  }
}

function schedule() {
  if (timer !== null || queue.length === 0) return;
  const wait = Math.max(GAP_MS, GAP_MS - (Date.now() - lastSent));
  timer = window.setTimeout(pump, wait);
}

function pumpSoon() {
  const wait = Math.max(MIN_GAP_MS, MIN_GAP_MS - (Date.now() - lastSent));
  clearTimer();
  timer = window.setTimeout(pump, wait);
}

function isFresh(href: string) {
  const at = prefetched.get(href);
  return Boolean(at && Date.now() - at < TTL_MS);
}

export function queuePrefetch(href: string, prefetch: Prefetch, priority = false) {
  if (!href || isFresh(href)) return;

  const existing = queue.findIndex((task) => task.href === href);
  if (existing >= 0) {
    if (!priority) return;
    const [task] = queue.splice(existing, 1);
    queue.unshift(task);
    pumpSoon();
    return;
  }

  const task = { href, prefetch };
  if (priority) {
    queue.unshift(task);
    pumpSoon();
  } else {
    queue.push(task);
    schedule();
  }
}
