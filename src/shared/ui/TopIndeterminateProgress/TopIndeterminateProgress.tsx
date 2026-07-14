import './TopIndeterminateProgress.css';

interface TopIndeterminateProgressProps {
  label?: string;
  completing?: boolean;
}

export function TopIndeterminateProgress({
  label = 'Загрузка',
  completing = false,
}: TopIndeterminateProgressProps) {
  return (
    <div
      className={`app-top-progress${completing ? ' app-top-progress--completing' : ''}`}
      role="progressbar"
      aria-label={label}
      aria-busy={!completing}
    >
      <div className="app-top-progress__track">
        <div className="app-top-progress__fill" />
      </div>
    </div>
  );
}
