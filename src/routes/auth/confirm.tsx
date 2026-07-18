import { createFileRoute } from '@tanstack/react-router'

import { exchangeAuthCode } from '#/lib/auth'

export const Route = createFileRoute('/auth/confirm')({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === 'string' ? search.code : undefined,
    next: typeof search.next === 'string' ? search.next : undefined,
  }),
  beforeLoad: async ({ search }) => {
    await exchangeAuthCode({
      data: {
        code: search.code,
        next: search.next,
      },
    })
  },
  component: ConfirmPage,
})

function ConfirmPage() {
  return <p className="text-sm text-muted-foreground">Confirming your email…</p>
}
