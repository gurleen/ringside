import {
  Link,
  createFileRoute,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { currentUserQueryOptions, signUp } from '#/lib/auth'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'

export const Route = createFileRoute('/signup')({
  beforeLoad: ({ context }) => {
    if (context.user) {
      throw redirect({ to: '/' })
    }
  },
  component: SignupPage,
})

function SignupPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    setConfirmEmail(null)

    try {
      const result = await signUp({
        data: { username, email, password },
      })

      if (result.status === 'error') {
        setError(result.message)
        return
      }

      if (result.status === 'confirm_email') {
        setConfirmEmail(result.email)
        return
      }

      queryClient.setQueryData(currentUserQueryOptions().queryKey, result.user)
      await router.invalidate()
      await router.navigate({ to: '/' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign up.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Sign up</CardTitle>
          <CardDescription>
            Create a Ringside account with a unique username.
          </CardDescription>
        </CardHeader>
        {confirmEmail ? (
          <CardContent className="flex flex-col gap-3">
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              Check your inbox at <strong>{confirmEmail}</strong> for a
              confirmation link, then come back to log in.
            </p>
            <Button asChild variant="outline">
              <Link to="/login" search={{ error: undefined }}>
                Go to log in
              </Link>
            </Button>
          </CardContent>
        ) : (
          <form onSubmit={onSubmit}>
            <CardContent className="flex flex-col gap-4">
              {error ? (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </p>
              ) : null}
              <div className="flex flex-col gap-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  autoComplete="username"
                  required
                  minLength={3}
                  maxLength={30}
                  pattern="[A-Za-z0-9_]{3,30}"
                  title="3–30 characters: letters, numbers, or underscores"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  disabled={pending}
                />
                <p className="text-xs text-muted-foreground">
                  3–30 characters. Letters, numbers, and underscores. Stored
                  lowercase and must be unique.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={pending}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col items-stretch gap-3 mt-5">
              <Button type="submit" disabled={pending}>
                {pending ? 'Creating account…' : 'Sign up'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link
                  to="/login"
                  search={{ error: undefined }}
                  className="text-foreground underline-offset-4 hover:underline"
                >
                  Log in
                </Link>
              </p>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  )
}
