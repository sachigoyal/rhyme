import { cn } from '@rhyme/ui/lib/utils'
import {
  brandMarkPath,
  brandWordmarkDotPath,
  brandWordmarkPath,
  brandWordmarkViewBox,
} from './brand'

const brandMarkPieces = brandMarkPath.split(/(?=M)/)

export function Logo({
  className,
  compactOnMobile = false,
  loading = false,
}: {
  className?: string
  compactOnMobile?: boolean
  loading?: boolean
}) {
  return (
    <div
      role="img"
      aria-label="Rhyme"
      className={cn('flex w-fit shrink-0 items-center gap-2.5', className)}
    >
      <LogoMark className="size-7" animated={loading} />
      <svg
        viewBox={brandWordmarkViewBox}
        className={cn(
          'text-foreground h-7 w-auto',
          compactOnMobile && 'hidden sm:block',
        )}
        fill="currentColor"
        aria-hidden="true"
      >
        <path d={brandWordmarkPath} fillRule="evenodd" />
        <path d={brandWordmarkDotPath} className="text-primary" />
      </svg>
    </div>
  )
}

export function LogoMark({
  className,
  animated = false,
}: {
  className?: string
  animated?: boolean
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn(
        'text-primary shrink-0',
        animated && 'brand-loading-mark',
        className,
      )}
      fill="currentColor"
      aria-hidden="true"
    >
      {animated ? (
        brandMarkPieces.map((path, index) => (
          <path
            key={index}
            d={path}
            className={`brand-loading-piece brand-loading-piece-${index}`}
          />
        ))
      ) : (
        <path d={brandMarkPath} />
      )}
    </svg>
  )
}
