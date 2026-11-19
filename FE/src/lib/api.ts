export const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(
  /\/+$/,
  '',
)

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type ThumbnailStatus = 'pending' | 'generating' | 'uploaded' | 'error'

export interface Variants {
  youtube: string
  shorts: string
  square: string
}

export interface Thumbnail {
  id: string
  style_name: string
  status: ThumbnailStatus
  imagekit_url: string | null
  error_message: string | null
  variants: Variants | null
}

export interface Job {
  id: string
  prompt: string
  num_thumbnails: number
  headshot_url: string | null
  status: JobStatus
  created_at: string
  thumbnails: Thumbnail[]
}

export interface JobSummary {
  id: string
  prompt: string
  status: JobStatus
  num_thumbnails: number
  created_at: string
  cover_url: string | null
}

export interface UserProfile {
  id: string
  email: string
  name: string | null
  image_url: string | null
  credits: number
  created_at: string
}

export interface StyleInfo {
  name: string
  label: string
  description: string
}

export interface CreateJobInput {
  prompt: string
  styles: string[]
  headshotUrl: string | null
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string | undefined

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

type GetToken = () => Promise<string | null>

interface ErrorDetailObject {
  code?: string
  message?: string
}

interface ErrorBody {
  detail?: string | ErrorDetailObject | Array<{ msg?: string }>
}

function parseError(body: unknown, status: number): ApiError {
  const detail = (body as ErrorBody | null)?.detail

  if (typeof detail === 'string') {
    return new ApiError(detail, status)
  }

  if (Array.isArray(detail)) {
    const message = detail
      .map((issue) => issue.msg)
      .filter(Boolean)
      .join(', ')
    return new ApiError(message || 'Request failed', status)
  }

  if (detail && typeof detail === 'object') {
    return new ApiError(
      detail.message || detail.code || 'Request failed',
      status,
      detail.code,
    )
  }

  return new ApiError(`Request failed (${status})`, status)
}

export interface ApiClient {
  me: () => Promise<UserProfile>
  styles: () => Promise<StyleInfo[]>
  listJobs: () => Promise<JobSummary[]>
  getJob: (jobId: string) => Promise<Job>
  createJob: (input: CreateJobInput) => Promise<{ job_id: string }>
  uploadHeadshot: (file: File) => Promise<{ url: string | null }>
  createStreamTicket: (jobId: string) => Promise<{ ticket: string }>
  retryThumbnail: (jobId: string, thumbnailId: string) => Promise<Job>
}

export function createApiClient(getToken: GetToken): ApiClient {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await getToken()
    const headers = new Headers(init.headers)

    if (!(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json')
    }
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    const response = await fetch(`${API_BASE}${path}`, { ...init, headers })

    if (!response.ok) {
      let body: unknown = null
      try {
        body = await response.json()
      } catch {
        // Non-JSON error (proxy, gateway). Fall through to the generic message.
      }
      throw parseError(body, response.status)
    }

    if (response.status === 204) {
      return undefined as T
    }

    return (await response.json()) as T
  }

  return {
    me: () => request<UserProfile>('/me'),
    styles: () => request<StyleInfo[]>('/styles'),
    listJobs: () => request<JobSummary[]>('/jobs'),
    getJob: (jobId) => request<Job>(`/jobs/${jobId}`),
    createJob: (input) =>
      request<{ job_id: string }>('/jobs', {
        method: 'POST',
        body: JSON.stringify({
          prompt: input.prompt,
          styles: input.styles,
          headshot_url: input.headshotUrl,
        }),
      }),
    uploadHeadshot: (file) => {
      const formData = new FormData()
      formData.append('file', file)
      return request<{ url: string | null }>('/upload-headshot', {
        method: 'POST',
        body: formData,
      })
    },
    createStreamTicket: (jobId) =>
      request<{ ticket: string }>(`/jobs/${jobId}/stream-ticket`, {
        method: 'POST',
      }),
    retryThumbnail: (jobId, thumbnailId) =>
      request<Job>(`/jobs/${jobId}/thumbnails/${thumbnailId}/retry`, {
        method: 'POST',
      }),
  }
}
