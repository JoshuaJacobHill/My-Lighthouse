'use client'

import * as React from 'react'
import { Loader2, User } from 'lucide-react'
import { uploadAvatarAction, removeAvatarAction } from '@/lib/actions/avatar.actions'
import { useToast } from '@/components/ui/use-toast'

/**
 * Profile photo.
 *
 * Shows the chosen file immediately from a local object URL rather than
 * waiting for the round trip, so picking a photo feels instant on a phone.
 */
export function AvatarUpload({ initial, name }: { initial: string | null; name: string }) {
  const { toast } = useToast()
  const [url, setUrl] = React.useState(initial)
  const [preview, setPreview] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)
  const input = React.useRef<HTMLInputElement>(null)

  // Revoke the object URL when it is replaced, so blobs are not left behind.
  React.useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  async function choose(file: File) {
    setPreview(URL.createObjectURL(file))
    setPending(true)
    const fd = new FormData()
    fd.set('file', file)
    const res = await uploadAvatarAction(fd)
    setPending(false)
    if (res.success && res.url) {
      setUrl(res.url)
      setPreview(null)
      toast.success('Photo updated')
    } else {
      setPreview(null)
      toast.error('Could not upload', res.error ?? 'Please try again.')
    }
  }

  const shown = preview ?? url

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={pending}
        className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-neutral-400 transition-opacity hover:opacity-90 disabled:opacity-60"
        aria-label="Change photo"
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" className="h-full w-full object-cover" />
        ) : (
          <User className="h-10 w-10" aria-hidden="true" />
        )}
        {pending && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="h-5 w-5 animate-spin text-neutral-600" aria-hidden="true" />
          </span>
        )}
      </button>

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void choose(f)
          e.target.value = ''
        }}
      />

      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={pending}
          className="text-sm font-semibold text-orange-600 hover:underline disabled:opacity-50"
        >
          {url ? 'Change photo' : 'Upload photo'}
        </button>
        {url && (
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              setPending(true)
              const res = await removeAvatarAction()
              setPending(false)
              if (res.success) setUrl(null)
            }}
            className="text-sm text-neutral-400 hover:text-neutral-700 disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-neutral-400">{name}</p>
    </div>
  )
}
