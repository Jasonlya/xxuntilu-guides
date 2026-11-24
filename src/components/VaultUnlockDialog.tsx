'use client';

import { useEffect, useRef, useState } from 'react';
import { KeyRound, Lock, ShieldCheck, X } from 'lucide-react';
import { useVault } from './VaultProvider';

export function VaultUnlockDialog() {
  const { dialogOpen, closeDialog, unlock, busy, error } = useVault();
  const [pwd, setPwd] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dialogOpen) {
      setPwd('');
      const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [dialogOpen]);

  useEffect(() => {
    if (!dialogOpen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDialog();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialogOpen, closeDialog]);

  if (!dialogOpen) return null;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pwd.trim() || busy) return;
    const ok = await unlock(pwd);
    if (ok) setPwd('');
  };

  return (
    <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && closeDialog()}>
      <form className="modal" onSubmit={onSubmit} role="dialog" aria-modal="true" aria-label="解锁私密区">
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <KeyRound size={16} />
          </span>
          <h3 style={{ margin: 0 }}>输入主密码解锁私密区</h3>
          <button
            type="button"
            className="icon-btn ghost"
            style={{ marginLeft: 'auto', height: 26, minWidth: 26 }}
            onClick={closeDialog}
            aria-label="关闭"
          >
            <X size={15} />
          </button>
        </div>
        <p>
          密钥由 PBKDF2-SHA256（31 万次迭代）在本地派生，密文在浏览器内解开；
          密码与明文都不会离开这台设备，关闭页面即自动锁定。
        </p>
        <label htmlFor="vault-password">主密码</label>
        <input
          id="vault-password"
          ref={inputRef}
          className="field"
          type="password"
          value={pwd}
          autoComplete="current-password"
          onChange={(event) => setPwd(event.target.value)}
          placeholder="输入主密码…"
        />
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn subtle" onClick={closeDialog}>
            取消
          </button>
          <button type="submit" className="btn primary" disabled={busy || !pwd.trim()}>
            {busy ? <Lock size={13} /> : <ShieldCheck size={13} />}
            {busy ? '解密中…' : '确认解锁'}
          </button>
        </div>
      </form>
    </div>
  );
}
