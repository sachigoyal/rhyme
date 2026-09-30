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
import { PageHeading } from '@/components/page-heading'
import { timeAgo } from '@/lib/format'

export const Route = createFileRoute('/_app/activity')({
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(
      context.trpc.chats.analytics.queryOptions({ days: 30 }),
    )
  },
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
      <section className="workspace-page" aria-label="Agent activity overview">
        <PageHeading
          title="Agent activity"
          description="Usage and performance across your canvases."
        >
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
        </PageHeading>
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                icon={Activity}
                label="Agent runs"
                value={data?.runCount.toLocaleString()}
                caption={
                  data
                    ? `${data.conversationCount} ${data.conversationCount === 1 ? 'conversation' : 'conversations'} in your workspace`
                    : 'Conversations in your workspace'
                }
              />
              <Metric
                icon={MousePointer2}
                label="Canvas actions"
                value={data?.toolCallCount.toLocaleString()}
                caption="Calls to read, create, update, or delete shapes"
              />
              <Metric
                icon={MessageSquare}
                label="Tokens used"
                value={data?.totalTokens.toLocaleString()}
                caption={
                  data
                    ? `${data.inputTokens.toLocaleString()} input · ${data.outputTokens.toLocaleString()} output`
                    : 'Input and output tokens'
                }
              />
              <Metric
                icon={Clock3}
                label="Average run time"
                value={
                  data
                    ? `${(data.averageDurationMs / 1000).toFixed(1)}s`
                    : undefined
                }
                caption="Time per agent run"
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-3">
              <span className="grid size-8 place-items-center rounded-md bg-muted">
                <RefreshCw className="size-4" />
              </span>
              <div className="flex-1 text-sm">
                <p className="font-medium">
                  {data ? (
                    `${data.errorCount} failed runs`
                  ) : (
                    <Skeleton className="h-5 w-36" />
                  )}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Cancelled responses are excluded from failed runs.
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
            {chats.data
              ?.filter((chat) => !chat.id.startsWith('pending:'))
              .slice(0, 8)
              .map((chat) => (
                <Link
                  key={chat.id}
                  to="/chats"
                  search={{ chat: chat.id }}
                  className="hover:bg-muted/40 flex items-center gap-3 border-b px-3 py-3 transition-colors last:border-0"
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
                <p className="text-sm font-medium">No agent activity</p>
                <p className="text-muted-foreground mt-2 text-sm">
                  Use the assistant on a canvas to record activity.
                </p>
                <Button asChild variant="outline" className="mt-5">
                  <Link to="/">
                    Open canvas
                    <ArrowUpRight />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </section>
        <p className="text-muted-foreground mt-6 text-xs leading-relaxed">
          Usage includes model responses and tool calls for canvases you can
          access.
        </p>
      </section>
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
    <div className="bg-card rounded-lg border p-3">
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <Icon className="size-3.5" />
        {label}
      </div>
      {value === undefined ? (
        <Skeleton className="my-4 h-9 w-20" />
      ) : (
        <p className="my-3 text-4xl font-medium tracking-[-0.04em] tabular-nums">
          {value}
        </p>
      )}
      <p className="text-muted-foreground text-xs leading-relaxed">{caption}</p>
    </div>
  )
}
