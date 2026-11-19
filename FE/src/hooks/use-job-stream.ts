import { useEffect, useRef } from 'react'

import { useApi } from '@/hooks/use-api'
import { API_BASE } from '@/lib/api'

/**
 * Subscribes to job updates over SSE using a single-use ticket, because
 * EventSource cannot send an Authorization header.
 */
export function useJobStream(
  jobId: string | undefined,
  enabled: boolean,
  onEvent: () => void,
) {
  const api = useApi()
  const onEventRef = useRef(onEvent)

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    if (!jobId || !enabled) return

    let cancelled = false
    let source: EventSource | null = null

    void (async () => {
      try {
        const { ticket } = await api.createStreamTicket(jobId)
        if (cancelled) return

        source = new EventSource(
          `${API_BASE}/jobs/${jobId}/stream?ticket=${encodeURIComponent(ticket)}`,
        )

        const notify = () => onEventRef.current()
        source.addEventListener('thumbnail_ready', notify)
        source.addEventListener('thumbnail_failed', notify)
        source.addEventListener('job_completed', () => {
          notify()
          source?.close()
        })
        source.onerror = () => {
          source?.close()
        }
      } catch {
        // The query keeps polling as a fallback, so a failed ticket is not fatal.
      }
    })()

    return () => {
      cancelled = true
      source?.close()
    }
  }, [api, jobId, enabled])
}
