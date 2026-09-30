import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Cloud, PenTool, Share2 } from 'lucide-react'
import { Button } from '@rhyme/ui/components/button'
import { Logo } from '@/components/logo'

export const Route = createFileRoute('/')({ component: Landing })

const features = [
  {
    icon: PenTool,
    title: 'Draw anything',
    body: 'Sketches, flowcharts, wireframes and diagrams on one infinite canvas.',
  },
  {
    icon: Cloud,
    title: 'Saved everywhere',
    body: 'Every stroke is kept on your device and synced to your account.',
  },
  {
    icon: Share2,
    title: 'Share with anyone',
    body: 'Invite people to view or edit a file with a single email.',
  },
]

function Landing() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <Button asChild variant="ghost" size="sm">
          <Link to="/sign-in">Sign in</Link>
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-balance sm:text-6xl">
          Where ideas take shape.
        </h1>
        <p className="text-muted-foreground mt-6 max-w-xl text-lg text-balance">
          Rhyme is a calm, infinite whiteboard for sketching and diagramming.
          Your drawings live in your account, not just your browser.
        </p>
        <Button asChild size="lg" className="mt-10">
          <Link to="/files">
            Start drawing
            <ArrowRight />
          </Link>
        </Button>

        <div className="mt-24 grid w-full gap-4 text-left sm:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-card rounded-xl border p-6">
              <Icon className="text-muted-foreground size-5" />
              <h2 className="mt-4 font-medium">{title}</h2>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                {body}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
