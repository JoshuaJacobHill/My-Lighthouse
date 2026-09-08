/**
 * Wording for the fair-play notice.
 *
 * Its own module because a 'use server' file may only export async functions —
 * a const object in there fails the build with "can only export async
 * functions, found object", which is exactly what happened.
 */

/**
 * The wording of the personal notice.
 *
 * Kept here rather than in the component so there is one copy of it, and so
 * what was sent is not a matter of memory.
 *
 * Two lines of the original draft said the system had detected activity
 * suggesting cheating. It cannot: shaking a wrist produces genuine steps in
 * Apple Health, so by the time a figure reaches us it is indistinguishable
 * from walking. All a threshold knows is that a number is large. Since an
 * admin now chooses who receives this, the message says so plainly instead —
 * an accusation that overstates its own evidence is easy to dismiss, and
 * unfair if it lands on the wrong person.
 */
export const FAIR_PLAY_NOTICE = {
  heading: 'A note about your step count',
  paragraphs: [
    'All steps in this challenge need to be earned by walking.',
    'We want to be sure every step counted is genuine — please don’t shake your wrist, move your device repeatedly, or use any other method to increase your count.',
    'Keeping it honest keeps the challenge fair and accurate for everyone. If you think this has reached you by mistake, have a word with Josh and we’ll sort it out.',
  ],
} as const
