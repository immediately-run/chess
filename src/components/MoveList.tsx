import type { MoveRecord } from '../lib/types';

interface Props {
  moves: MoveRecord[];
  /** Ply being shown (0 = start); null = live. */
  viewPly: number | null;
  onSelect: (ply: number | null) => void;
}

/** SAN move list, two plies per row. Tap a move to review that position. */
function MoveList({ moves, viewPly, onSelect }: Props) {
  const shown = viewPly ?? moves.length;
  const rows: { n: number; w?: MoveRecord; b?: MoveRecord }[] = [];
  moves.forEach((m, i) => {
    const row = Math.floor(i / 2);
    rows[row] ??= { n: row + 1 };
    if (i % 2 === 0) rows[row].w = m;
    else rows[row].b = m;
  });
  const btn = (m: MoveRecord | undefined) =>
    m ? (
      <button
        type="button"
        className={`mv${shown === m.n ? ' mv-current' : ''}`}
        onClick={() => onSelect(m.n === moves.length ? null : m.n)}
      >
        {m.san}
      </button>
    ) : (
      <span className="mv mv-empty">…</span>
    );
  return (
    <div className="moves" aria-label="Moves">
      <div className="moves-nav">
        <button type="button" className="navbtn" disabled={shown === 0} onClick={() => onSelect(0)} aria-label="Start">
          «
        </button>
        <button type="button" className="navbtn" disabled={shown === 0} onClick={() => onSelect(shown - 1)} aria-label="Previous move">
          ‹
        </button>
        <button
          type="button"
          className="navbtn"
          disabled={shown >= moves.length}
          onClick={() => onSelect(shown + 1 >= moves.length ? null : shown + 1)}
          aria-label="Next move"
        >
          ›
        </button>
        <button type="button" className="navbtn" disabled={viewPly === null} onClick={() => onSelect(null)} aria-label="Latest">
          »
        </button>
      </div>
      {moves.length === 0 ? (
        <p className="muted small">No moves yet.</p>
      ) : (
        <ol className="moves-list">
          {rows.map((r) => (
            <li key={r.n}>
              <span className="mv-n">{r.n}.</span>
              {btn(r.w)}
              {btn(r.b)}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default MoveList;
