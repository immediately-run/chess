import ThemeSwitch from './ThemeSwitch';

interface Props {
  /** Shown when a back action exists (in a game). */
  onBack?: () => void;
  title?: string;
  subtitle?: string;
}

/** App header: wordmark, optional back button, theme switch. */
function TopBar({ onBack, title, subtitle }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        {onBack && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onBack} aria-label="Back to lobby">
            ← Lobby
          </button>
        )}
        <div className="wordmark">
          <span className="logo" aria-hidden>
            ♞︎
          </span>
          <span className="wordmark-text">{title ?? 'Chess'}</span>
          {subtitle && <span className="wordmark-sub">{subtitle}</span>}
        </div>
      </div>
      <ThemeSwitch />
    </header>
  );
}

export default TopBar;
