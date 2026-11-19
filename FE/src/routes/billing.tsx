import { CheckIcon, SparklesIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useApi } from '@/hooks/use-api'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { SITE } from '@/lib/site'

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    cadence: 'forever',
    credits: `${SITE.freeCredits} generations`,
    features: ['All three styles', 'YouTube, Shorts and square crops', 'Headshot reference'],
    current: true,
  },
  {
    name: 'Creator',
    price: '$9',
    cadence: 'per month',
    credits: '30 generations / month',
    features: ['Everything in Free', 'Priority queue', 'Generation history'],
    current: false,
    featured: true,
  },
  {
    name: 'Studio',
    price: '$29',
    cadence: 'per month',
    credits: '150 generations / month',
    features: ['Everything in Creator', 'Private image folder', 'Early access to new styles'],
    current: false,
  },
]

const mailto = `mailto:${SITE.contactEmail}?subject=Thumbnail%20Builder%20credits`

export function BillingPage() {
  useDocumentTitle('Credits')
  const api = useApi()

  const { data: profile, isPending } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.me(),
  })

  const credits = profile?.credits ?? 0
  const total = Math.max(SITE.freeCredits, credits)
  const usedPercent = total > 0 ? ((total - credits) / total) * 100 : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Credits</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One generation is one prompt and up to three thumbnails.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <SparklesIcon className="size-4" />
            {isPending ? (
              <Skeleton className="h-4 w-28" />
            ) : (
              <>
                {credits} of {total} credits left
              </>
            )}
          </CardTitle>
          <CardDescription>
            Free generations are not reset monthly. When they run out, get in
            touch and I will top you up while this is in beta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={usedPercent} className="h-1.5" />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => (
          <Card
            key={plan.name}
            className={plan.featured ? 'border-foreground/30 shadow-sm' : undefined}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{plan.name}</CardTitle>
                {plan.featured ? (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium tracking-wide text-primary-foreground uppercase">
                    Planned
                  </span>
                ) : null}
              </div>
              <CardDescription>
                <span className="text-2xl font-semibold tracking-tight text-foreground">
                  {plan.price}
                </span>{' '}
                <span className="text-xs">{plan.cadence}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm font-medium">{plan.credits}</p>
              <ul className="space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckIcon className="mt-0.5 size-3.5 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              {plan.current ? (
                <Button variant="outline" className="w-full" disabled>
                  Current plan
                </Button>
              ) : (
                <Button
                  variant={plan.featured ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() =>
                    // Payments land after the beta. Until then this is honest
                    // about what is actually available.
                    // eslint-disable-next-line no-alert
                    window.alert(
                      'Payments are coming later. This is a beta — email me and I will add credits to your account.',
                    )
                  }
                >
                  Choose {plan.name}
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-5">
          <div>
            <p className="text-sm font-medium">Need credits right now?</p>
            <p className="text-xs text-muted-foreground">
              Send a note and I will top your account up manually.
            </p>
          </div>
          <Button variant="outline" render={<a href={mailto} />}>
            Email me
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
