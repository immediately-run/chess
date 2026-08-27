// The games in one store, kept fresh: poll the games directory for new games
// and, for shared stores, re-read everything on an interval (a move inside a
// game does not change the games directory's own listing).
import { useCallback, useEffect, useState } from 'react';
import { gamesDir, listGames } from '../lib/games';
import { pollDir } from '../lib/store';
import type { Store } from '../lib/store';
import type { GameFiles } from '../lib/types';

const REFRESH_MS = 6000;

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
    const stop = pollDir(gamesDir(store), tick, 3000);
    const timer = store.spaceId ? setInterval(tick, REFRESH_MS) : null;
    return () => {
      cancelled = true;
      stop();
      if (timer) clearInterval(timer);
    };
  }, [store, reload]);

  return { games, loading, reload };
}
