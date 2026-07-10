import type { ReactNode, SVGProps } from 'react';

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

interface StrokeIconProps extends IconProps {
  children: ReactNode;
  viewBox?: string;
}

export function StrokeIcon({
  size = 24,
  className,
  children,
  viewBox = '0 0 24 24',
  strokeWidth = 1.75,
  ...props
}: StrokeIconProps) {
  return (
    <svg
      viewBox={viewBox}
      width={size}
      height={size}
      className={className ? `app-icon app-icon--stroke ${className}` : 'app-icon app-icon--stroke'}
      strokeWidth={strokeWidth}
      aria-hidden={props['aria-label'] ? undefined : true}
      {...props}
    >
      {children}
    </svg>
  );
}
