import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useOverlayScroll } from '@/shared/hooks/useOverlayScroll';
import { PageLoading } from '@/shared/ui/PageState';
import { TrashIcon } from '@/shared/ui/icons';
import '../BrowseView/BrowseView.css';

interface LibraryCollectionViewProps {
  title: string;
  isLoading: boolean;
  loadingTitle: string;
  hasItems: boolean;
  clearAriaLabel: string;
  onClearRequest: () => void;
  emptyIcon: ReactNode;
  emptyText: string;
  /** Kept-mounted views: reset scroll when the page becomes visible again. */
  isActive?: boolean;
  children: ReactNode;
}

export function LibraryCollectionView({
  title,
  isLoading,
  loadingTitle,
  hasItems,
  clearAriaLabel,
  onClearRequest,
  emptyIcon,
  emptyText,
  isActive = true,
  children,
}: LibraryCollectionViewProps) {
  const scrollRef = useOverlayScroll<HTMLDivElement>();

  useEffect(() => {
    if (!isActive) {
      return;
    }

    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [isActive, scrollRef]);

  return (
    <div ref={scrollRef} className="library-view scroll-overlay">
      <div className="library-view__header">
        <div className="library-view__title-group">
          <h1 className="library-view__title">{title}</h1>
          <button
            type="button"
            className="library-view__clear-btn"
            onClick={onClearRequest}
            disabled={!hasItems || isLoading}
            aria-label={clearAriaLabel}
            aria-hidden={!hasItems || isLoading}
            tabIndex={hasItems && !isLoading ? 0 : -1}
          >
            <TrashIcon size={18} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <PageLoading title={loadingTitle} centered />
      ) : hasItems ? (
        <div className="library-view__rows">{children}</div>
      ) : (
        <div className="library-view__empty">
          <div className="library-view__empty-icon">{emptyIcon}</div>
          <p className="library-view__empty-text">{emptyText}</p>
        </div>
      )}
    </div>
  );
}
