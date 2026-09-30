import { cn } from '@rhyme/ui/lib/utils'
import { brandMarkPath, brandWordmarkPath, brandWordmarkViewBox } from './brand'

export function Logo({
  className,
  compactOnMobile = false,
}: {
  className?: string
  compactOnMobile?: boolean
}) {
  return (
    <div
      role="img"
      aria-label="Rhyme"
      className={cn('flex w-fit shrink-0 items-center gap-2.5', className)}
    >
      <LogoMark className="size-7" />
      <svg
        viewBox={brandWordmarkViewBox}
        className={cn(
          'text-foreground h-7 w-auto',
          compactOnMobile && 'hidden sm:block',
        )}
        fill="currentColor"
        aria-hidden="true"
      >
        <path d={brandWordmarkPath} />
      </svg>
    </div>
  )
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn('text-primary shrink-0', className)}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={brandMarkPath} />
    </svg>
  )
}
