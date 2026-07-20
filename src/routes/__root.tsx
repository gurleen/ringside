import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { Menu, Swords } from 'lucide-react'
import { useState } from 'react'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import { SpoilersProvider } from '#/components/spoilers-provider'
import { SpoilersToggle } from '#/components/spoilers-toggle'
import { UserMenu } from '#/components/user-menu'
import { Button } from '#/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '#/components/ui/sheet'
import { currentUserQueryOptions } from '#/lib/auth'
import type { AuthUser } from '#/lib/auth'
import { promotionAbbrsQueryOptions } from '#/lib/promotions'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
  user: AuthUser | null
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: async ({ context }) => {
    const [user] = await Promise.all([
      context.queryClient.ensureQueryData(currentUserQueryOptions()),
      context.queryClient.ensureQueryData(promotionAbbrsQueryOptions()),
    ])
    return { user }
  },
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Ringside — Pro Wrestling Database',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
})

function NavLinks({
  linkClassName,
  onNavigate,
}: {
  linkClassName: string
  onNavigate?: () => void
}) {
  return (
    <>
      <Link
        to="/"
        preload="render"
        search={{ tab: 'champions' }}
        activeOptions={{ exact: true }}
        activeProps={{ className: 'text-foreground font-medium' }}
        className={linkClassName}
        onClick={onNavigate}
      >
        Dashboard
      </Link>
      <Link
        to="/wrestlers"
        preload="render"
        search={{ q: '', page: 1 }}
        activeProps={{ className: 'text-foreground font-medium' }}
        className={linkClassName}
        onClick={onNavigate}
      >
        Wrestlers
      </Link>
      <Link
        to="/events"
        preload="render"
        search={{
          q: '',
          page: 1,
          future: false,
          promotion: '',
          sort: 'date_desc',
        }}
        activeProps={{ className: 'text-foreground font-medium' }}
        className={linkClassName}
        onClick={onNavigate}
      >
        Events
      </Link>
      <Link
        to="/titles"
        preload="render"
        search={{ q: '', page: 1, promotion: '', status: 'all' }}
        activeProps={{ className: 'text-foreground font-medium' }}
        className={linkClassName}
        onClick={onNavigate}
      >
        Titles
      </Link>
      <Link
        to="/leaderboard"
        preload="render"
        search={{ page: 1 }}
        activeProps={{ className: 'text-foreground font-medium' }}
        className={linkClassName}
        onClick={onNavigate}
      >
        Leaderboard
      </Link>
    </>
  )
}

function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="size-5" />
          <span className="sr-only">Open menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Swords className="size-5 text-primary" />
            Ringside
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-4 text-muted-foreground">
          <NavLinks
            linkClassName="rounded-md px-2 py-2 transition-colors hover:bg-accent hover:text-foreground"
            onNavigate={() => setOpen(false)}
          />
        </nav>
        <SheetFooter className="border-t">
          <SpoilersToggle id="spoilers-mobile" />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function RootComponent() {
  const { user } = Route.useRouteContext()

  return (
    <SpoilersProvider>
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 md:gap-6">
            <MobileNav />
            <Link
              to="/"
              search={{ tab: 'champions' }}
              className="flex items-center gap-2 font-bold"
            >
              <Swords className="size-5 text-primary" />
              <span>Ringside</span>
            </Link>
            <nav className="hidden items-center gap-4 text-sm text-muted-foreground md:flex">
              <NavLinks linkClassName="transition-colors hover:text-foreground" />
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <SpoilersToggle
                id="spoilers-desktop"
                className="hidden text-muted-foreground md:flex"
              />
              {user ? (
                <UserMenu user={user} />
              ) : (
                <>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/login" search={{ error: undefined }}>
                      Log in
                    </Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link to="/signup">Sign up</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">
          <Outlet />
        </main>
      </div>
    </SpoilersProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
