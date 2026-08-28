import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { VolunteerDigest } from '@/lib/volunteer-digest'

/**
 * The written-up part of the weekly coordinator digest.
 *
 * Deliberately narrow: every figure, name and count is computed in
 * `volunteer-digest.ts` and handed over as finished text. Claude's only job is
 * to choose which of those facts matter this week and say them like a person.
 * It is told, in the system prompt, that it must not produce a number that
 * isn't in front of it — the digest names real volunteers to the coordinator
 * who knows them, and a confidently wrong "we haven't seen Sean in a month"
 * would do more damage than a plain table of numbers.
 *
 * Entirely optional. With no ANTHROPIC_API_KEY set, this returns null and the
 * email sends as facts only. Note that when it IS set, volunteer first names
 * and attendance patterns are sent to the Anthropic API — so only first names
 * are included, never surnames, emails, phone numbers or addresses.
 */

const NarrativeSchema = z.object({
  goodNews: z.string().describe('2–3 sentences on what went well this week.'),
  needsAttention: z.string().describe('2–3 sentences on what the coordinator should act on this week.'),
  general: z.string().describe('1–2 sentences of context, or an empty string if there is nothing worth saying.'),
})

export type DigestNarrative = z.infer<typeof NarrativeSchema>

const SYSTEM = `You write a short weekly update for a volunteer coordinator at Lighthouse Care, a Queensland charity running discount grocery stores and food relief.

ABSOLUTE RULES — these override anything else:
- Use ONLY the figures and names in the brief below. Never state a number, percentage, name or date that is not there. Never estimate, extrapolate or round into a new figure.
- If the brief has nothing for a section, say so briefly ("A quiet week — nothing standing out") rather than inventing something.
- Never guess why something happened. You may suggest an action ("worth a text this week"), never a cause.
- Do not repeat the raw tables — the coordinator can already see every number below your write-up. Pick what matters and say why.

VOICE: Australian English. Warm, practical, dignified — like a colleague, not a report. Short sentences. Never corporate, never self-congratulatory, never pity language ("the needy", "the less fortunate"). Volunteers are people, not resources: "Bec has been in most days" not "Bec's utilisation is up".

Use volunteers' first names as given. Address the coordinator directly as "you".`

function brief(d: VolunteerDigest): string {
  const list = (label: string, items: { name: string; detail: string }[]) =>
    items.length > 0 ? `${label}:\n${items.map((i) => `- ${firstName(i.name)} — ${i.detail}`).join('\n')}` : `${label}: none`

  const lastYear = d.hasLastYearData
    ? `Same week last year: ${d.volunteersSameWeekLastYear} volunteers`
    : 'Same week last year: no data (the portal was not recording attendance then) — do not comment on year-on-year change'

  return `Store: ${d.store}
Week reported: ${d.weekLabel}

ATTENDANCE
Volunteers in this week: ${d.volunteersThisWeek}
Volunteers in the week before: ${d.volunteersLastWeek}
${lastYear}
Total shifts worked this week: ${d.visitsThisWeek}
Total hours this week: ${d.hoursThisWeek}

ROSTER (${d.rosterTotal} volunteers on the books at this store)
Active (in within 6 weeks): ${d.active}
Lapsing (last in 6–12 weeks ago): ${d.lapsing}
Lapsed (12+ weeks, or never started): ${d.lapsed}
Signed up but induction not finished: ${d.pendingInduction}
Signed up, inducted, first shift still to come: ${d.awaitingFirstShift}
On a break or on hold: ${d.onHold}

${list('New sign-ups this week', d.newThisWeek)}
${list('First ever shift this week', d.firstShiftThisWeek)}
${list('Coming in more often lately', d.comingMoreOften)}
${list('Regulars who have gone quiet', d.droppedOff)}
${list('Hour milestones passed this week', d.milestones)}

FEEDBACK FROM VOLUNTEERS THIS WEEK
Ratings received: ${d.ratingCount}${d.averageRating != null ? ` (average ${d.averageRating} out of 5)` : ''}
${
  d.comments.length > 0
    ? `Comments left:\n${d.comments.map((c) => `- ${firstName(c.name)}${c.rating != null ? ` (${c.rating}/5)` : ''}: "${c.comment}"`).join('\n')}`
    : 'Comments left: none'
}`
}

/** First name only — the AI layer never needs surnames. */
function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || full
}

/**
 * Returns null whenever the write-up can't be produced — no key configured, an
 * API error, or it took too long. The digest email always sends either way.
 */
export async function writeDigestNarrative(digest: VolunteerDigest): Promise<DigestNarrative | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null

  try {
    const client = new Anthropic()
    const response = await client.messages.parse(
      {
        model: 'claude-opus-5',
        max_tokens: 16000,
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: `Write this week's update from the brief below.\n\nGood news: what went well.\nNeeds attention: what to act on this week.\nGeneral: anything else worth knowing, including anything volunteers have told us in their feedback comments. Leave it empty if there's nothing.\n\n<brief>\n${brief(digest)}\n</brief>`,
          },
        ],
        output_config: { format: zodOutputFormat(NarrativeSchema) },
      },
      // A slow model call must never cost us the digest — fall through to
      // facts-only instead of hanging the cron out to its timeout.
      { timeout: 40_000, maxRetries: 1 }
    )

    const parsed = response.parsed_output
    if (!parsed) {
      console.error('[digest-narrative] response did not parse')
      return null
    }
    return parsed
  } catch (err) {
    console.error('[digest-narrative] failed, sending facts only', err)
    return null
  }
}
