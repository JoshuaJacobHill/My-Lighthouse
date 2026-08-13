import * as React from 'react'

/**
 * A tiny, dependency-free Markdown renderer for admin-authored copy (fund
 * descriptions, Good News stories). Supports headings (#/##/###), **bold**,
 * *italic*, [links](url), and - bullet lists, with blank-line paragraphs.
 * Renders real React elements (no dangerouslySetInnerHTML), so it's XSS-safe.
 */

const HEADING_CLASS: Record<number, string> = {
  1: 'mt-6 text-2xl font-bold tracking-tight text-neutral-950',
  2: 'mt-6 text-xl font-bold tracking-tight text-neutral-950',
  3: 'mt-5 text-lg font-bold tracking-tight text-neutral-950',
  4: 'mt-4 text-base font-bold text-neutral-950',
}

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\))/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[2] !== undefined) nodes.push(<strong key={`${keyBase}-${i}`}>{m[2]}</strong>)
    else if (m[3] !== undefined) nodes.push(<em key={`${keyBase}-${i}`}>{m[3]}</em>)
    else if (m[4] !== undefined) {
      // Only allow safe link protocols — blocks javascript:/data: injection.
      const raw = (m[5] ?? '').trim()
      const safe = /^(https?:\/\/|mailto:|\/)/i.test(raw)
      nodes.push(
        safe ? (
          <a key={`${keyBase}-${i}`} href={raw} target="_blank" rel="noreferrer noopener" className="font-medium text-orange-600 underline">
            {m[4]}
          </a>
        ) : (
          <span key={`${keyBase}-${i}`}>{m[4]}</span>
        )
      )
    }
    last = m.index + m[0].length
    i++
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = source.replace(/\r\n/g, '\n').trim().split(/\n{2,}/)
  return (
    <div className={className}>
      {blocks.map((block, bi) => {
        const trimmed = block.trim()
        const h = /^(#{1,6})\s+(.*)$/.exec(trimmed)
        if (h && !trimmed.includes('\n')) {
          const level = Math.min(h[1].length, 4)
          const cls = HEADING_CLASS[level] ?? HEADING_CLASS[4]
          const content = renderInline(h[2], `h-${bi}`)
          if (level <= 1) return <h2 key={bi} className={cls}>{content}</h2>
          if (level === 2) return <h3 key={bi} className={cls}>{content}</h3>
          return <h4 key={bi} className={cls}>{content}</h4>
        }
        const lines = block.split('\n')
        if (lines.length && lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return (
            <ul key={bi} className="mt-3 list-disc space-y-1 pl-5">
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.replace(/^\s*[-*]\s+/, ''), `li-${bi}-${li}`)}</li>
              ))}
            </ul>
          )
        }
        return (
          <p key={bi} className="mt-3 leading-relaxed first:mt-0">
            {lines.map((l, li) => (
              <React.Fragment key={li}>
                {renderInline(l, `p-${bi}-${li}`)}
                {li < lines.length - 1 && <br />}
              </React.Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}
