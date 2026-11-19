import type { ReactNode } from 'react'

import { useAuth } from '@clerk/react'
import { Navigate, useLocation } from 'react-router'

import { Spinner } from '@/components/ui/spinner'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const location = useLocation()

  if (!isLoaded) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!isSignedIn) {
    const redirect = `${location.pathname}${location.search}`
    return (
      <Navigate
        to={`/sign-in?redirect_url=${encodeURIComponent(redirect)}`}
        replace
      />
    )
  }

  return <>{children}</>
}
