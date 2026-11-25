'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';

interface NavContextValue {
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
  /**
   * 侧栏展开的知识域 / 筛选词 / 滚动位置都放在 Provider 里。
   * SideNav 挂在每个页面内部，换页时会被卸载重建；状态留在 layout 层才能保持住，
   * 否则每次点导航都会「列表重置 + 滚回顶部」。
   * null = 还没初始化：由 SideNav 按当前路由决定默认展开哪个域（SSR 也能给出正确结构）
   */
  openDomains: string[] | null;
  filter: string;
  setFilter: (value: string) => void;
  toggleDomain: (id: string) => void;
  ensureDomainOpen: (id?: string) => void;
  /** null 表示这次会话还没定位过：交由 SideNav 首次挂载时对齐当前文章 */
  sidebarScroll: MutableRefObject<number | null>;
}

const NavContext = createContext<NavContextValue | null>(null);

export function NavProvider({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const [openDomains, setOpenDomains] = useState<string[] | null>(null);
  const [filter, setFilterState] = useState('');
  const sidebarScroll = useRef<number | null>(null);

  const setFilter = useCallback((value: string) => {
    setFilterState(value);
    // 换了筛选词，列表高度完全变了，旧的滚动位置没有意义
    sidebarScroll.current = null;
  }, []);

  const ensureDomainOpen = useCallback((id?: string) => {
    if (!id) return;
    setOpenDomains((prev) => {
      if (prev === null) return [id];
      return prev.includes(id) ? prev : [...prev, id];
    });
  }, []);

  const toggleDomain = useCallback((id: string) => {
    setOpenDomains((prev) => {
      const list = prev ?? [];
      if (list.includes(id)) return list.filter((item) => item !== id);
      return [...list, id];
    });
  }, []);

  // 任何一次站内点击（侧栏、面包屑、上下篇、搜索结果…）都先把侧栏位置抓下来。
  // 不看 scroll 事件：换页时旧侧栏被摘除，浏览器归零 scrollTop 抛出的那个 0 会把真实位置覆盖掉。
  useEffect(() => {
    const capture = () => {
      const el = document.querySelector('.sidebar');
      if (el) sidebarScroll.current = el.scrollTop;
    };
    document.addEventListener('click', capture, true);
    return () => document.removeEventListener('click', capture, true);
  }, []);

  const value = useMemo(
    () => ({
      navOpen,
      setNavOpen,
      openDomains,
      filter,
      setFilter,
      toggleDomain,
      ensureDomainOpen,
      sidebarScroll,
    }),
    [navOpen, openDomains, filter, setFilter, toggleDomain, ensureDomainOpen],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav() {
  const context = useContext(NavContext);
  if (!context) {
    // Provider 之外的兜底：保持组件可独立渲染（如测试、Storybook）
    return {
      navOpen: false,
      setNavOpen: () => {},
      openDomains: [],
      filter: '',
      setFilter: () => {},
      toggleDomain: () => {},
      ensureDomainOpen: () => {},
      sidebarScroll: { current: null },
    } satisfies NavContextValue;
  }
  return context;
}
