import { useState } from 'react';
import GameRow from './GameRow';
import type { Store } from '../lib/store';
import type { Color, GameFiles } from '../lib/types';

interface Props {
  shared: Store | null;
  games: GameFiles[];
  loading: boolean;
  me: string;
  fromHost: boolean;
  busy: boolean;
  error: string | null;
  onName: (name: string) => void;
  onCreateSpace: (name: string) => void;
  onOpenSpace: () => void;
  onLeaveSpace: () => void;
  onNewGame: (asColor: Color) => void;
  onOpenGame: (id: string) => void;
}

/** Correspondence: pick or create a shared space, then play by files. */
function SharedSection(props: Props) {
  const { shared, games, loading, me, fromHost, busy, error, onName, onCreateSpace, onOpenSpace, onLeaveSpace, onNewGame, onOpenGame } = props;
  const [spaceName, setSpaceName] = useState('Chess club');
  const [draftName, setDraftName] = useState(me);
  const named = me.length > 0;

  const nameField = !fromHost && (
    <form
      className="row wrap"
      onSubmit={(e) => {
        e.preventDefault();
        onName(draftName);
      }}
    >
      <label className="field grow">
        <span>Your name (opponents see it)</span>
        <input value={draftName} onChange={(e) => setDraftName(e.target.value)} maxLength={40} placeholder="e.g. magnus" />
      </label>
      <button type="submit" className="btn btn-ghost btn-sm" disabled={draftName.trim() === me}>
        Save
      </button>
    </form>
  );

  if (!shared) {
    return (
      <section className="card">
        <h2>Play a friend by correspondence.</h2>
        <p className="muted">
          Games live in a shared space as plain files, one per move — no server, no clocks. Create a space and share it with
          your opponent from the Spaces page on immediately.run (the app cannot invite anyone itself), or open a space
          someone shared with you.
        </p>
        {error && <p className="error">{error}</p>}
        <div className="row wrap">
          <label className="field grow">
            <span>Space name</span>
            <input value={spaceName} onChange={(e) => setSpaceName(e.target.value)} maxLength={60} />
          </label>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onCreateSpace(spaceName)}>
            Create a shared space →
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onOpenSpace}>
            Open a shared space
          </button>
        </div>
      </section>
    );
  }

  const ro = shared.mode === 'ro';
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Correspondence.</h2>
          <p className="muted small">
            Space <strong>{shared.name ?? shared.spaceId}</strong>
            {ro ? ' (read-only)' : ''} · share it from the Spaces page so others can join.
          </p>
        </div>
        <div className="row">
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onOpenSpace}>
            Switch space
          </button>
          <button type="button" className="linkbtn" onClick={onLeaveSpace}>
            Leave
          </button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {nameField}
      {!ro && (
        <div className="row wrap">
          <button type="button" className="btn btn-primary" disabled={!named} onClick={() => onNewGame('w')}>
            New game as White
          </button>
          <button type="button" className="btn btn-ghost" disabled={!named} onClick={() => onNewGame('b')}>
            New game as Black
          </button>
          {!named && <span className="muted small">Set your name first.</span>}
        </div>
      )}
      {loading ? (
        <p className="muted small">Loading games…</p>
      ) : games.length === 0 ? (
        <p className="muted small">No games in this space yet. Start one — the other seat stays open until someone joins.</p>
      ) : (
        <ul className="game-list">
          {games.map((g) => (
            <GameRow key={g.meta.id} game={g} me={me} onOpen={() => onOpenGame(g.meta.id)} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default SharedSection;
