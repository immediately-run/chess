// Boot sequence: open the private (per-user) store FIRST and keep it; it holds
// `config.json` which remembers the shared space (by id) so the next boot
// re-mounts it with no prompt. Solo games always live in the private store.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createSharedStore,
  openPrivateStore,
  openRememberedSpace,
  pickSharedStore,
  readJson,
  writeJson,
} from '../lib/store';
import type { Store } from '../lib/store';
import type { Config } from '../lib/types';

/** Sub-folder inside a space so our files sit next to other apps' data. */
const SPACE_SUB = 'chess';

export interface StorageState {
  phase: 'booting' | 'ready';
  privateStore: Store | null;
  shared: Store | null;
  config: Config;
  busy: boolean;
  error: string | null;
}

const errorCode = (e: unknown): string | undefined =>
  typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : undefined;

const describe = (e: unknown, fallback: string): string => {
  const code = errorCode(e);
  if (code === 'forbidden') return 'This app is not allowed to open spaces here.';
  if (code === 'auth-required') return 'Sign in to use a shared space.';
  return e instanceof Error && e.message ? e.message : fallback;
};

export function useStorage() {
  const [state, setState] = useState<StorageState>({
    phase: 'booting',
    privateStore: null,
    shared: null,
    config: {},
    busy: false,
    error: null,
  });
  const configRef = useRef<Config>({});
  const privateRef = useRef<Store | null>(null);

  const saveConfig = useCallback(async (patch: Partial<Config>) => {
    const next = { ...configRef.current, ...patch };
    for (const k of Object.keys(next) as (keyof Config)[]) if (next[k] === undefined) delete next[k];
    configRef.current = next;
    setState((s) => ({ ...s, config: next }));
    const priv = privateRef.current;
    if (priv && priv.mode === 'rw') {
      try {
        await writeJson(`${priv.root}/config.json`, next);
      } catch {
        /* config is a convenience; the session still works */
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false; // StrictMode runs this twice; only the survivor may act
    (async () => {
      let priv: Store | null = null;
      let error: string | null = null;
      try {
        priv = await openPrivateStore('data');
      } catch (e) {
        error = describe(e, 'Could not open private storage.');
      }
      const cfg = priv ? await readJson<Config>(`${priv.root}/config.json`, {}) : {};
      let shared: Store | null = null;
      if (priv && cfg.spaceId) {
        shared = await openRememberedSpace(cfg.spaceId, SPACE_SUB);
        if (!shared) error = 'The shared space you used last time is no longer available.';
      }
      if (cancelled) return;
      privateRef.current = priv;
      configRef.current = cfg;
      setState({ phase: 'ready', privateStore: priv, shared, config: cfg, busy: false, error });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const adopt = useCallback(
    async (store: Store) => {
      setState((s) => ({ ...s, shared: store, busy: false, error: null }));
      await saveConfig({ spaceId: store.spaceId, spaceName: store.name });
    },
    [saveConfig],
  );

  const run = useCallback(
    async (job: () => Promise<Store>, fallback: string) => {
      setState((s) => ({ ...s, busy: true, error: null }));
      try {
        await adopt(await job());
      } catch (e) {
        const code = errorCode(e);
        setState((s) => ({ ...s, busy: false, error: code === 'cancelled' ? null : describe(e, fallback) }));
      }
    },
    [adopt],
  );

  const openShared = useCallback(
    () => run(() => pickSharedStore(SPACE_SUB), 'Could not open that space.'),
    [run],
  );
  const createShared = useCallback(
    (name: string) => run(() => createSharedStore(name.trim() || 'Chess', SPACE_SUB), 'Could not create a space.'),
    [run],
  );
  const forgetShared = useCallback(async () => {
    setState((s) => ({ ...s, shared: null, error: null }));
    await saveConfig({ spaceId: undefined, spaceName: undefined });
  }, [saveConfig]);
  const clearError = useCallback(() => setState((s) => ({ ...s, error: null })), []);

  return { ...state, saveConfig, openShared, createShared, forgetShared, clearError };
}
