import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  DownloadIcon,
  Loader2Icon,
  RefreshCwIcon,
} from 'lucide-react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'

import { JobStatusBadge } from '@/components/job-status-badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useApi } from '@/hooks/use-api'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useJobStream } from '@/hooks/use-job-stream'
import type { Thumbnail, Variants } from '@/lib/api'
import { FALLBACK_STYLES, styleLabel } from '@/lib/styles'
import { cn } from '@/lib/utils'

type VariantKey = keyof Variants

const VARIANT_LABELS: Record<VariantKey, string> = {
  youtube: 'YouTube',
  shorts: 'Shorts',
  square: 'Square',
}

function ThumbnailCard({
  thumbnail,
  jobId,
}: {
  thumbnail: Thumbnail
  jobId: string
}) {
  const api = useApi()
  const queryClient = useQueryClient()
  const [variant, setVariant] = useState<VariantKey>('youtube')

  const retry = useMutation({
    mutationFn: () => api.retryThumbnail(jobId, thumbnail.id),
    onSuccess: (job) => {
      queryClient.setQueryData(['job', jobId], job)
      void queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Could not retry this style.',
      )
    },
  })

  const label = styleLabel(FALLBACK_STYLES, thumbnail.style_name)
  const src = thumbnail.variants?.[variant] ?? thumbnail.imagekit_url

  return (
    <Card className="overflow-hidden pt-0">
      <div className="relative aspect-video bg-muted">
        {thumbnail.status === 'uploaded' && src ? (
          <img
            src={src}
            alt={`${label} thumbnail`}
            className="size-full object-cover"
          />
        ) : thumbnail.status === 'error' ? (
          <div className="flex size-full flex-col items-center justify-center gap-2 p-6 text-center">
            <AlertTriangleIcon className="size-5 text-destructive" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {thumbnail.error_message ?? 'Generation failed.'}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => retry.mutate()}
              disabled={retry.isPending}
            >
              <RefreshCwIcon data-icon="inline-start" />
              Retry
            </Button>
          </div>
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2">
            <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {thumbnail.status === 'generating'
                ? 'Painting pixels…'
                : 'Queued'}
            </p>
          </div>
        )}
      </div>

      <CardHeader className="pt-4">
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          {label}
          {thumbnail.status === 'uploaded' ? (
            <Button
              variant="ghost"
              size="icon-sm"
              render={
                <a
                  href={thumbnail.imagekit_url ?? src ?? '#'}
                  download
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Download ${label}`}
                />
              }
            >
              <DownloadIcon />
            </Button>
          ) : null}
        </CardTitle>
      </CardHeader>

      {thumbnail.status === 'uploaded' && thumbnail.variants ? (
        <CardFooter>
          <Tabs
            value={variant}
            onValueChange={(value) => setVariant(value as VariantKey)}
          >
            <TabsList className="w-full">
              {(Object.keys(VARIANT_LABELS) as VariantKey[]).map((key) => (
                <TabsTrigger key={key} value={key} className="flex-1">
                  {VARIANT_LABELS[key]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardFooter>
      ) : null}
    </Card>
  )
}

function PlaceholderCard({ styleName }: { styleName: string }) {
  return (
    <Card className="overflow-hidden pt-0">
      <Skeleton className="aspect-video rounded-none" />
      <CardHeader className="pt-4">
        <CardTitle className="text-sm">
          {styleLabel(FALLBACK_STYLES, styleName)}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const api = useApi()
  const queryClient = useQueryClient()
  useDocumentTitle('Generation')

  const { data: job, isPending, isError, error, refetch } = useQuery({
    queryKey: ['job', id],
    queryFn: () => api.getJob(id!),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'pending' || status === 'processing' ? 8000 : false
    },
  })

  const active = job?.status === 'pending' || job?.status === 'processing'

  useJobStream(id, Boolean(active), () => {
    void queryClient.invalidateQueries({ queryKey: ['job', id] })
    void queryClient.invalidateQueries({ queryKey: ['jobs'] })
  })

  if (!id) {
    return null
  }

  if (isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="aspect-video" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !job) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load this generation</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : 'Unknown error.'}
        </AlertDescription>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          Try again
        </Button>
      </Alert>
    )
  }

  const finished = job.thumbnails.filter(
    (thumbnail) => thumbnail.status === 'uploaded',
  ).length
  const total = job.thumbnails.length || job.num_thumbnails
  const progress = total > 0 ? (finished / total) * 100 : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            render={<Link to="/app" />}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Dashboard
          </Button>
          <h1 className="max-w-2xl text-xl font-semibold tracking-tight text-balance">
            {job.prompt}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <JobStatusBadge status={job.status} />
            <span>
              {new Date(job.created_at).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
            <span>·</span>
            <span>
              {job.num_thumbnails}{' '}
              {job.num_thumbnails === 1 ? 'style' : 'styles'}
            </span>
          </div>
        </div>
        <Button variant="outline" render={<Link to="/app/new" />}>
          New thumbnail
        </Button>
      </div>

      {active ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Spinner className="size-3" />
              Generating {finished} of {total}
            </span>
            <span>Usually under a minute</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      ) : null}

      <div
        className={cn(
          'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
          active && 'animate-in',
        )}
      >
        {job.thumbnails.length > 0
          ? job.thumbnails.map((thumbnail) => (
              <ThumbnailCard
                key={thumbnail.id}
                thumbnail={thumbnail}
                jobId={job.id}
              />
            ))
          : Array.from({ length: job.num_thumbnails }).map((_, index) => (
              <PlaceholderCard key={index} styleName="" />
            ))}
      </div>

      {job.headshot_url ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <img
              src={job.headshot_url}
              alt="Reference headshot"
              className="size-12 rounded-md object-cover"
            />
            <div>
              <p className="text-sm font-medium">Reference headshot</p>
              <p className="text-xs text-muted-foreground">
                Used to keep your face consistent across styles.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
