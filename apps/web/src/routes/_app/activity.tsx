import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Activity,
  ArrowUpRight,
  Clock3,
  MessageSquare,
  MousePointer2,
  RefreshCw,
} from 'lucide-react'
import { useAgentAnalytics, useChats } from '@rhyme/hooks/queries'
import { Button } from '@rhyme/ui/components/button'
import { Skeleton } from '@rhyme/ui/components/skeleton'
import { WorkspaceShell } from '@/features/files/workspace-shell'
import { timeAgo } from '@/lib/format'

export const Route = createFileRoute('/_app/activity')({
  head: () => ({ meta: [{ title: 'Agent activity · Rhyme' }] }),
  component: ActivityPage,
})

function ActivityPage() {
  const { user } = Route.useRouteContext()
  const [days, setDays] = useState<7 | 30 | 90>(30)
  const analytics = useAgentAnalytics(days)
  const chats = useChats()
  const data = analytics.data
  return (
    <WorkspaceShell user={user} section="activity" title="Agent activity">
      <main className="mx-auto w-full max-w-6xl flex-1 overflow-y-auto px-5 py-8 sm:px-10 sm:py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-muted-foreground mb-2 text-sm">
              Workspace / Insights
            </p>
            <h2 className="text-3xl font-semibold tracking-tight">
              A little help, measured.
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Understand how your assistant is working alongside you.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border p-1">
            {([7, 30, 90] as const).map((period) => (
              <Button
                key={period}
                variant={days === period ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setDays(period)}
                aria-pressed={days === period}
              >
                {period} days
              </Button>
            ))}
          </div>
        </div>
        {analytics.isError ? (
          <div className="rounded-lg border p-6">
            <p>Couldn’t load agent activity.</p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => void analytics.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                icon={Activity}
                label="Agent runs"
                value={data?.runCount.toLocaleString()}
                caption={`${data?.conversationCount ?? 0} ${data?.conversationCount === 1 ? 'conversation' : 'conversations'} in your workspace`}
              />
              <Metric
                icon={MousePointer2}
                label="Canvas actions"
                value={data?.toolCallCount.toLocaleString()}
                caption="Tools used to read and edit your ideas"
              />
              <Metric
                icon={MessageSquare}
                label="Tokens used"
                value={data?.totalTokens.toLocaleString()}
                caption={`${(data?.inputTokens ?? 0).toLocaleString()} input · ${(data?.outputTokens ?? 0).toLocaleString()} output`}
              />
              <Metric
                icon={Clock3}
                label="Average response"
                value={
                  data
                    ? `${(data.averageDurationMs / 1000).toFixed(1)}s`
                    : undefined
                }
                caption="Measured per agent run"
              />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border px-5 py-4">
              <span className="grid size-8 place-items-center rounded-md bg-muted">
                <RefreshCw className="size-4" />
              </span>
              <div className="flex-1 text-sm">
                <p className="font-medium">
                  {data?.errorCount ?? 0} unsuccessful runs
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Errors are counted from the agent. Stopped responses are
                  tracked separately.
                </p>
              </div>
              <span className="text-muted-foreground text-xs">
                Last {days} days
              </span>
            </div>
          </>
        )}
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-medium">Recent conversations</h3>
            <Button asChild variant="ghost" size="sm">
              <Link to="/chats">
                View all
                <ArrowUpRight />
              </Link>
            </Button>
          </div>
          <div className="overflow-hidden rounded-lg border">
            {chats.isPending && <Skeleton className="h-48 rounded-none" />}
            {chats.data?.slice(0, 8).map((chat) => (
              <Link
                key={chat.id}
                to="/chats"
                search={{ chat: chat.id }}
                className="hover:bg-muted/40 flex items-center gap-4 border-b px-5 py-4 transition-colors last:border-0"
              >
                <MessageSquare className="text-muted-foreground size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{chat.title}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {chat.fileName} · {timeAgo(chat.updatedAt)}
                  </p>
                </div>
                <span className="text-muted-foreground hidden text-xs tabular-nums sm:inline">
                  {chat.toolCallCount} actions ·{' '}
                  {chat.totalTokens.toLocaleString()} tokens
                </span>
                <ArrowUpRight className="text-muted-foreground size-4" />
              </Link>
            ))}
            {chats.data?.length === 0 && (
              <div className="px-6 py-16 text-center">
                <Activity className="text-muted-foreground mx-auto mb-3 size-6" />
                <p className="text-sm font-medium">
                  Your assistant’s story starts here
                </p>
                <p className="text-muted-foreground mt-2 text-sm">
                  Ask it to help on a canvas. Your activity will appear here.
                </p>
                <Button asChild variant="outline" className="mt-5">
                  <Link to="/">
                    Open a canvas
                    <ArrowUpRight />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </section>
        <p className="text-muted-foreground mt-6 text-xs leading-relaxed">
          Usage comes from model responses and recorded tool calls. Counts
          reflect canvases you can currently access.
        </p>
      </main>
    </WorkspaceShell>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  caption,
}: {
  icon: typeof Activity
  label: string
  value?: string
  caption: string
}) {
  return (
    <div className="rounded-lg border p-5">
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <Icon className="size-3.5" />
        {label}
      </div>
      {value === undefined ? (
        <Skeleton className="my-4 h-9 w-20" />
      ) : (
        <p className="my-3 text-3xl font-semibold tracking-tight tabular-nums">
          {value}
        </p>
      )}
      <p className="text-muted-foreground text-xs leading-relaxed">{caption}</p>
    </div>
  )
}
