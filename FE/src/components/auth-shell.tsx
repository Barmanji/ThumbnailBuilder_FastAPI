import type { ReactNode } from 'react'

import { ArrowLeftIcon, CheckIcon } from 'lucide-react'
import { Link } from 'react-router'

import { Brand } from '@/components/brand'
import { ThemeToggle } from '@/components/theme-toggle'

const POINTS = [
  'Three thumbnail styles from one prompt',
  'Cropped for YouTube, Shorts and square posts',
  'Your headshot, kept consistent across styles',
]

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-6 p-6 md:p-10">
        <div className="flex items-center gap-2">
          <Brand />
          <div className="flex-1" />
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>

        <Link
          to="/"
          className="mx-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Back to home
        </Link>
      </div>

      <div className="hidden border-l bg-muted/30 lg:flex lg:flex-col lg:justify-center lg:p-14">
        <h2 className="max-w-sm text-2xl font-semibold tracking-tight text-balance">
          Stop fighting with Canva at midnight.
        </h2>
        <ul className="mt-8 space-y-4">
          {POINTS.map((point) => (
            <li key={point} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <CheckIcon className="size-3" />
              </span>
              {point}
            </li>
          ))}
        </ul>
        <p className="mt-10 max-w-sm text-xs leading-relaxed text-muted-foreground">
          You get three free generations when you sign up. No card, no trial
          countdown.
        </p>
      </div>
    </div>
  )
}
