import { useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { LogOut } from 'lucide-react'

import type { AuthUser } from '#/lib/auth'
import { currentUserQueryOptions, signOut } from '#/lib/auth'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
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
            <span className="truncate text-sm font-medium">
              {user.username}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {user.email}
            </span>
          </div>
        </DropdownMenuLabel>
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
