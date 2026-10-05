// The games in one store, kept fresh: one recursive WATCH on the games
// directory (the relay reports the changed path, so a move inside a game is
// caught too). No poll, no interval — no cadence remains.
import { useCallback, useEffect, useState } from 'react';
import { gamesDir, listGames } from '../lib/games';
import { watchDir } from '../lib/store';
import type { Store } from '../lib/store';
import type { GameFiles } from '../lib/types';


export function useGamesList(store: Store | null) {
  const [games, setGames] = useState<GameFiles[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!store) return;
    try {
      setGames(await listGames(store));
    } catch {
      /* keep the previous list */
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    (async () => {
      await reload();
    })();
    const tick = () => {
      if (!cancelled) void reload();
    };
    // R3-901: one recursive watch on games/ replaces the 3 s poll AND the 6 s
    // interval — the relay reports the changed path; no cadence remains.
    const stop = watchDir(gamesDir(store), tick);
    return () => {
      cancelled = true;
      stop();
    };
  }, [store, reload]);

  return { games, loading, reload };
}
