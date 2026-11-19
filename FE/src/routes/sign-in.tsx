import { SignIn } from '@clerk/react'

import { AuthShell } from '@/components/auth-shell'
import { useDocumentTitle } from '@/hooks/use-document-title'

export function SignInPage() {
  useDocumentTitle('Sign in')

  return (
    <AuthShell>
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/app"
      />
    </AuthShell>
  )
}
