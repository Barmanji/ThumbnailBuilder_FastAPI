import { ClerkProvider } from '@clerk/react'
import { shadcn } from '@clerk/ui/themes'
import { createBrowserRouter, Outlet } from 'react-router'

import { AppShell } from '@/components/app-shell'
import { RequireAuth } from '@/components/require-auth'
import { BillingPage } from '@/routes/billing'
import { DashboardPage } from '@/routes/dashboard'
import { JobDetailPage } from '@/routes/job-detail'
import { LandingPage } from '@/routes/landing'
import { NewJobPage } from '@/routes/new-job'
import { NotFoundPage } from '@/routes/not-found'
import { SettingsPage } from '@/routes/settings'
import { SignInPage } from '@/routes/sign-in'
import { SignUpPage } from '@/routes/sign-up'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

function MissingClerkKey() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="max-w-md space-y-2 text-center">
        <h1 className="text-lg font-semibold">Clerk is not configured</h1>
        <p className="text-sm text-muted-foreground">
          Add <code className="rounded bg-muted px-1 py-0.5">VITE_CLERK_PUBLISHABLE_KEY</code>{' '}
          to <code className="rounded bg-muted px-1 py-0.5">FE/.env.local</code> and
          restart the dev server.
        </p>
      </div>
    </div>
  )
}

function RootLayout() {
  if (!publishableKey) {
    return <MissingClerkKey />
  }

  return (
    <ClerkProvider publishableKey={publishableKey} appearance={{ theme: shadcn }}>
      <Outlet />
    </ClerkProvider>
  )
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/sign-in/*', element: <SignInPage /> },
      { path: '/sign-up/*', element: <SignUpPage /> },
      {
        path: '/app',
        element: (
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'new', element: <NewJobPage /> },
          { path: 'jobs/:id', element: <JobDetailPage /> },
          { path: 'billing', element: <BillingPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
