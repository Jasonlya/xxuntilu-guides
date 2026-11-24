'use client';

import { useEffect, useRef, useState } from 'react';
import { KeyRound, Lock, LockOpen, Plus, Save, ShieldAlert, Trash2 } from 'lucide-react';
import { decryptVaultData, encryptVaultData } from '@/lib/vaultCrypto';
import { useVault } from '@/components/VaultProvider';
import { Markdown } from '@/components/Markdown';

interface StoredItem {
  id: string;
  updated: number;
  cipher: string;
}

interface VaultStore {
  version: 1;
  items: StoredItem[];
}

interface PlainItem {
  id: string;
  title: string;
  body: string;
  updated: number;
}

const STORAGE_KEY = 'xxg.vaultbox.v1';

function readStore(): VaultStore {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, items: [] };
    const parsed = JSON.parse(raw) as VaultStore;
    return { version: 1, items: Array.isArray(parsed.items) ? parsed.items : [] };
  } catch {
    return { version: 1, items: [] };
  }
}

function writeStore(store: VaultStore) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function VaultWorkspace() {
  const vault = useVault();
  const [store, setStore] = useState<VaultStore>({ version: 1, items: [] });
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [items, setItems] = useState<PlainItem[]>([]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeId, setActiveId] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [preview, setPreview] = useState(false);
  const [notice, setNotice] = useState('');
  const passwordRef = useRef('');

  useEffect(() => {
    const loaded = readStore();
    setStore(loaded);
    setReady(true);
    const session = vault.sessionPassword();
    if (session && loaded.items.length) {
      (async () => {
        try {
          const plain = await Promise.all(
            loaded.items.map(async (item) => {
              const text = await decryptVaultData(item.cipher, session);
              const parsed = JSON.parse(text) as { title: string; body: string };
              return { id: item.id, title: parsed.title, body: parsed.body, updated: item.updated };
            }),
          );
          passwordRef.current = session;
          setItems(plain);
          setAuthed(true);
          if (plain[0]) select(plain[0]);
        } catch {
          /* 会话密码与此保险箱不匹配时保持锁定 */
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = (item: PlainItem) => {
    setActiveId(item.id);
    setDraftTitle(item.title);
    setDraftBody(item.body);
    setPreview(false);
    setNotice('');
  };

  const newItem = () => {
    setActiveId('new');
    setDraftTitle('');
    setDraftBody('');
    setPreview(false);
    setNotice('');
  };

  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    const pwd = password.trim();
    if (pwd.length < 8) {
      setError('主密码至少 8 位（PBKDF2 强度下限）');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (store.items.length === 0) {
        if (pwd !== confirm.trim()) {
          setError('两次输入的密码不一致');
          return;
        }
        passwordRef.current = pwd;
        setAuthed(true);
        newItem();
        return;
      }
      const plain = await Promise.all(
        store.items.map(async (item) => {
          const text = await decryptVaultData(item.cipher, pwd);
          const parsed = JSON.parse(text) as { title: string; body: string };
          return { id: item.id, title: parsed.title, body: parsed.body, updated: item.updated };
        }),
      );
      passwordRef.current = pwd;
      setItems(plain);
      setAuthed(true);
      if (plain[0]) select(plain[0]);
    } catch {
      setError('密码错误，无法解密本地数据');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const pwd = passwordRef.current;
    if (!pwd) return;
    if (!draftTitle.trim() && !draftBody.trim()) {
      setError('标题和内容不能都为空');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const cipher = await encryptVaultData(
        JSON.stringify({ title: draftTitle.trim() || '未命名', body: draftBody }),
        pwd,
      );
      const id = activeId && activeId !== 'new' ? activeId : `v-${Date.now().toString(36)}`;
      const nextItems = store.items.filter((item) => item.id !== id);
      nextItems.unshift({ id, updated: Date.now(), cipher });
      const nextStore: VaultStore = { version: 1, items: nextItems };
      writeStore(nextStore);
      setStore(nextStore);
      setItems((prev) => {
        const plain = prev.filter((item) => item.id !== id);
        plain.unshift({ id, title: draftTitle.trim() || '未命名', body: draftBody, updated: Date.now() });
        return plain;
      });
      setActiveId(id);
      setNotice('已加密写入本机浏览器');
    } catch {
      setError('保存失败，可能是浏览器禁用了 LocalStorage');
    } finally {
      setBusy(false);
    }
  };

  const remove = (id: string) => {
    if (!window.confirm('删除这条本地加密记录？删除后无法恢复。')) return;
    const nextStore: VaultStore = { version: 1, items: store.items.filter((item) => item.id !== id) };
    writeStore(nextStore);
    setStore(nextStore);
    setItems((prev) => prev.filter((item) => item.id !== id));
    if (activeId === id) {
      setActiveId('');
      setDraftTitle('');
      setDraftBody('');
    }
  };

  const lock = () => {
    passwordRef.current = '';
    setAuthed(false);
    setItems([]);
    setPassword('');
    setConfirm('');
    setDraftTitle('');
    setDraftBody('');
    setActiveId('');
    setError('');
  };

  if (!ready) {
    return <div className="locked-panel">读取本地保险箱…</div>;
  }

  if (!authed) {
    const firstTime = store.items.length === 0;
    return (
      <div className="locked-panel" style={{ textAlign: 'left', maxWidth: 460 }}>
        <div className="locked-icon" style={{ margin: '0 0 14px' }}>
          <KeyRound size={20} />
        </div>
        <h2>{firstTime ? '设置本地保险箱密码' : '解锁本地保险箱'}</h2>
        <p style={{ margin: '0 0 16px' }}>
          {firstTime
            ? '你临时想记的项目故事、Key、复盘，可以用主密码加密后存在这台设备的浏览器里。密码不会上传，忘记密码数据就解不开了。'
            : `本机已有 ${store.items.length} 条加密记录，输入主密码在本地解密。`}
        </p>
        <form onSubmit={unlock}>
          <label htmlFor="box-pwd">主密码</label>
          <input
            id="box-pwd"
            className="field"
            type="password"
            value={password}
            autoComplete={firstTime ? 'new-password' : 'current-password'}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="至少 8 位"
          />
          {firstTime && (
            <>
              <label htmlFor="box-pwd2">再输一次</label>
              <input
                id="box-pwd2"
                className="field"
                type="password"
                value={confirm}
                autoComplete="new-password"
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="确认主密码"
              />
            </>
          )}
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn primary" style={{ width: '100%' }} disabled={busy}>
            <LockOpen size={13} />
            {busy ? '处理中…' : firstTime ? '创建并进入' : '解锁'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="private-layout" style={{ gridTemplateColumns: '220px minmax(0, 1fr)' }}>
      <div className="private-list">
        <button type="button" className="btn small" style={{ width: '100%', marginBottom: 10 }} onClick={newItem}>
          <Plus size={12} /> 新建记录
        </button>
        {items.length === 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--ink-4)', padding: '8px 8px' }}>还没有记录</div>
        )}
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`private-item ${item.id === activeId ? 'active' : ''}`}
            onClick={() => select(item)}
          >
            {item.title}
          </button>
        ))}
        <button type="button" className="btn small subtle" style={{ marginTop: 10 }} onClick={lock}>
          <Lock size={11} /> 锁定并清除内存
        </button>
      </div>

      <div>
        <div className="vault-editor">
          <div className="vault-editor-head">
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder="标题，例如：某项目的复盘 / 某个 Key 的备注"
              style={{
                flex: 1,
                border: 0,
                outline: 0,
                background: 'transparent',
                fontSize: 13,
                fontWeight: 600,
              }}
            />
            <button type="button" className="btn small subtle" onClick={() => setPreview(!preview)}>
              {preview ? '继续编辑' : '预览'}
            </button>
            {activeId && activeId !== 'new' && (
              <button type="button" className="btn small subtle" onClick={() => remove(activeId)}>
                <Trash2 size={11} />
              </button>
            )}
            <button type="button" className="btn small primary" onClick={save} disabled={busy}>
              <Save size={11} /> 加密保存
            </button>
          </div>
          {preview ? (
            <div style={{ padding: '14px 16px' }}>
              <Markdown source={draftBody || '_（空）_'} />
            </div>
          ) : (
            <textarea
              value={draftBody}
              onChange={(event) => setDraftBody(event.target.value)}
              placeholder="支持 Markdown。内容会用主密码派生密钥加密后写入 LocalStorage。"
            />
          )}
        </div>
        {error && <p className="form-error" style={{ marginTop: 10 }}>{error}</p>}
        {notice && <p className="form-hint" style={{ marginTop: 10 }}>{notice}</p>}
        <p className="form-hint" style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 14 }}>
          <ShieldAlert size={13} style={{ flexShrink: 0, marginTop: 3 }} />
          <span>
            这些记录只存在当前浏览器（LocalStorage），不会同步到 GitHub 或服务器；换设备、清缓存都会消失。
            与「私密随记」不同，后者来自 Obsidian 的 <code>99-Private/</code>，由构建期加密后随站点发布。
          </span>
        </p>
      </div>
    </div>
  );
}
