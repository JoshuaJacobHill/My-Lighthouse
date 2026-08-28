import { renderTemplate } from '../../src/lib/email-templates'
async function main() {
  const r = await renderTemplate('DONOR_ACCOUNT_SETUP', {
    first_name: 'Nathan', last_name: 'Hill',
    set_password_link: 'https://my.lighthousecare.org.au/set-password?token=EXAMPLE',
    portal_link: 'https://my.lighthousecare.org.au',
  })
  console.log('SUBJECT:', r.subject)
  console.log('\n' + r.text)
}
main().then(() => process.exit(0))
