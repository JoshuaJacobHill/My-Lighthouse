'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'

/**
 * The filter bar above both admin lists.
 *
 * Filters live in the URL rather than in component state, so a view somebody
 * has narrowed down can be sent to a colleague, bookmarked, or survive a
 * refresh — which is most of what makes a list useful to work from rather than
 * just look at.
 */
export type FilterMenu = {
  /** The query parameter this menu drives. */
  name: string
  label: string
  options: { value: string; label: string }[]
}

export function ListFilters({
  menus,
  search,
}: {
  menus: FilterMenu[]
  /** Placeholder for a free-text box, or omitted for no box at all. */
  search?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const active = menus.filter((m) => params.get(m.name)).length + (params.get('q') ? 1 : 0)

  function set(name: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(name, value)
    else next.delete(name)
    router.replace(next.toString() ? `${pathname}?${next}` : pathname)
  }

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      {menus.map((menu) => (
        <label key={menu.name} className="inline-flex items-center gap-1.5">
          <span className="sr-only">{menu.label}</span>
          <select
            value={params.get(menu.name) ?? ''}
            onChange={(e) => set(menu.name, e.target.value)}
            className={`rounded-full border px-3.5 py-2 text-[13px] font-semibold focus:outline-none ${
              params.get(menu.name)
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-neutral-300 hover:bg-neutral-50'
            }`}
          >
            <option value="">{menu.label}</option>
            {menu.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}

      {search && (
        <input
          defaultValue={params.get('q') ?? ''}
          onChange={(e) => set('q', e.target.value)}
          placeholder={search}
          aria-label={search}
          className="min-w-[10rem] flex-1 rounded-full border border-neutral-300 px-4 py-2 text-[13px] focus:border-neutral-500 focus:outline-none"
        />
      )}

      {active > 0 && (
        <button
          type="button"
          onClick={() => router.replace(pathname)}
          className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-[13px] font-semibold text-neutral-500 hover:text-neutral-900"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" /> Clear
        </button>
      )}
    </div>
  )
}
