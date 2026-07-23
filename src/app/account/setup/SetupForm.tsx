'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { completeDonorAccountAction } from '@/lib/actions/donor-account.actions'

export function SetupForm({
  token,
  suggestedName,
}: {
  token: string
  suggestedName: string
}) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)
    const password = (fd.get('password') as string) ?? ''
    const confirm = (fd.get('confirm') as string) ?? ''
    if (password !== confirm) {
      setError('Those passwords don’t match.')
      return
    }

    setLoading(true)
    const result = await completeDonorAccountAction({
      token,
      name: (fd.get('name') as string) ?? '',
      password,
    })

    if (result.success && result.redirectTo) {
      router.push(result.redirectTo)
      router.refresh()
      return
    }
    setLoading(false)
    setError(result.error ?? 'Something went wrong. Please try again.')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      <Input label="Your name" name="name" defaultValue={suggestedName} autoComplete="name" />
      <Input
        label="Choose a password"
        name="password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        hint="At least 8 characters."
      />
      <Input
        label="Confirm password"
        name="confirm"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
      />
      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? 'Setting up…' : 'Create my account'}
      </Button>
    </form>
  )
}
