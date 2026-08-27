// Root component — immediately.run renders the default export of THIS file.
// Global CSS is imported here (not in main.tsx) because immediately.run's
// runtime never loads main.tsx; anything the rendered tree needs must be
// reachable from App.tsx.
import './index.css';
import './App.css';
import { useCallback, useState } from 'react';
import GameScreen from './components/GameScreen';
import Lobby from './components/Lobby';
import TopBar from './components/TopBar';
import { useGamesList } from './hooks/useGamesList';
import { useMe } from './hooks/useMe';
import { useStorage } from './hooks/useStorage';
import { engineSide } from './lib/engine';
import { createGame, deleteGame } from './lib/games';
import type { Store } from './lib/store';
import type { Color, EngineLevel } from './lib/types';

type View = { kind: 'lobby' } | { kind: 'game'; store: Store; id: string };

function App() {
  const storage = useStorage();
  const { me, fromHost } = useMe(storage.config);
  const [view, setView] = useState<View>({ kind: 'lobby' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priv = storage.privateStore;
  const privateGames = useGamesList(view.kind === 'lobby' ? priv : null);
  const sharedGames = useGamesList(view.kind === 'lobby' ? storage.shared : null);

  const level: EngineLevel = storage.config.level ?? 2;
  const playAs: Color | 'random' = storage.config.playAs ?? 'w';

  const start = useCallback(
    async (store: Store | null, mode: 'engine' | 'local' | 'correspondence', myColor: Color, lvl?: EngineLevel) => {
      if (!store || store.mode === 'ro') return;
      setCreating(true);
      setError(null);
      try {
        const meta = await createGame(store, { mode, myColor, me: me || 'you', level: lvl });
        setView({ kind: 'game', store, id: meta.id });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not create the game.');
      } finally {
        setCreating(false);
      }
    },
    [me],
  );

  const playEngine = useCallback(
    () => start(priv, 'engine', engineSide(playAs) === 'w' ? 'b' : 'w', level),
    [start, priv, playAs, level],
  );
  const playLocal = useCallback(() => start(priv, 'local', 'w'), [start, priv]);
  const newShared = useCallback((c: Color) => start(storage.shared, 'correspondence', c), [start, storage.shared]);

  const rematch = useCallback(
    (opts: { mode: 'engine' | 'local' | 'correspondence'; myColor: Color; level?: EngineLevel }) => {
      if (view.kind !== 'game') return;
      void start(view.store, opts.mode, opts.myColor, opts.level);
    },
    [view, start],
  );

  const openPrivate = useCallback((id: string) => priv && setView({ kind: 'game', store: priv, id }), [priv]);
  const openShared = useCallback(
    (id: string) => storage.shared && setView({ kind: 'game', store: storage.shared, id }),
    [storage.shared],
  );
  const removePrivate = useCallback(
    async (id: string) => {
      if (!priv) return;
      await deleteGame(priv, id);
      await privateGames.reload();
    },
    [priv, privateGames],
  );

  const back = useCallback(() => setView({ kind: 'lobby' }), []);

  if (storage.phase === 'booting') {
    return (
      <>
        <TopBar />
        <main className="lobby">
          <p className="muted">Opening your board…</p>
        </main>
      </>
    );
  }

  if (view.kind === 'game') {
    return (
      <>
        <TopBar onBack={back} />
        <GameScreen store={view.store} id={view.id} me={me} onBack={back} onRematch={rematch} />
      </>
    );
  }

  return (
    <>
      <TopBar />
      <Lobby
        level={level}
        playAs={playAs}
        onLevel={(l) => void storage.saveConfig({ level: l })}
        onPlayAs={(c) => void storage.saveConfig({ playAs: c })}
        onPlayEngine={() => void playEngine()}
        onPlayLocal={() => void playLocal()}
        privateGames={privateGames.games}
        privateLoading={privateGames.loading}
        privateReady={!!priv && priv.mode === 'rw'}
        onOpenPrivate={openPrivate}
        onDeletePrivate={(id) => void removePrivate(id)}
        shared={storage.shared}
        sharedGames={sharedGames.games}
        sharedLoading={sharedGames.loading}
        me={me}
        fromHost={fromHost}
        busy={storage.busy || creating}
        error={error ?? storage.error}
        onName={(name) => void storage.saveConfig({ name: name.trim() })}
        onCreateSpace={(name) => void storage.createShared(name)}
        onOpenSpace={() => void storage.openShared()}
        onLeaveSpace={() => void storage.forgetShared()}
        onNewShared={(c) => void newShared(c)}
        onOpenShared={openShared}
      />
    </>
  );
}

export default App;
