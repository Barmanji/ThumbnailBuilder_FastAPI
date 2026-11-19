import { ClapperboardIcon } from 'lucide-react'
import { Link } from 'react-router'

import { SITE } from '@/lib/site'

export function Brand({ to = '/' }: { to?: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-md px-1 py-1 text-sm font-semibold tracking-tight"
    >
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <ClapperboardIcon className="size-4" />
      </span>
      <span className="truncate">{SITE.name}</span>
    </Link>
  )
}
