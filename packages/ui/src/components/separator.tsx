'use client'

import { cn } from 'cn'
import { Separator as SeparatorPrimitive } from '@base-ui/react/separator'

function Separator({
  className,
  orientation = 'horizontal',
  role = 'presentation',
  ...props
}: SeparatorPrimitive.Props) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      role={role}
      aria-hidden={role === 'presentation' ? true : undefined}
      orientation={orientation}
      className={cn(
        'shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
        className,
      )}
      {...props}
    />
  )
}

export { Separator }
