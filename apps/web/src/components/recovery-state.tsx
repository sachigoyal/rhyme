import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Loader2, RotateCcw } from 'lucide-react'
import { Button, buttonVariants } from '@rhyme/ui/components/button'
import { cn } from '@rhyme/ui/lib/utils'
import { Logo } from './logo'

type Sketch =
  'page' | 'canvas' | 'conversation' | 'folder' | 'connection' | 'access'

export function RecoveryState({
  title,
  description,
  sketch = 'connection',
  label,
  onRetry,
  children,
  playful = false,
  className,
}: {
  title: string
  description: string
  sketch?: Sketch
  label?: string
  onRetry?: () => Promise<unknown>
  children?: ReactNode
  playful?: boolean
  className?: string
}) {
  const heading = useId()
  const [retrying, setRetrying] = useState(false)
  const [retryFailed, setRetryFailed] = useState(false)
  const [tidied, setTidied] = useState(false)
  useEffect(() => {
    document.title = `${title} · Rhyme`
  }, [title])
  const retry = async () => {
    if (!onRetry || retrying) return
    setRetrying(true)
    setRetryFailed(false)
    try {
      await onRetry()
    } catch {
      setRetryFailed(true)
    } finally {
      setRetrying(false)
    }
  }
  return (
    <section
      className={cn(
        'flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-16 text-center',
        className,
      )}
      aria-labelledby={heading}
    >
      {playful ? (
        <button
          type="button"
          onClick={() => setTidied(!tidied)}
          aria-label={tidied ? 'Reset illustration' : 'Align illustration'}
          className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
        >
          <RecoverySketch kind={sketch} tidied={tidied} />
        </button>
      ) : (
        <RecoverySketch kind={sketch} />
      )}
      {label && <p className="text-muted-foreground mt-6 text-xs">{label}</p>}
      <h1
        id={heading}
        className="mt-3 max-w-lg text-2xl font-semibold tracking-tight sm:text-3xl"
      >
        {title}
      </h1>
      <p className="text-muted-foreground mt-3 max-w-sm text-sm leading-relaxed">
        {description}
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
        {onRetry && (
          <Button disabled={retrying} onClick={() => void retry()}>
            {retrying ? <Loader2 className="animate-spin" /> : <RotateCcw />}
            {retrying ? 'Trying again…' : 'Try again'}
          </Button>
        )}
        {children}
      </div>
      {playful && (
        <p className="sr-only" aria-live="polite">
          {tidied ? 'Illustration aligned.' : 'Illustration reset.'}
        </p>
      )}
      {retryFailed && (
        <p className="text-muted-foreground mt-4 text-sm" role="alert">
          Unable to reload. Try again later.
        </p>
      )}
    </section>
  )
}

function RecoverySketch({
  kind,
  tidied = false,
}: {
  kind: Sketch
  tidied?: boolean
}) {
  return (
    <svg
      width="184"
      height="132"
      viewBox="0 0 184 132"
      fill="none"
      aria-hidden="true"
      className="text-muted-foreground/55 shrink-0"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 113H162" className="stroke-border" />
      {kind === 'conversation' ? (
        <>
          <path
            d="M46 29H138C145 29 150 34 150 41V82C150 89 145 94 138 94H85L61 108V94H46C39 94 34 89 34 82V41C34 34 39 29 46 29Z"
            stroke="currentColor"
          />
          <path
            d="M67 61H69M91 61H93M115 61H117"
            className="stroke-primary"
            strokeWidth="4"
          />
        </>
      ) : kind === 'connection' ? (
        <>
          <path d="M31 67H68L79 53" stroke="currentColor" />
          <path d="M105 79L116 65H153" stroke="currentColor" />
          <circle cx="79" cy="53" r="4" className="stroke-primary" />
          <circle cx="105" cy="79" r="4" className="stroke-primary" />
          <path
            d="M89 38L92 30M104 42L112 38M87 89L82 97"
            className="stroke-border"
          />
        </>
      ) : kind === 'access' ? (
        <>
          <rect
            x="61"
            y="54"
            width="62"
            height="47"
            rx="7"
            stroke="currentColor"
          />
          <path d="M73 54V40C73 15 111 15 111 40V54" stroke="currentColor" />
          <path d="M92 73V83" className="stroke-primary" strokeWidth="3" />
        </>
      ) : kind === 'folder' ? (
        <>
          <path
            d="M36 95V38C36 34 39 31 43 31H74L85 44H139C144 44 148 48 148 53V95C148 99 144 103 140 103H44C39 103 36 100 36 95Z"
            stroke="currentColor"
          />
          <path d="M37 57H134" className="stroke-border" />
          <path d="M85 70L99 84M99 70L85 84" className="stroke-primary" />
        </>
      ) : (
        <g
          className="origin-center transition-transform duration-300 motion-reduce:transition-none"
          style={{ transform: tidied ? 'rotate(0deg)' : 'rotate(-7deg)' }}
        >
          <rect
            x="43"
            y="24"
            width="99"
            height="76"
            rx="2"
            stroke="currentColor"
            strokeDasharray={kind === 'page' ? '4 5' : undefined}
          />
          {(
            [
              [43, 24],
              [142, 24],
              [43, 100],
              [142, 100],
            ] as const
          ).map(([x, y]) => (
            <rect
              key={`${x}:${y}`}
              x={x - 3}
              y={y - 3}
              width="6"
              height="6"
              className="fill-background stroke-primary"
            />
          ))}
          <path
            d={
              tidied
                ? 'M70 63L86 77L113 47'
                : 'M75 53C78 46 92 46 97 53C103 62 87 63 87 72M87 83H87.1'
            }
            className="stroke-primary"
            strokeWidth="2"
          />
        </g>
      )}
    </svg>
  )
}

export function RecoveryPage({ children }: { children: ReactNode }) {
  return (
    <main className="bg-background flex min-h-svh flex-col">
      <header className="flex h-16 shrink-0 items-center border-b px-5 sm:px-7">
        <Link to="/" aria-label="Rhyme home">
          <Logo />
        </Link>
      </header>
      {children}
    </main>
  )
}

export function PageNotFound({ embedded = false }: { embedded?: boolean }) {
  const state = (
    <RecoveryState
      sketch="page"
      label="404"
      title="Page not found"
      description="This page doesn’t exist. Check the URL or return to your canvases."
      playful
    >
      <Link
        to="/files"
        search={{ view: 'mine' }}
        className={buttonVariants({})}
      >
        View canvases <ArrowRight />
      </Link>
    </RecoveryState>
  )
  return embedded ? state : <RecoveryPage>{state}</RecoveryPage>
}
