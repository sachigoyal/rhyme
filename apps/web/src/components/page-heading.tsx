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
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
      <div className="min-w-0">
        <h1 className="text-3xl font-medium tracking-[-0.04em] text-balance sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground mt-3 max-w-lg text-sm leading-6">
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}
