import './TopIndeterminateProgress.css';

interface TopIndeterminateProgressProps {
  label?: string;
}

export function TopIndeterminateProgress({ label = 'Загрузка' }: TopIndeterminateProgressProps) {
  return (
    <div
      className="app-top-progress"
      role="progressbar"
      aria-label={label}
      aria-busy="true"
    >
      <div className="app-top-progress__track">
        <div className="app-top-progress__fill" />
      </div>
    </div>
  );
}
