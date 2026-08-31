'use client'

import * as React from 'react'
import { Upload, Loader2, X, ImageIcon, AlertCircle } from 'lucide-react'
import { uploadImageAction } from '@/lib/actions/upload.actions'

/**
 * Admin image picker — uploads to Vercel Blob and hands back a permanent public
 * URL. Pasting a URL still works, so existing images (and anything hosted on the
 * main website) keep functioning.
 */
export function ImageUpload({
  label,
  value,
  onChange,
  folder = 'uploads',
  hint,
}: {
  label: string
  value: string
  onChange: (url: string) => void
  folder?: string
  hint?: string
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [dragging, setDragging] = React.useState(false)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', folder)
      const res = await uploadImageAction(fd)
      if (res.success && res.url) onChange(res.url)
      else setError(res.error ?? 'Upload failed. Please try again.')
    } catch {
      setError(
        file.size > 5 * 1024 * 1024
          ? `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. Please keep it under 5 MB.`
          : 'Upload failed. Please try again.'
      )
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-gray-700">{label}</span>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFile(e.dataTransfer.files?.[0])
        }}
        className={
          'flex items-center gap-4 rounded-xl border-2 border-dashed p-4 transition-colors ' +
          (dragging ? 'border-orange-500 bg-orange-50' : 'border-gray-300 bg-gray-50')
        }
      >
        {/* Preview */}
        <span className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <ImageIcon className="h-6 w-6 text-gray-300" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:border-orange-400 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" /> {value ? 'Replace image' : 'Upload image'}
                </>
              )}
            </button>
            {value && !uploading && (
              <button
                type="button"
                onClick={() => {
                  onChange('')
                  setError(null)
                }}
                className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-red-600"
              >
                <X className="h-3.5 w-3.5" /> Remove
              </button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-gray-400">
            {hint ?? 'Drag an image here, or click to choose. JPG, PNG, WebP or AVIF, up to 5 MB.'}
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {error && (
        <p className="flex items-start gap-1.5 text-sm text-red-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {/* URL fallback — paste a link to an image hosted elsewhere. */}
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="…or paste an image URL"
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-600 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
      />
    </div>
  )
}
