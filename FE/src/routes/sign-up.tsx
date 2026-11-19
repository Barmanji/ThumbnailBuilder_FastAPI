import { SignUp } from '@clerk/react'

import { AuthShell } from '@/components/auth-shell'
import { useDocumentTitle } from '@/hooks/use-document-title'

export function SignUpPage() {
  useDocumentTitle('Create your account')

  return (
    <AuthShell>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/app"
      />
    </AuthShell>
  )
}
