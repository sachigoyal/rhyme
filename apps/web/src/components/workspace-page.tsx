import type { ComponentProps } from 'react'
import { ScrollArea } from '@rhyme/ui/components/scroll-area'
import { cn } from '@rhyme/ui/lib/utils'

export function WorkspacePage({
  className,
  children,
  ...props
}: ComponentProps<'section'>) {
  return (
    <ScrollArea
      className="flex-1"
      viewportClassName="[&>div]:block!"
      viewportProps={{ 'aria-label': props['aria-label'] }}
    >
      <section className={cn('workspace-page', className)} {...props}>
        {children}
      </section>
    </ScrollArea>
  )
}
