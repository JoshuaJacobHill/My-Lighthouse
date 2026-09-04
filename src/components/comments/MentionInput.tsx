'use client'

import * as React from 'react'

export type Person = { id: string; name: string }

/**
 * A comment box with @ mentions.
 *
 * Two things are happening at once. The textarea is real and holds the text,
 * but its own glyphs are transparent; a mirror div sits directly behind it
 * rendering the same string with confirmed mentions coloured. That is how the
 * highlight can land exactly under the words without giving up a plain
 * textarea's editing, selection and mobile keyboard behaviour. The two must
 * keep identical typography and padding or the highlight drifts, which is why
 * both share TYPE below.
 *
 * A mention is only real once it has been picked from the list: the id is what
 * gets stored, never the typed name. Typing "@Bec Harmon" by hand looks like
 * text and notifies nobody, which is deliberate — a name that merely resembles
 * someone should not quietly become a notification.
 */

/** Shared by the textarea and its mirror. Any change must apply to both. */
const TYPE =
  'w-full rounded-xl border px-3 py-2 text-sm leading-[1.45] whitespace-pre-wrap break-words'

/** How far back from the caret we will look for an @ to complete. */
const MAX_QUERY = 32

type Match = { start: number; query: string }

/** The @token the caret currently sits in, if any. */
function activeMention(text: string, caret: number): Match | null {
  const from = Math.max(0, caret - MAX_QUERY)
  const slice = text.slice(from, caret)
  const at = slice.lastIndexOf('@')
  if (at === -1) return null

  const start = from + at
  // Must start a word, so an email address never opens the menu.
  const before = start > 0 ? text[start - 1] : ' '
  if (!/[\s(]/.test(before)) return null

  const query = text.slice(start + 1, caret)
  // Names contain spaces, so spaces are allowed — but a newline ends it.
  if (query.includes('\n')) return null
  return { start, query }
}

export function MentionInput({
  value,
  onChange,
  people,
  tagged,
  onTag,
  rows = 3,
  placeholder,
  onLoadPeople,
}: {
  value: string
  onChange: (next: string) => void
  /** Null until loaded, so the menu can say "Loading…" rather than "nobody". */
  people: Person[] | null
  tagged: Person[]
  onTag: (person: Person) => void
  rows?: number
  placeholder?: string
  /** Called the first time the menu opens, to fetch the list lazily. */
  onLoadPeople: () => void
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null)
  const mirror = React.useRef<HTMLDivElement>(null)
  const [match, setMatch] = React.useState<Match | null>(null)
  const [highlighted, setHighlighted] = React.useState(0)

  const candidates = React.useMemo(() => {
    if (!match || !people) return []
    const q = match.query.trim().toLowerCase()
    const pool = q ? people.filter((p) => p.name.toLowerCase().includes(q)) : people
    return pool.slice(0, 6)
  }, [match, people])

  const open = match !== null && (people === null || candidates.length > 0)

  function sync(text: string, caret: number) {
    const found = activeMention(text, caret)
    setMatch(found)
    setHighlighted(0)
    if (found && people === null) onLoadPeople()
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value)
    sync(e.target.value, e.target.selectionStart ?? e.target.value.length)
  }

  function choose(person: Person) {
    if (!match) return
    const el = ref.current
    const caret = el?.selectionStart ?? value.length
    const next = `${value.slice(0, match.start)}@${person.name} ${value.slice(caret)}`
    onChange(next)
    onTag(person)
    setMatch(null)
    // Put the caret after the inserted name rather than at the end of the box.
    const at = match.start + person.name.length + 2
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(at, at)
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!open || candidates.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((i) => (i + 1) % candidates.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((i) => (i - 1 + candidates.length) % candidates.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      choose(candidates[highlighted])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setMatch(null)
    }
  }

  // Confirmed mentions, longest first so "Sarah Bennett" wins over "Sarah".
  const names = React.useMemo(
    () => [...tagged].map((t) => t.name).sort((a, b) => b.length - a.length),
    [tagged],
  )

  const parts = React.useMemo(() => {
    if (names.length === 0) return [value]
    const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    return value.split(new RegExp(`(@(?:${escaped.join('|')}))`, 'g'))
  }, [value, names])

  return (
    <div className="relative">
      <div className="relative">
        {/* Behind the textarea, showing the same text with mentions coloured. */}
        <div
          ref={mirror}
          aria-hidden="true"
          className={`${TYPE} pointer-events-none absolute inset-0 overflow-hidden border-transparent text-neutral-900`}
        >
          {parts.map((part, i) =>
            part.startsWith('@') && names.some((n) => part === `@${n}`) ? (
              <span key={i} className="rounded bg-orange-100 font-semibold text-orange-700">
                {part}
              </span>
            ) : (
              <React.Fragment key={i}>{part}</React.Fragment>
            ),
          )}
          {/* Keeps the last line's height when the text ends in a newline. */}
          {value.endsWith('\n') ? '​' : null}
        </div>

        <textarea
          ref={ref}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onClick={(e) =>
            sync(value, (e.target as HTMLTextAreaElement).selectionStart ?? value.length)
          }
          onScroll={() => {
            if (mirror.current && ref.current) mirror.current.scrollTop = ref.current.scrollTop
          }}
          rows={rows}
          placeholder={placeholder}
          // Glyphs transparent so the mirror shows through; the caret and the
          // selection highlight are still the textarea's own.
          className={`${TYPE} relative bg-transparent text-transparent caret-neutral-900 border-neutral-300 placeholder:text-neutral-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500`}
        />
      </div>

      {open && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 w-full max-w-xs overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg"
        >
          {people === null ? (
            <li className="px-3 py-2 text-sm text-neutral-400">Loading…</li>
          ) : (
            candidates.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === highlighted}
                  onMouseEnter={() => setHighlighted(i)}
                  onClick={() => choose(p)}
                  className={
                    'w-full px-3 py-2 text-left text-sm ' +
                    (i === highlighted ? 'bg-orange-50 text-orange-700' : 'text-neutral-700')
                  }
                >
                  {p.name}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
