import { useRef, useState } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ImagePlusIcon,
  Loader2Icon,
  SparklesIcon,
  XIcon,
} from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { useApi } from '@/hooks/use-api'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { ApiError, type StyleInfo } from '@/lib/api'
import { FALLBACK_STYLES } from '@/lib/styles'
import { cn } from '@/lib/utils'

const MAX_PROMPT = 600
const MAX_STYLES = 3

const formSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(10, 'Describe what the video is about in at least 10 characters.')
    .max(MAX_PROMPT, `Keep it under ${MAX_PROMPT} characters.`),
})

type FormValues = z.infer<typeof formSchema>

function StyleOption({
  style,
  selected,
  disabled,
  onToggle,
}: {
  style: StyleInfo
  selected: boolean
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        selected
          ? 'border-foreground/40 bg-muted/60'
          : 'border-border hover:bg-muted/40',
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{style.label}</span>
        <span
          className={cn(
            'size-3.5 rounded-full border',
            selected ? 'border-foreground bg-foreground' : 'border-muted-foreground/40',
          )}
        />
      </span>
      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
        {style.description}
      </span>
    </button>
  )
}

export function NewJobPage() {
  useDocumentTitle('New thumbnail')
  const api = useApi()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [selectedStyles, setSelectedStyles] = useState<string[]>([
    FALLBACK_STYLES[0]!.name,
  ])
  const [headshotUrl, setHeadshotUrl] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  const ME_KEY = ['me'] as const

  const { data: profile } = useQuery({
    queryKey: ME_KEY,
    queryFn: () => api.me(),
  })

  const { data: styles } = useQuery({
    queryKey: ['styles'],
    queryFn: () => api.styles(),
    staleTime: Infinity,
    retry: false,
  })

  const availableStyles: StyleInfo[] = styles?.length ? styles : FALLBACK_STYLES

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { prompt: '' },
    mode: 'onChange',
  })

  const prompt = watch('prompt') ?? ''

  const upload = useMutation({
    mutationFn: (file: File) => api.uploadHeadshot(file),
    onSuccess: (result) => {
      if (!result.url) {
        toast.error('Upload finished without a URL. Try another image.')
        return
      }
      setHeadshotUrl(result.url)
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Could not upload that image.',
      )
    },
  })

  const createJob = useMutation({
    mutationFn: (values: FormValues) =>
      api.createJob({
        prompt: values.prompt.trim(),
        styles: selectedStyles,
        headshotUrl,
      }),
    onSuccess: ({ job_id }) => {
      void queryClient.invalidateQueries({ queryKey: ['jobs'] })
      void queryClient.invalidateQueries({ queryKey: ME_KEY })
      navigate(`/app/jobs/${job_id}`)
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 402) {
        toast.error('You are out of credits.')
        navigate('/app/billing')
        return
      }
      toast.error(
        error instanceof Error ? error.message : 'Could not start the job.',
      )
    },
  })

  const credits = profile?.credits ?? 0
  const outOfCredits = profile !== undefined && credits < 1
  const busy = createJob.isPending || upload.isPending

  function toggleStyle(name: string) {
    setSelectedStyles((current) => {
      if (current.includes(name)) {
        if (current.length === 1) return current
        return current.filter((item) => item !== name)
      }
      if (current.length >= MAX_STYLES) return current
      return [...current, name]
    })
  }

  function handleFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('That file is not an image.')
      return
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const localUrl = URL.createObjectURL(file)
    objectUrlRef.current = localUrl
    setPreviewUrl(localUrl)
    setHeadshotUrl(null)
    upload.mutate(file)
  }

  function clearHeadshot() {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = null
    setPreviewUrl(null)
    setHeadshotUrl(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          New thumbnail
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One prompt, up to three styles. Costs one credit.
        </p>
      </div>

      {outOfCredits ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">You are out of credits</CardTitle>
            <CardDescription>
              You have used your free generations. Get in touch and I will top
              you up while the product is in beta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button render={<Link to="/app/billing" />}>See options</Button>
          </CardContent>
        </Card>
      ) : null}

      <form
        onSubmit={handleSubmit((values) => createJob.mutate(values))}
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
      >
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">The video</CardTitle>
              <CardDescription>
                What is it about? Who is watching? What should they feel?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Controller
                control={control}
                name="prompt"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="prompt">Prompt</FieldLabel>
                    <Textarea
                      {...field}
                      id="prompt"
                      rows={5}
                      maxLength={MAX_PROMPT}
                      placeholder="A 12-minute video about why most home espresso setups are worse than a $40 hand grinder."
                      aria-invalid={fieldState.invalid}
                      disabled={busy}
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {fieldState.error ? (
                          <FieldError errors={[fieldState.error]} />
                        ) : (
                          'Be specific about the subject and the mood.'
                        )}
                      </span>
                      <span>
                        {prompt.length}/{MAX_PROMPT}
                      </span>
                    </div>
                  </Field>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your face</CardTitle>
              <CardDescription>
                Optional. A clear, front-facing photo works best and is reused
                across every style.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {previewUrl ? (
                <div className="flex items-center gap-3 rounded-lg border p-2">
                  <img
                    src={headshotUrl ?? previewUrl}
                    alt="Selected headshot"
                    className="size-16 rounded-md object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {upload.isPending
                        ? 'Uploading…'
                        : headshotUrl
                          ? 'Headshot ready'
                          : 'Upload failed'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {upload.isPending
                        ? 'Sending to the image host'
                        : headshotUrl
                          ? 'Will be used as a reference'
                          : 'Try a different file'}
                    </p>
                  </div>
                  {upload.isPending ? (
                    <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={clearHeadshot}
                      aria-label="Remove headshot"
                    >
                      <XIcon />
                    </Button>
                  )}
                </div>
              ) : null}

              <label
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center transition-colors hover:bg-muted/40',
                  busy && 'pointer-events-none opacity-60',
                )}
              >
                <ImagePlusIcon className="size-5 text-muted-foreground" />
                <span className="text-sm">
                  {previewUrl ? 'Replace headshot' : 'Upload a headshot'}
                </span>
                <span className="text-xs text-muted-foreground">
                  PNG or JPG, up to ~5 MB
                </span>
                <Input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    handleFile(event.target.files?.[0])
                    event.target.value = ''
                  }}
                />
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Styles</CardTitle>
              <CardDescription>
                Pick one to three. More styles means more options, not more
                credits.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {availableStyles.map((style) => (
                <StyleOption
                  key={style.name}
                  style={style}
                  selected={selectedStyles.includes(style.name)}
                  disabled={busy}
                  onToggle={() => toggleStyle(style.name)}
                />
              ))}
            </CardContent>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Styles</span>
                <span>{selectedStyles.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Cost</span>
                <span className="flex items-center gap-1">
                  <SparklesIcon className="size-3.5" />1 credit
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Credits left</span>
                <span>{profile ? credits : '—'}</span>
              </div>
              <Progress
                value={profile ? Math.min(100, (credits / 3) * 100) : 0}
                className="h-1.5"
              />
              <Button
                type="submit"
                className="w-full"
                disabled={busy || outOfCredits || !prompt.trim()}
              >
                {createJob.isPending ? (
                  <>
                    <Loader2Icon data-icon="inline-start" className="animate-spin" />
                    Starting…
                  </>
                ) : (
                  'Generate'
                )}
              </Button>
              {errors.prompt ? (
                <p className="text-xs text-destructive">{errors.prompt.message}</p>
              ) : null}
              <p className="text-xs leading-relaxed text-muted-foreground">
                Generation takes around a minute. You can leave this tab and
                come back.
              </p>
            </CardContent>
          </Card>
        </aside>
      </form>
    </div>
  )
}
