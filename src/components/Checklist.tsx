'use client';

import { ListChecks, RotateCcw } from 'lucide-react';
import { useProgress } from '@/lib/progress';
import { renderInlineSegments, type CheckItem } from '@/lib/markdown';
import { Ring } from './Ring';

interface Props {
  slug: string;
  items: CheckItem[];
  fromSection: boolean;
}

export function Checklist({ slug, items, fromSection }: Props) {
  const { checkedSet, toggleCheck, setChecks, resetChecks } = useProgress();
  const done = checkedSet(slug);
  const count = items.filter((item) => done.has(item.index)).length;
  const percent = items.length ? count / items.length : 0;

  if (!items.length) {
    return (
      <div className="tab-empty">
        本篇没有「必查清单」。
        <br />
        技术篇通常用问答链组织，可以切到「自测」按问题过一遍。
      </div>
    );
  }

  return (
    <div className="checklist">
      <div className="checklist-head">
        <span className="checklist-ring">
          <Ring percent={percent} size={42} stroke={3.5} />
        </span>
        <div className="checklist-head-text">
          <div className="checklist-head-title">
            {fromSection ? '必查清单' : '全文任务项'} · {count} / {items.length}
          </div>
          <div className="checklist-head-sub">
            勾选状态只保存在本机浏览器，换设备不会同步；每条都是一个可执行的断言动作。
          </div>
        </div>
        <button
          type="button"
          className="btn small subtle"
          onClick={() => resetChecks(slug)}
          disabled={count === 0}
          title="清空本篇勾选"
        >
          <RotateCcw size={12} />
          重置
        </button>
        <button
          type="button"
          className="btn small"
          onClick={() =>
            setChecks(
              slug,
              count === items.length ? [] : items.map((item) => item.index),
            )
          }
        >
          <ListChecks size={12} />
          {count === items.length ? '全部取消' : '全部勾选'}
        </button>
      </div>

      {items.map((item) => {
        const checked = done.has(item.index);
        return (
          <div
            key={item.index}
            className={`check-item ${checked ? 'checked' : ''}`}
            onClick={() => toggleCheck(slug, item.index)}
            role="checkbox"
            aria-checked={checked}
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleCheck(slug, item.index);
              }
            }}
          >
            <span className="check-box">
              {checked && (
                <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden>
                  <path d="M1.5 5.2 3.9 7.6 8.5 2.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span className="check-text">
              {renderInlineSegments(item.text).map((segment, i) => {
                if (segment.type === 'code') return <code key={i}>{segment.value}</code>;
                if (segment.type === 'strong') return <strong key={i}>{segment.value}</strong>;
                if (segment.type === 'link')
                  return (
                    <a key={i} href={segment.href} target="_blank" rel="noreferrer noopener">
                      {segment.value}
                    </a>
                  );
                return <span key={i}>{segment.value}</span>;
              })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
