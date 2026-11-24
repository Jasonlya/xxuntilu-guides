'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  decryptBundle,
  publicAsset,
  type EncryptedPayload,
  type PrivateBundle,
} from '@/lib/vaultCrypto';

type VaultStatus = 'loading' | 'unavailable' | 'locked' | 'unlocked';

interface VaultContextValue {
  status: VaultStatus;
  count: number;
  bundle: PrivateBundle | null;
  dialogOpen: boolean;
  error: string;
  busy: boolean;
  requestUnlock: () => void;
  closeDialog: () => void;
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;
  sessionPassword: () => string;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<VaultStatus>('loading');
  const [count, setCount] = useState(0);
  const [bundle, setBundle] = useState<PrivateBundle | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const payloadRef = useRef<EncryptedPayload | null>(null);
  const passwordRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(publicAsset('/private-vault.enc.json'), { cache: 'no-store' });
        if (!res.ok) throw new Error('no-bundle');
        const payload = (await res.json()) as EncryptedPayload;
        if (cancelled) return;
        payloadRef.current = payload;
        setCount(Number(payload.meta?.count || 0));
        setStatus('locked');
      } catch {
        if (!cancelled) setStatus('unavailable');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const unlock = useCallback(async (password: string) => {
    setBusy(true);
    setError('');
    try {
      let payload = payloadRef.current;
      if (!payload) {
        const res = await fetch(publicAsset('/private-vault.enc.json'), { cache: 'no-store' });
        if (!res.ok) throw new Error('未找到密文包');
        payload = (await res.json()) as EncryptedPayload;
        payloadRef.current = payload;
      }
      const decrypted = await decryptBundle(payload, password);
      passwordRef.current = password;
      setBundle(decrypted);
      setCount(decrypted.count || decrypted.notes.length);
      setStatus('unlocked');
      setDialogOpen(false);
      return true;
    } catch {
      setError('密码错误，或该密文包不属于此密码');
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const lock = useCallback(() => {
    passwordRef.current = '';
    setBundle(null);
    setStatus((prev) => (prev === 'unavailable' ? prev : 'locked'));
  }, []);

  const value = useMemo<VaultContextValue>(
    () => ({
      status,
      count,
      bundle,
      dialogOpen,
      error,
      busy,
      requestUnlock: () => {
        setError('');
        setDialogOpen(true);
      },
      closeDialog: () => setDialogOpen(false),
      unlock,
      lock,
      sessionPassword: () => passwordRef.current,
    }),
    [status, count, bundle, dialogOpen, error, busy, unlock, lock],
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault 必须在 VaultProvider 内使用');
  return ctx;
}
