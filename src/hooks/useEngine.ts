// Drives the built-in engine: whenever it is the engine's turn in a live game,
// search (in setTimeout chunks) and hand the move back. Cancels on unmount or
// when the position changes under it (StrictMode's double-run included).
import { useEffect, useRef } from 'react';
import { findBestMove } from '../lib/engine';
import type { EngineMove } from '../lib/engine';
import type { EngineLevel } from '../lib/types';

interface Options {
  active: boolean;
  fen: string | null;
  level: EngineLevel;
  onMove: (m: EngineMove) => void;
}

const MIN_THINK_MS = 350;

export function useEngine({ active, fen, level, onMove }: Options): void {
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    if (!active || !fen) return;
    let cancelled = false;
    const started = Date.now();
    const handle = findBestMove(fen, level);
    (async () => {
      const m = await handle.promise;
      if (cancelled || !m) return;
      const wait = Math.max(0, MIN_THINK_MS - (Date.now() - started));
      if (wait) await new Promise((r) => setTimeout(r, wait));
      if (cancelled) return;
      onMoveRef.current(m);
    })();
    return () => {
      cancelled = true;
      handle.cancel();
    };
  }, [active, fen, level]);
}
