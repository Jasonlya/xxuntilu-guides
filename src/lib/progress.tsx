'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

type QuizMark = 'ok' | 'review';

export interface ProgressState {
  read: Record<string, number>;
  checks: Record<string, number[]>;
  quiz: Record<string, Record<string, QuizMark>>;
  last: { slug: string; title: string; at: number } | null;
}

const STORAGE_KEY = 'xxg.progress.v1';

const emptyState: ProgressState = { read: {}, checks: {}, quiz: {}, last: null };

interface ProgressContextValue {
  state: ProgressState;
  ready: boolean;
  isRead: (slug: string) => boolean;
  markRead: (slug: string, title: string, value?: boolean) => void;
  checkedSet: (slug: string) => Set<number>;
  toggleCheck: (slug: string, index: number) => void;
  setChecks: (slug: string, indexes: number[]) => void;
  resetChecks: (slug: string) => void;
  setQuizMark: (slug: string, index: number, mark: QuizMark | null) => void;
  quizMarks: (slug: string) => Record<string, QuizMark>;
  reset: () => void;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

function load(): ProgressState {
  if (typeof window === 'undefined') return emptyState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState;
    const parsed = JSON.parse(raw) as Partial<ProgressState>;
    return {
      read: parsed.read && typeof parsed.read === 'object' ? parsed.read : {},
      checks: parsed.checks && typeof parsed.checks === 'object' ? parsed.checks : {},
      quiz: parsed.quiz && typeof parsed.quiz === 'object' ? parsed.quiz : {},
      last: parsed.last ?? null,
    };
  } catch {
    return emptyState;
  }
}

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ProgressState>(emptyState);
  const [ready, setReady] = useState(false);
  const skipWrite = useRef(true);

  useEffect(() => {
    setState(load());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (skipWrite.current) {
      skipWrite.current = false;
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* 隐私模式下写入失败不阻断阅读 */
    }
  }, [state, ready]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setState(load());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const markRead = useCallback((slug: string, title: string, value = true) => {
    setState((prev) => {
      const read = { ...prev.read };
      if (value) read[slug] = Date.now();
      else delete read[slug];
      return { ...prev, read, last: value ? { slug, title, at: Date.now() } : prev.last };
    });
  }, []);

  const toggleCheck = useCallback((slug: string, index: number) => {
    setState((prev) => {
      const current = new Set(prev.checks[slug] || []);
      if (current.has(index)) current.delete(index);
      else current.add(index);
      return { ...prev, checks: { ...prev.checks, [slug]: [...current].sort((a, b) => a - b) } };
    });
  }, []);

  const setChecks = useCallback((slug: string, indexes: number[]) => {
    setState((prev) => ({ ...prev, checks: { ...prev.checks, [slug]: indexes } }));
  }, []);

  const resetChecks = useCallback((slug: string) => {
    setState((prev) => {
      const checks = { ...prev.checks };
      delete checks[slug];
      return { ...prev, checks };
    });
  }, []);

  const setQuizMark = useCallback((slug: string, index: number, mark: QuizMark | null) => {
    setState((prev) => {
      const marks = { ...(prev.quiz[slug] || {}) };
      if (mark) marks[String(index)] = mark;
      else delete marks[String(index)];
      return { ...prev, quiz: { ...prev.quiz, [slug]: marks } };
    });
  }, []);

  const value = useMemo<ProgressContextValue>(
    () => ({
      state,
      ready,
      isRead: (slug) => Boolean(state.read[slug]),
      markRead,
      checkedSet: (slug) => new Set(state.checks[slug] || []),
      toggleCheck,
      setChecks,
      resetChecks,
      setQuizMark,
      quizMarks: (slug) => state.quiz[slug] || {},
      reset: () => setState(emptyState),
    }),
    [state, ready, markRead, toggleCheck, setChecks, resetChecks, setQuizMark],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress 必须在 ProgressProvider 内使用');
  return ctx;
}

/** 文章滚动进度（0~1），用于顶部细进度条 */
export function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(height <= 0 ? 0 : Math.min(1, Math.max(0, scrollTop / height)));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  return progress;
}
