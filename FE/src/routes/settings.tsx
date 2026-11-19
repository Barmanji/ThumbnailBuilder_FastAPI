import { LogOutIcon, MailIcon } from 'lucide-react'
import { useClerk, useUser } from '@clerk/react'
import { useQuery } from '@tanstack/react-query'

import { ThemeToggle } from '@/components/theme-toggle'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useApi } from '@/hooks/use-api'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { SITE } from '@/lib/site'

function initials(name: string | null | undefined, email: string | undefined) {
  const source = name?.trim() || email?.split('@')[0] || '?'
  return source.slice(0, 2).toUpperCase()
}

export function SettingsPage() {
  useDocumentTitle('Settings')
  const api = useApi()
  const { user } = useUser()
  const { signOut } = useClerk()

  const { data: profile, isPending } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.me(),
  })

  const email = user?.primaryEmailAddress?.emailAddress ?? profile?.email

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account and how the studio behaves.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>
            Managed by Clerk. Click your avatar in the top bar to edit it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="size-12">
            <AvatarImage src={user?.imageUrl} alt="" />
            <AvatarFallback>{initials(user?.fullName, email)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {isPending ? <Skeleton className="h-4 w-32" /> : user?.fullName || 'Creator'}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {isPending ? <Skeleton className="mt-1 h-3 w-40" /> : email}
            </p>
          </div>
        </CardContent>
        <Separator />
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="text-sm font-medium">Credits</p>
            <p className="text-xs text-muted-foreground">
              Generations left on your account
            </p>
          </div>
          <span className="text-sm font-medium">
            {isPending ? <Skeleton className="h-4 w-10" /> : (profile?.credits ?? 0)}
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>
            Follow your system theme, or pin light or dark.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Theme</span>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>
            Signing out clears your session on this device.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void signOut({ redirectUrl: '/' })}
          >
            <LogOutIcon data-icon="inline-start" />
            Sign out
          </Button>
          <Button
            variant="ghost"
            render={
              <a
                href={`mailto:${SITE.contactEmail}?subject=Delete%20my%20Thumbnail%20Builder%20account`}
              />
            }
          >
            <MailIcon data-icon="inline-start" />
            Request account deletion
          </Button>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {SITE.name} is in early beta. Your thumbnails are stored on ImageKit and
        may be removed when the beta ends.
      </p>
    </div>
  )
}
