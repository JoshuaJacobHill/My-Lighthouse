import { getCurrentChallenge } from '../../src/lib/fitness-data'
async function main() {
  const c = await getCurrentChallenge()
  console.log('picked right now:', c ? `${c.slug} (goal ${c.goal.toLocaleString('en-AU')})` : 'none')
  console.log('\nTomorrow the test run has ended, so the fallback picks the next one due to start.')
}
main().then(() => process.exit(0))
