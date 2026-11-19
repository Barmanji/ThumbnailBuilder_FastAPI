import { useMemo } from 'react'

import { useAuth } from '@clerk/react'

import { createApiClient, type ApiClient } from '@/lib/api'

/**
 * Authenticated API client bound to the current Clerk session.
 * Every request mints a fresh short-lived token.
 */
export function useApi(): ApiClient {
  const { getToken } = useAuth()

  return useMemo(() => createApiClient(() => getToken()), [getToken])
}
