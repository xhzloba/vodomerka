import { useOverlayScroll } from '@/shared/hooks/useOverlayScroll';
import type { MediaItem } from '@/shared/domain/media';
import { SearchPanel } from './SearchPanel';
import './SearchView.css';

interface SearchViewProps {
  query: string;
  onQueryChange: (query: string) => void;
  onMediaSelect: (item: MediaItem) => void;
}

export function SearchView({ query, onQueryChange, onMediaSelect }: SearchViewProps) {
  const scrollRef = useOverlayScroll<HTMLDivElement>();

  return (
    <div ref={scrollRef} className="search-view scroll-overlay">
      <SearchPanel
        query={query}
        onQueryChange={onQueryChange}
        onMediaSelect={onMediaSelect}
        autoFocus
        variant="page"
        inputId="search-page-input"
      />
    </div>
  );
}
