import { LEVELS } from '../lib/engine';
import type { Color, EngineLevel } from '../lib/types';

interface Props {
  level: EngineLevel;
  playAs: Color | 'random';
  busy: boolean;
  onLevel: (l: EngineLevel) => void;
  onPlayAs: (c: Color | 'random') => void;
  onStart: () => void;
}

/** "Play the engine" card: pick a level and a color, then go. */
function EngineSetup({ level, playAs, busy, onLevel, onPlayAs, onStart }: Props) {
  return (
    <section className="card card-hero">
      <h2>Play the engine.</h2>
      <p className="muted">A small built-in engine. No account, no network, nothing to set up.</p>
      <div className="seg" role="radiogroup" aria-label="Level">
        {([1, 2, 3] as EngineLevel[]).map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={level === l}
            className={`seg-btn${level === l ? ' seg-on' : ''}`}
            onClick={() => onLevel(l)}
          >
            <span className="seg-name">{LEVELS[l].name}</span>
            <span className="seg-blurb">{LEVELS[l].blurb}</span>
          </button>
        ))}
      </div>
      <div className="row wrap">
        <span className="label">Play as</span>
        <div className="seg seg-inline" role="radiogroup" aria-label="Color">
          {(
            [
              ['w', 'White'],
              ['b', 'Black'],
              ['random', 'Random'],
            ] as const
          ).map(([c, name]) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={playAs === c}
              className={`seg-btn seg-small${playAs === c ? ' seg-on' : ''}`}
              onClick={() => onPlayAs(c)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={onStart}>
        Play the engine →
      </button>
    </section>
  );
}

export default EngineSetup;
