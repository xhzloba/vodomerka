import { Check, Clock, Heart, House, Eye, Trash2, History, SlidersHorizontal } from 'lucide-react';
import type { IconProps } from './Icon';
import { StrokeIcon } from './Icon';

function lucideIconClass(className?: string) {
  return className ? `app-icon app-icon--stroke ${className}` : 'app-icon app-icon--stroke';
}

export function HomeIcon({ size = 24, className, strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <House
      size={size}
      strokeWidth={strokeWidth}
      className={lucideIconClass(className)}
      aria-hidden={props['aria-label'] ? undefined : true}
      {...props}
    />
  );
}

export function GridIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </StrokeIcon>
  );
}

export function CoverSpacingIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <rect x="3.5" y="5.5" width="6.5" height="13" rx="1.5" />
      <rect x="14" y="5.5" width="6.5" height="13" rx="1.5" />
    </StrokeIcon>
  );
}

export function FavoritesIcon({
  size = 24,
  className,
  strokeWidth = 1.75,
  filled = false,
  ...props
}: IconProps & { filled?: boolean }) {
  return (
    <Heart
      size={size}
      strokeWidth={strokeWidth}
      className={
        filled
          ? className
            ? `app-icon app-icon--stroke app-icon--heart-filled ${className}`
            : 'app-icon app-icon--stroke app-icon--heart-filled'
          : lucideIconClass(className)
      }
      aria-hidden={props['aria-label'] ? undefined : true}
      {...props}
    />
  );
}

const EYE_OFF_SOLID_PATH =
  'M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z';

export function EyeOffIcon({
  size = 20,
  className,
  strokeWidth = 2,
  solid = false,
  ...props
}: IconProps) {
  if (solid) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="currentColor"
        className={className ? `app-icon app-icon--eye-off-solid ${className}` : 'app-icon app-icon--eye-off-solid'}
        aria-hidden={props['aria-label'] ? undefined : true}
        {...props}
      >
        <path d={EYE_OFF_SOLID_PATH} />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ? `app-icon app-icon--eye-off ${className}` : 'app-icon app-icon--eye-off'}
      aria-hidden={props['aria-label'] ? undefined : true}
      {...props}
    >
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

export function EyeIcon({ size = 24, className, strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <Eye
      size={size}
      strokeWidth={strokeWidth}
      className={lucideIconClass(className)}
      aria-hidden={props['aria-label'] ? undefined : true}
      {...props}
    />
  );
}

export function TrashIcon({ size = 24, className, strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <Trash2
      size={size}
      strokeWidth={strokeWidth}
      className={lucideIconClass(className)}
      aria-hidden={props['aria-label'] ? undefined : true}
      {...props}
    />
  );
}

export function HistoryIcon({ size = 24, className, strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <History
      size={size}
      strokeWidth={strokeWidth}
      className={lucideIconClass(className)}
      aria-hidden={props['aria-label'] ? undefined : true}
      {...props}
    />
  );
}

export function FilterIcon({ size = 24, className, strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <SlidersHorizontal
      size={size}
      strokeWidth={strokeWidth}
      className={lucideIconClass(className)}
      aria-hidden={props['aria-label'] ? undefined : true}
      {...props}
    />
  );
}

export function ClockIcon({ size = 24, className, strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <Clock
      size={size}
      strokeWidth={strokeWidth}
      className={lucideIconClass(className)}
      aria-hidden={props['aria-label'] ? undefined : true}
      {...props}
    />
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <circle cx="11" cy="11" r="6.75" />
      <path d="m16.5 16.5 4 4" />
    </StrokeIcon>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="m14.5 6.5-6 5.5 6 5.5" />
    </StrokeIcon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="m9.5 6.5 6 5.5-6 5.5" />
    </StrokeIcon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="m6.5 9.5 5.5 6 5.5-6" />
    </StrokeIcon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="m7.5 7.5 9 9" />
      <path d="m16.5 7.5-9 9" />
    </StrokeIcon>
  );
}

export function CheckIcon({
  size = 24,
  className,
  strokeWidth = 1.75,
  ...props
}: IconProps) {
  return (
    <Check
      size={size}
      strokeWidth={strokeWidth}
      className={lucideIconClass(className)}
      aria-hidden={props['aria-label'] ? undefined : true}
      {...props}
    />
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <rect x="9" y="9" width="10" height="10" rx="1.5" />
      <path d="M7 15H5.5A1.5 1.5 0 0 1 4 13.5v-8A1.5 1.5 0 0 1 5.5 4H13.5A1.5 1.5 0 0 1 15 5.5V7" />
    </StrokeIcon>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 11v5" />
      <circle cx="12" cy="8" r="0.75" fill="currentColor" stroke="none" />
    </StrokeIcon>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </StrokeIcon>
  );
}

export function BookOpenIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M12 5.5c-1.5-1-3.5-1-5.5 0v11.5c2-.75 4-.75 5.5 0 1.5-.75 3.5-.75 5.5 0V5.5c-2-1-4-1-5.5 0Z" />
    </StrokeIcon>
  );
}

export function CompilationsIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <rect x="4.5" y="7" width="9.5" height="12.5" rx="1.75" />
      <rect x="10" y="4.5" width="9.5" height="12.5" rx="1.75" />
    </StrokeIcon>
  );
}

export function TrendingIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M4 16l6-6 4 4 6-7" />
      <path d="M14 7h6v6" />
    </StrokeIcon>
  );
}

export function WatchingIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.25" />
    </StrokeIcon>
  );
}

export function PlayIcon({ size = 24, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className ? `app-icon app-icon--filled ${className}` : 'app-icon app-icon--filled'}
      aria-hidden={props['aria-label'] ? undefined : true}
      {...props}
    >
      <path d="M8 5.14v13.72c0 .79.87 1.27 1.54.84l11.04-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14z" />
    </svg>
  );
}

export function PlayOverlayIcon({ size = 56, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 56 56"
      width={size}
      height={size}
      className={
        className ? `app-icon app-icon--play-overlay ${className}` : 'app-icon app-icon--play-overlay'
      }
      aria-hidden={props['aria-label'] ? undefined : true}
      {...props}
    >
      <path
        d="M21.2 18.1c0-1.35 1.52-2.16 2.65-1.43l15.75 9.45c1.13.73 1.13 2.46 0 3.19l-15.75 9.45c-1.13.73-2.65-.08-2.65-1.43V18.1Z"
        fill="#fff"
      />
    </svg>
  );
}
