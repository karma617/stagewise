import type { FC, HTMLAttributes } from 'react';
import { cn } from '@ui/utils';
import { Logo } from '@ui/components/ui/logo';

export interface LogoWithTextProps extends HTMLAttributes<HTMLDivElement> {
  textClassName?: string;
}

/**
 * PickStar Studio logo with text.
 */
export const LogoWithText: FC<LogoWithTextProps> = ({
  className,
  textClassName,
  ...props
}) => {
  return (
    <div className={cn('flex h-10 items-center gap-2', className)} {...props}>
      <Logo className="h-full w-auto" />
      <span className={cn('font-semibold text-foreground text-lg', textClassName)}>
        PickStar Studio
      </span>
    </div>
  );
};
