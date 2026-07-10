import './MediaCoverPlaceholder.css';

interface MediaCoverPlaceholderProps {
  className?: string;
  fill?: boolean;
}

export function MediaCoverPlaceholder({ className, fill = false }: MediaCoverPlaceholderProps) {
  return (
    <div
      className={[
        'media-cover-placeholder',
        fill ? 'media-cover-placeholder--fill' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    >
      <div className="media-cover-placeholder__shine" />
      <div className="media-cover-placeholder__grain" />
    </div>
  );
}
