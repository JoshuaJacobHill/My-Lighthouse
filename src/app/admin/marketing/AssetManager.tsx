'use client'

import * as React from 'react'
import { ImageUp, Loader2, Trash2 } from 'lucide-react'
import {
  uploadMarketingAssetAction,
  deleteMarketingAssetAction,
} from '@/lib/actions/marketing.actions'

/**
 * The image folder the assistant draws on.
 *
 * Filenames matter more than usual here: they are the only thing Claude can
 * see, so "hamper-pack-loganholme.jpg" gets suggested sensibly and "IMG_4471.jpg"
 * does not. Said on the page rather than left for someone to work out.
 */
export function AssetManager({
  initial,
}: {
  initial: { url: string; name: string; size: number }[]
}) {
  const [assets, setAssets] = React.useState(initial)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  async function upload(files: FileList) {
    setError('')
    setPending(true)
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await uploadMarketingAssetAction(fd)
        if (!res.success || !res.id) {
          setError(`${file.name}: ${res.error ?? 'could not upload'}`)
          break
        }
        setAssets((a) => [{ url: res.id!, name: file.name, size: file.size }, ...a])
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">Images the assistant can use</h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-neutral-500">
            Name them well — the assistant can read the filenames but cannot see the pictures, so
            &ldquo;hamper-pack-loganholme.jpg&rdquo; gets suggested sensibly and
            &ldquo;IMG_4471.jpg&rdquo; does not. You see the actual image before anything goes out.
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-neutral-50 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ImageUp className="h-4 w-4" aria-hidden="true" />
          )}
          Add images
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = e.target.files
            e.target.value = ''
            if (files?.length) void upload(files)
          }}
        />
      </div>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      {assets.length === 0 ? (
        <p className="mt-5 rounded-[28px] bg-neutral-50 p-6 text-sm leading-relaxed text-neutral-500">
          Nothing here yet. Until there is, the assistant can only draft text-only Facebook posts —
          Instagram will not take a post without an image.
        </p>
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-3">
          {assets.map((a) => (
            <li key={a.url} className="overflow-hidden rounded-[20px] border border-neutral-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt="" className="h-32 w-full object-cover" />
              <div className="flex items-start gap-2 p-3">
                <span className="min-w-0 flex-1">
                  <span className="block break-all text-xs font-medium text-neutral-700">
                    {a.name}
                  </span>
                  <span className="block text-[11px] text-neutral-400">
                    {Math.round(a.size / 1024)} KB
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAssets((list) => list.filter((x) => x.url !== a.url))
                    void deleteMarketingAssetAction(a.url)
                  }}
                  className="shrink-0 rounded-full p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Remove ${a.name}`}
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
