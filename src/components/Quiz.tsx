'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, CircleHelp, RotateCcw } from 'lucide-react';
import { useProgress } from '@/lib/progress';
import type { QuizItem } from '@/lib/markdown';
import { Markdown } from './Markdown';

interface Props {
  slug: string;
  items: QuizItem[];
}

export function Quiz({ slug, items }: Props) {
  const { quizMarks, setQuizMark } = useProgress();
  const marks = quizMarks(slug);
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const [allOpen, setAllOpen] = useState(false);

  const stats = useMemo(() => {
    let ok = 0;
    let review = 0;
    for (const item of items) {
      const mark = marks[String(item.index)];
      if (mark === 'ok') ok += 1;
      else if (mark === 'review') review += 1;
    }
    return { ok, review, untouched: items.length - ok - review };
  }, [items, marks]);

  if (!items.length) {
    return (
      <div className="tab-empty">
        本篇没有可抽取的问答。
        <br />
        自测题来自「面试问答」或技术篇的 Q1–Q10 结构。
      </div>
    );
  }

  const toggle = (index: number) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div>
      <div className="quiz-score">
        <CircleHelp size={15} color="var(--accent)" />
        <span>
          共 <b>{items.length}</b> 题 · 已掌握 <b style={{ color: 'var(--ok)' }}>{stats.ok}</b> · 待复习{' '}
          <b style={{ color: 'var(--warn)' }}>{stats.review}</b> · 未标记 {stats.untouched}
        </span>
        <button
          type="button"
          className="btn small subtle"
          style={{ marginLeft: 'auto' }}
          onClick={() => {
            const next = allOpen ? new Set<number>() : new Set(items.map((item) => item.index));
            setAllOpen(!allOpen);
            setOpen(next);
          }}
        >
          {allOpen ? '收起全部' : '展开全部答案'}
        </button>
      </div>

      <div className="quiz-list">
        {items.map((item) => {
          const isOpen = open.has(item.index);
          const mark = marks[String(item.index)];
          return (
            <div className="quiz-card" key={item.index}>
              <div className="quiz-q">
                <span className="quiz-index">Q{item.index + 1}</span>
                <span className="quiz-question">{item.question}</span>
                {mark === 'ok' && <span className="quiz-tag ok">已掌握</span>}
                {mark === 'review' && <span className="quiz-tag review">待复习</span>}
              </div>

              <div className="quiz-actions">
                <button type="button" className="btn small" onClick={() => toggle(item.index)}>
                  <ChevronDown
                    size={12}
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
                  />
                  {isOpen ? '收起答案' : '显示参考答案'}
                </button>
                {mark ? (
                  <button
                    type="button"
                    className="btn small subtle"
                    onClick={() => setQuizMark(slug, item.index, null)}
                  >
                    <RotateCcw size={11} />
                    清除标记
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => setQuizMark(slug, item.index, 'ok')}
                    >
                      <CheckCircle2 size={11} />
                      掌握了
                    </button>
                    <button
                      type="button"
                      className="btn small subtle"
                      onClick={() => setQuizMark(slug, item.index, 'review')}
                    >
                      待复习
                    </button>
                  </>
                )}
              </div>

              {isOpen && (
                <div className="quiz-body">
                  <Markdown source={item.answer} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
