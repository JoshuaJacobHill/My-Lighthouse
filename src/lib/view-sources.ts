/**
 * Where a "view" can come from.
 *
 * Its own module, free of any server import, because the chart is a client
 * component and needs these as values rather than types. Importing them from
 * `business-reports.ts` pulled Prisma and `pg` into the browser bundle and
 * failed the build with "Can't resolve 'dns'" — the client/server boundary
 * error that `tsc` cannot see and only `npm run build` catches.
 */

export const VIEW_SOURCES = ['ADS', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'MAILCHIMP'] as const

export type ViewSource = (typeof VIEW_SOURCES)[number]

export const SOURCE_LABEL: Record<ViewSource, string> = {
  ADS: 'Paid ads',
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
  /**
   * Opens, never the size of the list.
   *
   * `SocialPost.views` holds `emails_sent` for a campaign, which is how many
   * people it was addressed to. A campaign sent to forty thousand people and
   * opened by two thousand reached two thousand.
   */
  MAILCHIMP: 'Email opens',
}
