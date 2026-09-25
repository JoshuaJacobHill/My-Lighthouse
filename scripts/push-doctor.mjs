// What does the push system actually look like in production?
//
//   node scripts/push-doctor.mjs
//   node scripts/push-doctor.mjs josh@lighthousecare.org.au
//
// Read-only. Prints nothing secret — endpoints are truncated, and keys are
// reported as present or missing, never shown.
//
// Push has five links in its chain: the server's VAPID keys, a service worker,
// a browser permission, a stored subscription, and somebody else's push
// service. "It doesn't work" is consistent with all five, and this narrows it
// to the one that is actually broken.
//
// Reads the production URL from scripts/migrate/.sydney — `.env.local` points
// at a local database and would report an empty table either way.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const here = path.dirname(fileURLToPath(import.meta.url))
const email = process.argv.slice(2).find((a) => a.includes('@')) ?? null

const url = fs.readFileSync(path.join(here, 'migrate/.sydney'), 'utf8').trim()
const client = new pg.Client({ connectionString: url })

const ago = (d) => {
  if (!d) return 'never'
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
  return days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}

try {
  await client.connect()

  const total = await client.query('select count(*)::int n from "PushSubscription"')
  console.log(`\nSubscriptions stored: ${total.rows[0].n}`)

  if (total.rows[0].n === 0) {
    console.log(
      '\nNothing is registered at all. Nobody has successfully completed "Turn on"\n' +
        'on any device — so the problem is in subscribing, not in sending.',
    )
  }

  const rows = await client.query(
    `select s.id, s.label, s.endpoint, s.failures, s."lastUsedAt", s."createdAt",
            u.email, u.name
       from "PushSubscription" s
       join "User" u on u.id = s."userId"
      ${email ? 'where lower(u.email) = $1' : ''}
      order by s."createdAt" desc
      limit 40`,
    email ? [email.toLowerCase()] : [],
  )

  if (rows.rows.length > 0) {
    console.log('')
    console.table(
      rows.rows.map((r) => ({
        who: r.email,
        device: r.label ?? '—',
        // Which push service: a Google endpoint is Chrome/Android, a
        // web.push.apple.com one is Safari/iOS, Mozilla is Firefox.
        service: new URL(r.endpoint).host,
        failures: r.failures,
        lastUsed: ago(r.lastUsedAt),
        added: ago(r.createdAt),
      })),
    )

    const failing = rows.rows.filter((r) => r.failures > 0)
    if (failing.length > 0) {
      console.log(
        `\n${failing.length} of these have failed at least once. Repeated failures with\n` +
          'no successful send usually means the VAPID keys changed after the device\n' +
          'subscribed: those devices must turn notifications off and on again.',
      )
    }

    const neverUsed = rows.rows.filter((r) => !r.lastUsedAt)
    if (neverUsed.length === rows.rows.length && rows.rows.length > 0) {
      console.log(
        '\nNone of these has ever received a successful push. That points at the\n' +
          'server keys or the send path rather than at any one device.',
      )
    }
  } else if (email) {
    console.log(`\nNo devices registered for ${email}.`)
  }

  console.log(
    '\nThe three environment variables live in Vercel, not here, so this script\n' +
      'cannot check them. `npx vercel env ls production | grep VAPID` lists them;\n' +
      'NEXT_PUBLIC_VAPID_PUBLIC_KEY must be type Config, not Secret, or the browser\n' +
      'never receives it and the toggle reports "this browser can\'t do notifications".\n',
  )
} catch (err) {
  console.error('Failed:', err.message)
  process.exitCode = 1
} finally {
  await client.end()
}
