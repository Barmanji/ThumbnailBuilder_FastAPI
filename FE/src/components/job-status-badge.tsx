import { Badge } from '@/components/ui/badge'
import type { JobStatus } from '@/lib/api'
import { cn } from '@/lib/utils'

const JOB_STATUS: Record<JobStatus, { label: string; className: string }> = {
  pending: {
    label: 'Queued',
    className: 'bg-muted text-muted-foreground',
  },
  processing: {
    label: 'Generating',
    className:
      'bg-amber-500/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300',
  },
  completed: {
    label: 'Ready',
    className:
      'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300',
  },
  failed: {
    label: 'Failed',
    className:
      'bg-destructive/10 text-destructive dark:bg-destructive/20',
  },
}

export function JobStatusBadge({
  status,
  className,
}: {
  status: JobStatus
  className?: string
}) {
  const config = JOB_STATUS[status]

  return (
    <Badge variant="secondary" className={cn('border-transparent', config.className, className)}>
      {config.label}
    </Badge>
  )
}
