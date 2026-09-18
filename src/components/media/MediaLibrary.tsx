'use client'

import * as React from 'react'
import { ImageUp, Loader2, Trash2, Check } from 'lucide-react'
import { uploadImageAction } from '@/lib/actions/upload.actions'
import { deleteMediaAction } from '@/lib/actions/marketing.actions'
import type { MediaItem } from '@/lib/media-library'

/**
 * Every image the organisation publishes, in one place.
 *
 * Uploads go through the same action events, stories and fundraisers use — it
 * checks the file's magic bytes rather than the browser's content type, and
 * refuses SVG. Nothing about marketing needs a weaker check than an event page.
 *
 * Filenames carry more weight here than they look like they should: the
 * assistant can read them but cannot see the pictures, so the name is the only
 * thing it has to go on when suggesting one for an ad.
 */
export function MediaLibrary({
  initial,
  folder = 'media',
}: {
  initial: MediaItem[]
  /** Where new uploads land. Existing images keep whichever folder they were in. */
  folder?: string
}) {
  const [items, setItems] = React.useState(initial)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState('')
  const [done, setDone] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)

  async function upload(files: File[]) {
    setError('')
    setDone(0)
    setPending(true)
    try {
      for (const file of files) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('folder', folder)
        const res = await uploadImageAction(fd)
        if (!res.success || !res.url) {
          setError(`${file.name}: ${res.error ?? 'could not upload'}`)
          break
        }
        const url = res.url
        setItems((list) => [
          {
            url,
            name: file.name,
            folder,
            label: 'General',
            size: file.size,
            uploadedAt: new Date().toISOString(),
          },
          ...list,
        ])
        setDone((n) => n + 1)
      }
    } catch (e) {
      // A server action that rejects is otherwise an unhandled rejection: the
      // spinner stops and the page says nothing at all.
      setError((e as Error).message || 'The upload failed part way through.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ImageUp className="h-4 w-4" aria-hidden="true" />
          )}
          Add images
        </button>

        {pending && done > 0 && (
          <span className="inline-flex items-center gap-1.5 text-sm text-neutral-500">
            <Check className="h-4 w-4 text-lime-600" aria-hidden="true" />
            {done} uploaded
          </span>
        )}

        <span className="text-xs text-neutral-400">
          JPG, PNG, WebP, AVIF or GIF, up to 5MB. Not SVG.
        </span>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          multiple
          className="hidden"
          onChange={(e) => {
            // Copied out BEFORE the reset: `e.target.files` is a live FileList,
            // and clearing `value` empties that same object — read it
            // afterwards and it is empty, so the upload silently never starts.
            const files = Array.from(e.target.files ?? [])
            e.target.value = ''
            if (files.length) void upload(files)
          }}
        />
      </div>

      {error && (
        <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {items.length === 0 ? (
        <p className="mt-6 rounded-[28px] bg-neutral-50 p-6 text-sm leading-relaxed text-neutral-500">
          Nothing here yet. Until there is an image, the assistant can only draft text-only Facebook
          posts — Instagram and paid ads both need a picture.
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {items.map((m) => (
            <li key={m.url} className="overflow-hidden rounded-[20px] border border-neutral-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt="" className="h-32 w-full bg-neutral-50 object-cover" />
              <div className="flex items-start gap-2 p-3">
                <span className="min-w-0 flex-1">
                  <span className="block break-all text-xs font-medium text-neutral-700">
                    {m.name}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                      {m.label}
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      {Math.round(m.size / 1024)} KB
                    </span>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setItems((list) => list.filter((x) => x.url !== m.url))
                    void deleteMediaAction(m.url)
                  }}
                  className="shrink-0 rounded-full p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Remove ${m.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
