import { cn } from '@rhyme/ui/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
        <rect width="24" height="24" rx="7" className="fill-foreground" />
        <path
          d="M6.5 15.5c2-5.5 4.5-7.5 6-6s-1.5 5-0 6.5 3.5-1 5-4"
          className="stroke-background"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight">Rhyme</span>
    </div>
  )
}
