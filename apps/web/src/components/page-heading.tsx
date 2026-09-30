import type { ReactNode } from 'react'

export function PageHeading({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-medium tracking-tight text-balance">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground mt-1.5 max-w-lg text-sm leading-5">
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}
