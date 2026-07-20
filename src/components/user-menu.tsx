import { Link, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Dices, LogOut, Star, Ticket } from 'lucide-react'

import type { AuthUser } from '#/lib/auth'
import { currentUserQueryOptions, signOut } from '#/lib/auth'
import { SpoilersToggle } from '#/components/spoilers-toggle'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'

function initialsFromUser(user: AuthUser): string {
  const fromUsername = user.username.slice(0, 2).toUpperCase()
  if (fromUsername) return fromUsername
  return user.email.slice(0, 2).toUpperCase()
}

export function UserMenu({ user }: { user: AuthUser }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [pending, setPending] = useState(false)

  async function handleSignOut() {
    setPending(true)
    try {
      await signOut()
      queryClient.setQueryData(currentUserQueryOptions().queryKey, null)
      await router.invalidate()
      await router.navigate({ to: '/' })
    } finally {
      setPending(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-9 gap-2 px-2"
          aria-label="Account menu"
        >
          <Avatar size="sm">
            <AvatarFallback className="text-xs">
              {initialsFromUser(user)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-36 truncate sm:inline">
            {user.username}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium">
                {user.username}
              </span>
              {user.isAdmin && (
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  Admin
                </Badge>
              )}
            </div>
            <span className="truncate text-xs text-muted-foreground">
              {user.email}
            </span>
          </div>
        </DropdownMenuLabel>
        <div
          className="px-2 py-1.5"
          // Keep the menu open while toggling Spoilers.
          onPointerDown={(event) => event.preventDefault()}
        >
          <SpoilersToggle
            id="spoilers-account"
            className="w-full justify-between"
          />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/reviews" search={{ page: 1 }}>
            <Star />
            My Reviews
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/shows" search={{ page: 1 }}>
            <Ticket />
            My Shows
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/predictions" search={{ page: 1 }}>
            <Dices />
            My Predictions
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending}
          onSelect={(event) => {
            event.preventDefault()
            void handleSignOut()
          }}
        >
          <LogOut />
          {pending ? 'Signing out…' : 'Log out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
