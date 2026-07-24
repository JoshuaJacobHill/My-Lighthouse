'use client'

import * as React from 'react'
import { Link2, Check, QrCode } from 'lucide-react'

/**
 * Share tools for a public fundraiser page: copy link, social share, and a
 * QR code (handy for print/in-person at partner sites).
 */
export function FundraiserShare({
  url,
  title,
  qrDataUrl,
  onDark = false,
}: {
  url: string
  title: string
  qrDataUrl: string
  onDark?: boolean
}) {
  const [copied, setCopied] = React.useState(false)
  const [showQr, setShowQr] = React.useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable — no-op
    }
  }

  const enc = encodeURIComponent(url)
  const encText = encodeURIComponent(`Support ${title}`)
  const links = [
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc}` },
    { label: 'X', href: `https://twitter.com/intent/tweet?url=${enc}&text=${encText}` },
    { label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc}` },
  ]

  const pill = onDark
    ? 'inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/10 px-3.5 py-2 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70'
    : 'inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-orange-400 hover:text-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500'

  return (
    <div className={onDark ? 'flex flex-col items-center' : 'mt-4 border-t border-gray-100 pt-4'}>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className={onDark ? 'mr-1 text-sm font-medium text-white/80' : 'mr-1 text-sm font-medium text-gray-500'}>Share:</span>
        {links.map(({ label, href }) => (
          <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Share on ${label}`} className={pill}>
            {label}
          </a>
        ))}
        <button type="button" onClick={() => setShowQr((v) => !v)} aria-pressed={showQr} className={pill}>
          <QrCode className="h-4 w-4" /> QR
        </button>
        <button type="button" onClick={copy} className={pill}>
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Link2 className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>

      {showQr && (
        <div className="mt-4 flex items-center gap-4 rounded-xl bg-gray-50 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="QR code linking to this fundraiser" width={112} height={112} className="rounded-lg bg-white p-1" />
          <p className="text-sm text-gray-500">Scan to open this fundraiser — great for flyers, site signage or events.</p>
        </div>
      )}
    </div>
  )
}
