import {
  ArrowRightIcon,
  DownloadIcon,
  SparklesIcon,
  UploadIcon,
  WandSparklesIcon,
} from 'lucide-react'
import { Show } from '@clerk/react'
import { Link } from 'react-router'

import { Brand } from '@/components/brand'
import { ThemeToggle } from '@/components/theme-toggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { FALLBACK_STYLES } from '@/lib/styles'

const PREVIEW_TONES = [
  'from-zinc-900 via-zinc-800 to-zinc-700 text-zinc-100',
  'from-zinc-100 via-zinc-50 to-zinc-200 text-zinc-900',
  'from-violet-900 via-fuchsia-800 to-orange-700 text-white',
]

const STEPS = [
  {
    icon: WandSparklesIcon,
    title: 'Describe the video',
    body: 'Type what the video is about. A sentence is enough to set the scene.',
  },
  {
    icon: UploadIcon,
    title: 'Add a headshot',
    body: 'Optional, but it keeps your face consistent across every style.',
  },
  {
    icon: DownloadIcon,
    title: 'Pick your favourite',
    body: 'Get three styles at once, cropped for YouTube, Shorts and square posts.',
  },
]

const YEAR = new Date().getFullYear()

export function LandingPage() {
  useDocumentTitle('AI thumbnails for YouTube')

  return (
    <div className="flex min-h-svh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4">
        <Brand />
        <div className="flex-1" />
        <ThemeToggle />
        <Show when="signed-out">
          <Button variant="ghost" size="sm" render={<Link to="/sign-in" />}>
            Sign in
          </Button>
          <Button size="sm" render={<Link to="/sign-up" />}>
            Get started
          </Button>
        </Show>
        <Show when="signed-in">
          <Button size="sm" render={<Link to="/app" />}>
            Open studio
          </Button>
        </Show>
      </header>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-4 pt-10 pb-16 md:pt-20">
          <div className="max-w-2xl">
            <Badge variant="outline" className="mb-5 gap-1.5 py-1">
              <SparklesIcon className="size-3" />
              3 free generations, no card required
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-6xl">
              Thumbnails that look like someone spent an afternoon on them.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
              Describe the video, optionally add a headshot, and get three
              distinct styles in about a minute. Built for creators who would
              rather edit than design.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Show when="signed-out">
                <Button size="lg" render={<Link to="/sign-up" />}>
                  Make your first thumbnail
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </Show>
              <Show when="signed-in">
                <Button size="lg" render={<Link to="/app/new" />}>
                  Start a generation
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </Show>
              <span className="text-xs text-muted-foreground">
                Sign in with Google or email
              </span>
            </div>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-3">
            {FALLBACK_STYLES.map((style, index) => (
              <figure
                key={style.name}
                className="overflow-hidden rounded-xl border bg-card"
              >
                <div
                  className={`relative flex aspect-video items-end bg-gradient-to-br p-4 ${PREVIEW_TONES[index] ?? PREVIEW_TONES[0]}`}
                >
                  <span className="absolute top-3 left-3 rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase backdrop-blur">
                    16:9
                  </span>
                  <span className="text-sm font-semibold">{style.label}</span>
                </div>
                <figcaption className="p-4 text-xs leading-relaxed text-muted-foreground">
                  {style.description}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="border-y bg-muted/30">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <div key={step.title}>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <span className="flex size-6 items-center justify-center rounded-full border bg-background">
                    <step.icon className="size-3.5" />
                  </span>
                  Step {index + 1}
                </div>
                <h2 className="mt-3 text-sm font-semibold">{step.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center">
        <span>© {YEAR} Thumbnail Builder</span>
        <span className="hidden sm:inline">·</span>
        <span>Early beta. Things will change.</span>
        <div className="flex-1" />
        <Link to="/app/billing" className="hover:text-foreground">
          Pricing
        </Link>
      </footer>
    </div>
  )
}
