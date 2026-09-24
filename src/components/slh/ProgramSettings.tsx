'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateProgramAction } from '@/lib/actions/slh.actions'

/**
 * The program year itself.
 *
 * Small, and the closing date earns the whole panel: every organisation's page
 * counts down to it, and until there was a screen for it the date sat empty
 * and those pages said "you can nominate 12 more children" with no deadline
 * attached.
 */
const field =
  'w-full rounded-2xl border border-neutral-200 px-4 py-3 text-base focus:border-neutral-400 focus:outline-none'

export function ProgramSettings({
  name: initialName,
  nominationsCloseAt: initialCloses,
  year,
}: {
  name: string
  nominationsCloseAt: string
  year: number
}) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [closes, setCloses] = useState(initialCloses)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  const dirty = name !== initialName || closes !== initialCloses

  function save() {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('name', name)
      fd.set('nominationsCloseAt', closes)
      const result = await updateProgramAction(fd)
      if (result.success) {
        setSaved(true)
        router.refresh()
      } else {
        setError(result.error ?? 'Could not save the program.')
      }
    })
  }

  return (
    <div className="mt-6 rounded-[28px] bg-neutral-50 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <b className="text-sm">This year&rsquo;s program</b>
        <span className="text-[13px] tabular-nums text-neutral-400">{year}</span>
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-[13px] font-bold" htmlFor="programName">
            Name
          </label>
          <input
            id="programName"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setSaved(false)
            }}
            className={`${field} mt-1.5`}
          />
        </div>
        <div>
          <label className="block text-[13px] font-bold" htmlFor="nominationsCloseAt">
            Nominations close
          </label>
          <input
            id="nominationsCloseAt"
            type="date"
            value={closes}
            onChange={(e) => {
              setCloses(e.target.value)
              setSaved(false)
            }}
            className={`${field} mt-1.5`}
          />
          <p className="mt-1.5 text-xs text-neutral-400">
            Every organisation counts down to this. Leave blank for no deadline.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-bold text-white hover:bg-neutral-700 disabled:opacity-40"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        {error ? (
          <span role="alert" className="text-[13px] font-semibold text-[#c8102e]">
            {error}
          </span>
        ) : saved ? (
          <span className="text-[13px] font-semibold text-green-700">Saved.</span>
        ) : null}
      </div>
    </div>
  )
}
