import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export function EmptyState({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon?: LucideIcon
  title: string
  body: string
  children?: ReactNode
}) {
  return (
    <div className="bg-card flex min-h-80 flex-col items-center justify-center rounded-lg border px-6 py-16 text-center">
      {Icon && (
        <div className="text-primary mb-5 grid size-11 place-items-center rounded-lg border bg-secondary">
          <Icon className="size-5" strokeWidth={1.5} />
        </div>
      )}
      <h3 className="text-lg font-medium tracking-tight">{title}</h3>
      <p className="text-muted-foreground mt-2 max-w-xs text-sm leading-6">
        {body}
      </p>
      {children && <div className="mt-6">{children}</div>}
    </div>
  )
}
