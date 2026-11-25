'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface Props {
  code: string;
  lang?: string;
}

/** 代码块里唯一需要交互的部分：复制按钮。剩下的 pre/code 结构在构建期就渲染好 */
export function CodeBlock({ code, lang }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* 剪贴板不可用时静默失败 */
    }
  };

  return (
    <div className="code-block">
      <pre>
        <code className={lang ? `language-${lang}` : undefined}>{code}</code>
      </pre>
      {lang && <span className="code-lang">{lang}</span>}
      <button type="button" className="copy-btn" onClick={copy} aria-label="复制代码">
        {copied ? <Check size={11} /> : <Copy size={11} />}
        {copied ? '已复制' : '复制'}
      </button>
    </div>
  );
}
