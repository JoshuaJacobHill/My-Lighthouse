'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'

export function GenerateShiftsButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleGenerate() {
    setState('loading')
    setMessage('')
    try {
      const res = await fetch('/api/cron/generate-shifts')
      const data = await res.json()
      if (res.ok) {
        setMessage(data.message ?? `Generated ${data.created} shifts.`)
        setState('done')
      } else {
        setMessage(data.error ?? 'Something went wrong.')
        setState('error')
      }
    } catch {
      setMessage('Could not reach the server.')
      setState('error')
    }
    // Reset after 5 seconds
    setTimeout(() => {
      setState('idle')
      setMessage('')
    }, 5000)
  }

  return (
    <div className="flex items-center gap-2">
      {message && (
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            state === 'done'
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {message}
        </span>
      )}
      <button
        onClick={handleGenerate}
        disabled={state === 'loading'}
        title="Generate upcoming shifts for the next 8 weeks (Mon–Sat, excluding QLD public holidays)"
        className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <RefreshCw
          size={14}
          className={state === 'loading' ? 'animate-spin' : ''}
        />
        {state === 'loading' ? 'Generating…' : 'Generate Shifts'}
      </button>
    </div>
  )
}
