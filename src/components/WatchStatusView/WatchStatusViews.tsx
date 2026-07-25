import type { MediaItem } from '@/shared/domain/media';
import { BanIcon, EyeIcon, PauseCircleIcon, WatchingIcon } from '@/shared/ui/icons';
import { WatchStatusCollectionView } from './WatchStatusCollectionView';

interface StatusViewProps {
  onMediaSelect: (item: MediaItem) => void;
  isActive?: boolean;
}

export function WatchingView(props: StatusViewProps) {
  return (
    <WatchStatusCollectionView
      status="watching"
      emptyIcon={<WatchingIcon size={48} strokeWidth={1.5} />}
      {...props}
    />
  );
}

export function WatchedView(props: StatusViewProps) {
  return (
    <WatchStatusCollectionView
      status="watched"
      emptyIcon={<EyeIcon size={48} strokeWidth={1.5} />}
      {...props}
    />
  );
}

export function PostponedView(props: StatusViewProps) {
  return (
    <WatchStatusCollectionView
      status="postponed"
      emptyIcon={<PauseCircleIcon size={48} strokeWidth={1.5} />}
      {...props}
    />
  );
}

export function DroppedView(props: StatusViewProps) {
  return (
    <WatchStatusCollectionView
      status="dropped"
      emptyIcon={<BanIcon size={48} strokeWidth={1.5} />}
      {...props}
    />
  );
}
