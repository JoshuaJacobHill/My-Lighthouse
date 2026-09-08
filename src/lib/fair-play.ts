/**
 * Wording for the fair-play messages.
 *
 * Its own module because a 'use server' file may only export async functions —
 * a const object in there fails the build with "can only export async
 * functions, found object", which is exactly what happened.
 *
 * The wording is Josh's, and stands on a confirmed finding rather than a
 * threshold: Ty, Dannii and Harrison were established to have been adding
 * steps artificially. Only "useres" has been corrected to "users'".
 */

/** Shown to a named person an admin has sent it to. */
export const FAIR_PLAY_NOTICE = {
  heading: 'Cheating detected',
  paragraphs: [
    'Our system has detected activity that may indicate steps are being added unfairly.',
    'We’ve detected a high possibility that a device or other method may be being used to artificially increase your step count.',
    'Please make sure all steps are genuine and earned through walking so the challenge remains fair and accurate for everyone.',
    'Resume fair counting to avoid your steps being removed.',
  ],
} as const

/** Shown to everyone who has not been sent the personal notice. */
export const FAIR_PLAY_REMINDER = {
  heading: 'Cheating Reminder',
  paragraphs: [
    'Our system has detected some users’ steps are being added unfairly.',
    'Please make sure all steps are genuine and earned through walking so the challenge remains fair and accurate for everyone.',
  ],
} as const

/**
 * The reminder comes down at the end of 10 September, Brisbane.
 *
 * A fixed date rather than a dismiss button: it is meant to be seen by
 * everyone for a few days, and a banner people can wave away on day one does
 * not achieve that. It disappears on its own so nobody has to remember.
 */
export const FAIR_PLAY_REMINDER_UNTIL = new Date('2026-09-11T00:00:00+10:00')

export function reminderIsLive(now: Date = new Date()): boolean {
  return now < FAIR_PLAY_REMINDER_UNTIL
}
