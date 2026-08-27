import EngineSetup from './EngineSetup';
import GameRow from './GameRow';
import SharedSection from './SharedSection';
import type { Store } from '../lib/store';
import type { Color, EngineLevel, GameFiles } from '../lib/types';

interface Props {
  level: EngineLevel;
  playAs: Color | 'random';
  onLevel: (l: EngineLevel) => void;
  onPlayAs: (c: Color | 'random') => void;
  onPlayEngine: () => void;
  onPlayLocal: () => void;
  privateGames: GameFiles[];
  privateLoading: boolean;
  privateReady: boolean;
  onOpenPrivate: (id: string) => void;
  onDeletePrivate: (id: string) => void;
  shared: Store | null;
  sharedGames: GameFiles[];
  sharedLoading: boolean;
  me: string;
  fromHost: boolean;
  busy: boolean;
  error: string | null;
  onName: (name: string) => void;
  onCreateSpace: (name: string) => void;
  onOpenSpace: () => void;
  onLeaveSpace: () => void;
  onNewShared: (asColor: Color) => void;
  onOpenShared: (id: string) => void;
}

/** The lobby: start a solo game, resume one, or play by correspondence. */
function Lobby(p: Props) {
  const unfinished = p.privateGames;
  return (
    <main className="lobby">
      <section className="hero">
        <h1>
          Chess<span className="grad-text">.</span>
        </h1>
        <p className="deck">
          Correspondence chess without a server: every move is a file in a shared space. Play a friend, or the built-in
          engine.
        </p>
      </section>

      <div className="lobby-grid">
        <EngineSetup
          level={p.level}
          playAs={p.playAs}
          busy={p.busy || !p.privateReady}
          onLevel={p.onLevel}
          onPlayAs={p.onPlayAs}
          onStart={p.onPlayEngine}
        />
        <section className="card">
          <h2>Two players, one device.</h2>
          <p className="muted">Pass the phone. The board flips to face whoever is to move.</p>
          <button type="button" className="btn btn-ghost" disabled={p.busy || !p.privateReady} onClick={p.onPlayLocal}>
            Start a local game →
          </button>
        </section>
      </div>

      {(unfinished.length > 0 || p.privateLoading) && (
        <section className="card">
          <h2>Your games.</h2>
          <p className="muted small">Solo games are saved privately on this account; pick one up any time.</p>
          {p.privateLoading && unfinished.length === 0 ? (
            <p className="muted small">Loading…</p>
          ) : (
            <ul className="game-list">
              {unfinished.map((g) => (
                <GameRow key={g.meta.id} game={g} me={p.me} onOpen={() => p.onOpenPrivate(g.meta.id)} onDelete={() => p.onDeletePrivate(g.meta.id)} />
              ))}
            </ul>
          )}
        </section>
      )}

      <SharedSection
        shared={p.shared}
        games={p.sharedGames}
        loading={p.sharedLoading}
        me={p.me}
        fromHost={p.fromHost}
        busy={p.busy}
        error={p.error}
        onName={p.onName}
        onCreateSpace={p.onCreateSpace}
        onOpenSpace={p.onOpenSpace}
        onLeaveSpace={p.onLeaveSpace}
        onNewGame={p.onNewShared}
        onOpenGame={p.onOpenShared}
      />

      <footer className="foot mono">
        Rules by chess.js · pieces are files · <a href="https://github.com/immediately-run/chess">source</a>
      </footer>
    </main>
  );
}

export default Lobby;
