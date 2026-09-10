'use server'

import { revalidatePath } from 'next/cache'
import { hasCapability } from '@/lib/permissions'
import { ingestMeta } from '@/lib/integrations/meta'
import { ingestMailchimp } from '@/lib/integrations/mailchimp'
import { runOnce } from '@/lib/gap-bridge'

/**
 * Pull a feed now, rather than waiting for tonight.
 *
 * Every feed here also runs on a schedule, but only once a day: the Vercel
 * plan allows daily cron jobs and no more. So the day's takings would not
 * appear until 21:30 and ad figures not until 04:00, which is a long time to
 * wait to answer "how did this morning go".
 *
 * One feed per call on purpose. A serverless function has about a minute, and
 * three ingests in series would not reliably fit — a refresh that times out
 * halfway is worse than three buttons.
 */

export type FeedName = 'sales' | 'meta' | 'mailchimp'

export async function refreshFeedAction(
  feed: FeedName,
): Promise<{ success: boolean; message: string }> {
  if (!(await hasCapability('business.reports'))) {
    return { success: false, message: 'Not allowed.' }
  }

  try {
    if (feed === 'sales') {
      const r = await runOnce()
      if (r.skippedRun === 'already_running') {
        return { success: true, message: 'A sales run is already in progress.' }
      }
      if (r.skippedRun === 'not_configured') {
        return { success: false, message: 'Gap Solutions is not configured.' }
      }
      revalidatePath('/dashboard/business')
      return {
        success: r.ok,
        message: r.ok
          ? `${r.inspected} sales inspected, ${r.sent} sent to Meta.`
          : `Failed: ${r.error}`,
      }
    }

    if (feed === 'meta') {
      // The nightly window, not a backfill. Re-reading a year every time
      // someone pressed a button would be thousands of needless requests.
      const r = await ingestMeta()
      revalidatePath('/dashboard/business')
      return {
        success: r.ok,
        message: r.ok ? `${r.rows} rows from Meta.` : `Failed: ${r.error}`,
      }
    }

    const r = await ingestMailchimp()
    revalidatePath('/dashboard/business')
    return {
      success: r.ok,
      message: r.ok ? `${r.rows} campaigns from Mailchimp.` : `Failed: ${r.error}`,
    }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Something went wrong.' }
  }
}
