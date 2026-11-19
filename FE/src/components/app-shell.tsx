import {
  CreditCardIcon,
  LayoutDashboardIcon,
  PlusIcon,
  SettingsIcon,
  SparklesIcon,
} from 'lucide-react'
import { UserButton } from '@clerk/react'
import { useQuery } from '@tanstack/react-query'
import { Link, Outlet, useLocation } from 'react-router'

import { Brand } from '@/components/brand'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useApi } from '@/hooks/use-api'

const NAV_ITEMS = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboardIcon, end: true },
  { to: '/app/new', label: 'New thumbnail', icon: PlusIcon, end: false },
  { to: '/app/billing', label: 'Credits', icon: CreditCardIcon, end: false },
  { to: '/app/settings', label: 'Settings', icon: SettingsIcon, end: false },
]

function isActive(pathname: string, to: string, end: boolean) {
  return end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)
}

function CreditsPill() {
  const api = useApi()
  const { data, isPending } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.me(),
  })

  if (isPending) {
    return <Skeleton className="h-7 w-24 rounded-full" />
  }

  const credits = data?.credits ?? 0

  return (
    <Link
      to="/app/billing"
      className="flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium transition-colors hover:bg-muted"
    >
      <SparklesIcon className="size-3.5 text-muted-foreground" />
      {credits} {credits === 1 ? 'credit' : 'credits'}
    </Link>
  )
}

export function AppShell() {
  const { pathname } = useLocation()

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <Brand to="/app" />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      isActive={isActive(pathname, item.to, item.end)}
                      tooltip={item.label}
                      render={<Link to={item.to} />}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="px-2 pb-1 text-[11px] leading-relaxed text-muted-foreground group-data-[collapsible=icon]:hidden">
            Built for creators. Three free generations to start.
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur md:px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-1 h-5" />
          <div className="flex-1" />
          <CreditsPill />
          <ThemeToggle />
          <UserButton
            appearance={{ elements: { avatarBox: 'size-8' } }}
            userProfileMode="modal"
          />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
