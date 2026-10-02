import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { buttonVariants } from '@rhyme/ui/components/button'
import { Logo } from './logo'

export function PolicyPage({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="bg-background flex min-h-svh flex-col">
      <header className="flex items-center justify-between gap-4 border-b px-6 py-5 sm:px-10">
        <Link to="/" aria-label="Rhyme home">
          <Logo />
        </Link>
        <Link
          to="/"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Back to canvas
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 sm:py-16">
        <p className="text-muted-foreground mb-3 text-xs">
          Personal project · Learning in public
        </p>
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="text-muted-foreground mt-4 text-sm leading-7">
          {description}
        </p>
        <p className="text-muted-foreground mt-4 text-xs">
          Last updated: <time dateTime="2026-10-02">October 2, 2026</time>
        </p>
        <div className="mt-10 space-y-8 text-sm leading-7 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-medium [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4">
          {children}
        </div>
      </main>
      <footer className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-4 border-t px-6 py-6">
        <p className="text-muted-foreground text-xs">
          Rhyme is a personal learning project.
        </p>
      </footer>
    </div>
  )
}
