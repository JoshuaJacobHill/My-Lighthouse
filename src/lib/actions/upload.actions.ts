'use server'

import { put } from '@vercel/blob'
import { getSession } from '@/lib/auth'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

interface UploadResult {
  success: boolean
  url?: string
  error?: string
}

/**
 * Detect the real image type from its magic bytes. The browser-supplied MIME
 * type and the filename extension are both caller-controlled, so neither is
 * trusted here. SVG is deliberately not accepted — it's a script-capable
 * format, and every image we host is a photo or logo.
 */
function sniffImageType(b: Uint8Array): string | null {
  if (b.length < 12) return null
  const ascii = (at: number, s: string) =>
    String.fromCharCode(...b.slice(at, at + s.length)) === s

  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x89 && ascii(1, 'PNG')) return 'image/png'
  if (ascii(0, 'GIF8')) return 'image/gif'
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'image/webp'
  if (ascii(4, 'ftyp')) {
    const brand = String.fromCharCode(...b.slice(8, 12))
    if (/^(avif|avis|heic|heix|mif1|msf1)/.test(brand)) return 'image/avif'
  }
  return null
}

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

/**
 * Upload an image to Vercel Blob and return its permanent public URL.
 *
 * Admin-only. Images are public by design (they appear on public event,
 * fundraiser and story pages) and get a random suffix, so a filename can never
 * be guessed or silently overwrite an existing upload.
 */
export async function uploadImageAction(formData: FormData): Promise<UploadResult> {
  const session = await getSession()
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
    return { success: false, error: 'You need to be signed in as an admin to upload images.' }
  }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: 'Please choose an image to upload.' }
  }
  if (file.size > MAX_BYTES) {
    return {
      success: false,
      error: `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB — please keep it under 5 MB.`,
    }
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const type = sniffImageType(bytes)
    if (!type) {
      return {
        success: false,
        error: 'That doesn’t look like a supported image. Please use a JPG, PNG, WebP, AVIF or GIF.',
      }
    }

    // Keep a readable name for the dashboard, but never trust the caller's path.
    const folder = String(formData.get('folder') ?? 'uploads')
      .replace(/[^a-z0-9-]/gi, '')
      .toLowerCase() || 'uploads'
    const base =
      file.name
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60)
        .toLowerCase() || 'image'

    const blob = await put(`${folder}/${base}.${EXT[type]}`, file, {
      access: 'public',
      addRandomSuffix: true,
      contentType: type,
    })

    return { success: true, url: blob.url }
  } catch (err) {
    console.error('uploadImageAction failed', err)
    return { success: false, error: 'Upload failed. Please try again.' }
  }
}
