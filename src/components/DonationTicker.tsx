'use client'

import * as React from 'react'

export interface TickerDonation {
  id: string
  donorName: string | null
  amount: number
  message: string | null
}

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

/**
 * Auto-scrolling "ticker" of recent donations (pauses on hover; falls back to a
 * manually scrollable row when the viewer prefers reduced motion).
 */
export function DonationTicker({ donations }: { donations: TickerDonation[] }) {
  if (donations.length === 0) return null
  // Duplicate the list so the loop is seamless (translateX(-50%) lands on a copy).
  const items = [...donations, ...donations]

  return (
    <div className="tk-wrap group relative overflow-hidden">
      <style>{`
        .tk-track { animation: tk-scroll 45s linear infinite; }
        .tk-wrap:hover .tk-track { animation-play-state: paused; }
        @keyframes tk-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce) {
          .tk-track { animation: none; }
          .tk-wrap { overflow-x: auto; }
        }
      `}</style>
      {/* Soft fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-gray-50 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-gray-50 to-transparent" />

      <div className="tk-track flex w-max gap-4 py-2">
        {items.map((d, i) => (
          <div
            key={`${d.id}-${i}`}
            className="flex w-60 shrink-0 flex-col items-center rounded-2xl border border-gray-100 bg-white p-5 text-center shadow-sm"
          >
            <span className="text-2xl" aria-hidden>😍</span>
            <p className="mt-2 font-semibold text-gray-900">{d.donorName || 'Anonymous'}</p>
            <p className="mt-0.5 font-bold text-orange-500">{aud.format(d.amount)}</p>
            {d.message && <p className="mt-1.5 line-clamp-3 text-sm text-gray-500">{d.message}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
