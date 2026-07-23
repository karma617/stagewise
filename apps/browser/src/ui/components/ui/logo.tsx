import type { FC, HTMLAttributes } from 'react';
import pickstarIconUrl from '@assets/pickstar-icon.png';

export type LogoColor =
  | 'default'
  | 'black'
  | 'white'
  | 'zinc'
  | 'current'
  | 'gradient';

export type LoadingSpeed = 'slow' | 'fast';

export interface LogoProps extends HTMLAttributes<HTMLDivElement> {
  color?: LogoColor;
  loading?: boolean;
  loadingSpeed?: LoadingSpeed;
}

export const Logo: FC<LogoProps> = ({
  color: _color = 'default',
  loading = false,
  loadingSpeed = 'slow',
  ...props
}) => {
  return (
    <div
      {...props}
      className={`relative aspect-square overflow-hidden rounded-[22%] ${
        props.className || ''
      } ${loading ? 'drop-shadow-xl' : ''}`}
    >
      <img
        src={pickstarIconUrl}
        alt="PickStar Studio"
        className={`h-full w-full object-cover ${
          loading
            ? loadingSpeed === 'fast'
              ? 'animate-spin-fast'
              : 'animate-spin-slow'
            : ''
        }`}
        draggable={false}
      />
    </div>
  );
};
