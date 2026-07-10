import './PageState.css';

interface PageStateProps {
  title: string;
  text?: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface PageStateLayoutProps {
  centered?: boolean;
}

export function PageLoading({ title, centered }: { title?: string } & PageStateLayoutProps) {
  return (
    <div
      className={`page-state${centered ? ' page-state--centered' : ''}`}
      aria-busy="true"
      aria-label={title ?? 'Загрузка'}
    >
      <div className="page-state__spinner" aria-hidden="true" />
      {title ? <p className="page-state__title">{title}</p> : null}
    </div>
  );
}

export function PageError({
  title,
  text,
  actionLabel = 'Повторить',
  onAction,
  centered,
}: PageStateProps & PageStateLayoutProps) {
  return (
    <div className={`page-state${centered ? ' page-state--centered' : ''}`}>
      <p className="page-state__title">{title}</p>
      {text && <p className="page-state__text">{text}</p>}
      {onAction && (
        <button type="button" className="page-state__btn" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <div className="home-skeleton" aria-hidden="true">
      <div className="home-skeleton__hero" />
      <div className="home-skeleton__rows">
        {[0, 1, 2].map((row) => (
          <div key={row}>
            <div className="home-skeleton__row-title" />
            <div className="home-skeleton__cards">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="home-skeleton__card" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
