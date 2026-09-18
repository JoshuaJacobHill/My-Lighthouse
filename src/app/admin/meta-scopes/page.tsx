import Link from 'next/link'
import { ChevronLeft, Check, X, RefreshCw } from 'lucide-react'
import { requireCapability } from '@/lib/permissions'
import { checkMetaScopes } from '@/lib/integrations/meta-scopes'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Meta permissions' }

/**
 * What the live Meta token can do, right now.
 *
 * Exists because three different problems look the same from outside — the
 * scope was not ticked, the token was never redeployed, or the system user has
 * the permission but no access to the asset it applies to. Each row here
 * separates one of them.
 */
export default async function MetaScopesPage() {
  await requireCapability('business.reports')
  const report = await checkMetaScopes()

  const missingWrite = report.write.filter((w) => !w.granted)
  const missingRead = report.read.filter((r) => !r.granted)
  const brokenAssets = report.assets.filter((a) => !a.ok)

  const Row = ({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) => (
    <li className="flex items-start gap-3 py-2.5">
      <span
        className={
          'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ' +
          (ok ? 'bg-lime-100 text-lime-700' : 'bg-red-100 text-red-600')
        }
      >
        {ok ? (
          <Check className="h-3 w-3" aria-hidden="true" />
        ) : (
          <X className="h-3 w-3" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0">
        <code className="text-sm font-medium text-neutral-900">{label}</code>
        {detail && <span className="block break-words text-xs text-neutral-500">{detail}</span>}
      </span>
    </li>
  )

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
      <Link
        href="/admin/marketing"
        className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Marketing approvals
      </Link>

      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Meta permissions</h1>
      <p className="mt-2 leading-relaxed text-neutral-500">
        What the token in production can actually do. Refresh this page after changing it — and
        remember a new token in Vercel does nothing until the next deploy.
      </p>

      {report.error && (
        <p className="mt-6 rounded-[28px] bg-red-50 p-5 text-sm leading-relaxed text-red-700">
          {report.error}
        </p>
      )}

      {report.configured && !report.error && (
        <>
          <div className="mt-6 rounded-[28px] bg-neutral-50 p-5">
            <p className="font-bold text-neutral-900">
              {missingWrite.length === 0 && brokenAssets.length === 0
                ? 'Ready — the assistant can post and change ads once approved.'
                : missingWrite.length === WRITE_COUNT
                  ? 'Read-only. Analysis and drafting work; approving will fail.'
                  : 'Partly there.'}
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              Token is {report.valid ? 'valid' : 'NOT valid'} and{' '}
              {report.expiresAt
                ? `expires ${new Intl.DateTimeFormat('en-AU', {
                    timeZone: 'Australia/Brisbane',
                    dateStyle: 'medium',
                  }).format(new Date(report.expiresAt))} — a system user token should be set to never expire`
                : 'never expires, which is right for a system user'}
              .
            </p>
          </div>

          <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-neutral-400">
            Needed to post and change ads
          </h2>
          <ul className="mt-2 divide-y divide-neutral-100">
            {report.write.map((w) => (
              <Row key={w.scope} ok={w.granted} label={w.scope} />
            ))}
          </ul>

          <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-neutral-400">
            Needed by the nightly reports
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            If one of these went missing when the token was regenerated, the figures stop updating.
            Anything else on the token is harmless — <code>business_management</code> in particular
            is commonly granted and nothing here uses it.
          </p>
          <ul className="mt-2 divide-y divide-neutral-100">
            {report.read.map((r) => (
              <Row key={r.scope} ok={r.granted} label={r.scope} />
            ))}
          </ul>

          <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-neutral-400">
            Can it reach the accounts
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            A permission the system user holds over an asset it was never given is the failure that
            looks most like a scope problem and is not.
          </p>
          <ul className="mt-2 divide-y divide-neutral-100">
            {report.assets.map((a) => (
              <Row key={a.id} ok={a.ok} label={a.name} detail={`${a.id} — ${a.detail}`} />
            ))}
          </ul>

          {(missingWrite.length > 0 || missingRead.length > 0) && (
            <div className="mt-8 rounded-[28px] border border-neutral-200 p-5 text-sm leading-relaxed text-neutral-600">
              <p className="font-bold text-neutral-900">To add what is missing</p>
              <p className="mt-2">
                business.facebook.com/settings → Users → System users → your system user →{' '}
                <b>Generate new token</b>. Tick the missing ones <b>on top of</b> everything already
                granted — the screen starts empty, and a token carrying only the new scopes breaks
                the reports. Then update <code>META_ACCESS_TOKEN</code> in Vercel and redeploy.
              </p>
            </div>
          )}

          <details className="mt-6">
            <summary className="cursor-pointer text-sm font-semibold text-neutral-500">
              Every scope on the token ({report.scopes.length})
            </summary>
            <p className="mt-2 break-words font-mono text-xs leading-relaxed text-neutral-500">
              {report.scopes.join(', ') || 'none reported'}
            </p>
          </details>
        </>
      )}

      <p className="mt-8 flex items-center gap-2 text-xs text-neutral-400">
        <RefreshCw className="h-3 w-3" aria-hidden="true" />
        Checked live against Meta each time this page loads.
      </p>
    </div>
  )
}

const WRITE_COUNT = 3
