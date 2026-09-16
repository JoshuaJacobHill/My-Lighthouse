'use client'

import * as React from 'react'
import { ImageUp, Loader2, X } from 'lucide-react'
import { uploadOrgLogoAction } from '@/lib/actions/organisation.actions'

/**
 * Pick a logo from your machine.
 *
 * Shared by the application form and the admin editor. Uploads immediately
 * rather than on submit, so the person sees their logo appear and knows it
 * worked — a file that only uploads when the form is sent gives no sign of
 * having been accepted, and is the shape of thing people submit twice.
 *
 * With an `organisationId` the upload is saved straight onto that company.
 * Without one — an application, where no company exists yet — it just returns
 * a URL for the form to carry.
 */
export function LogoUpload({
  organisationId,
  value,
  onChange,
}: {
  organisationId?: string
  value: string
  onChange: (url: string) => void
}) {
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    setError('')
    setPending(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (organisationId) fd.append('organisationId', organisationId)
      const res = await uploadOrgLogoAction(fd)
      if (!res.success || !res.id) setError(res.error ?? 'Could not upload that.')
      else onChange(res.id)
    } finally {
      setPending(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        {value ? (
          <span className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3">
            {/* A logo the partner supplied, on blob storage — no point routing
                a handful of these through the image optimiser. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="h-12 w-auto max-w-[140px] object-contain" />
            <button
              type="button"
              onClick={() => onChange('')}
              className="rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
              aria-label="Remove the logo"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </span>
        ) : null}

        <button
          type="button"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-800 transition-colors hover:bg-neutral-50 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ImageUp className="h-4 w-4" aria-hidden="true" />
          )}
          {value ? 'Choose a different file' : 'Upload a logo'}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            // Cleared so choosing the same file twice still fires a change.
            e.target.value = ''
            if (file) void upload(file)
          }}
        />
      </div>

      <p className="mt-2 text-xs text-neutral-500">PNG, JPEG, WebP or SVG, up to 2MB.</p>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  )
}
