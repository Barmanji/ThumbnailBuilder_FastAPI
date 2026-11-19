import { ImageOffIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'

import { JobStatusBadge } from '@/components/job-status-badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useApi } from '@/hooks/use-api'
import { useDocumentTitle } from '@/hooks/use-document-title'
import type { JobSummary } from '@/lib/api'

function relativeTime(iso: string): string {
  const date = new Date(iso)
  const diff = Date.now() - date.getTime()
  const minutes = Math.round(diff / 60_000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function JobCard({ job }: { job: JobSummary }) {
  return (
    <Link
      to={`/app/jobs/${job.id}`}
      className="group overflow-hidden rounded-xl border bg-card transition-colors hover:border-foreground/20"
    >
      <div className="relative aspect-video overflow-hidden bg-muted">
        {job.cover_url ? (
          <img
            src={job.cover_url}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageOffIcon className="size-6" />
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <JobStatusBadge status={job.status} />
          <span className="text-xs text-muted-foreground">
            {relativeTime(job.created_at)}
          </span>
        </div>
        <p className="line-clamp-2 text-sm leading-snug">{job.prompt}</p>
        <p className="text-xs text-muted-foreground">
          {job.num_thumbnails} {job.num_thumbnails === 1 ? 'style' : 'styles'}
        </p>
      </div>
    </Link>
  )
}

export function DashboardPage() {
  useDocumentTitle('Dashboard')
  const api = useApi()

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => api.listJobs(),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Your thumbnails
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every generation you have run, newest first.
          </p>
        </div>
        <Button render={<Link to="/app/new" />}>New thumbnail</Button>
      </div>

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-xl border">
              <Skeleton className="aspect-video rounded-none" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Could not load your thumbnails</EmptyTitle>
            <EmptyDescription>
              The server did not answer. It may be waking up.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => void refetch()}>
              Try again
            </Button>
          </EmptyContent>
        </Empty>
      ) : data.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ImageOffIcon />
            </EmptyMedia>
            <EmptyTitle>No thumbnails yet</EmptyTitle>
            <EmptyDescription>
              Run your first generation. You get three free ones.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button render={<Link to="/app/new" />}>Create a thumbnail</Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  )
}
