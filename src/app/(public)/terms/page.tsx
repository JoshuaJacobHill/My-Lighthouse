import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Volunteer Terms & Conditions',
  description: 'Terms and conditions for Lighthouse Care volunteers.',
}

export default function TermsPage() {
  return (
    <div className="bg-white py-16 px-4">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-10 border-b border-gray-200 pb-8">
          <p className="text-sm font-medium uppercase tracking-wide text-orange-500 mb-2">
            Lighthouse Care
          </p>
          <h1 className="text-4xl font-bold text-gray-900">Volunteer Terms &amp; Conditions</h1>
          <p className="mt-3 text-gray-500 text-sm">
            Last updated: April 2025
          </p>
        </div>

        <div className="space-y-10 text-gray-700 leading-relaxed">

          {/* 1. Introduction */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Introduction</h2>
            <p>
              Welcome to Lighthouse Care. These Terms &amp; Conditions govern your participation as a
              volunteer with Lighthouse Care (ABN 87 637 110 948), an ACNC-registered not-for-profit
              charity based in Logan, South East Queensland.
            </p>
            <p className="mt-3">
              By completing your volunteer registration and induction, you agree to the following terms.
              If you have any questions, please speak with your volunteer coordinator.
            </p>
            <p className="mt-3">
              Volunteering with Lighthouse Care is a privilege and a partnership. We are committed to
              providing a safe, supportive, and meaningful environment for all our volunteers — and we
              ask the same commitment from you.
            </p>
          </section>

          {/* 2. Volunteer Expectations */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. Volunteer Expectations</h2>
            <p>As a Lighthouse Care volunteer, we ask that you:</p>
            <ul className="mt-3 space-y-2 list-disc list-inside">
              <li>
                <strong>Be reliable.</strong> When you commit to a shift, people depend on you.
                Please turn up as rostered.
              </li>
              <li>
                <strong>Be punctual.</strong> Arrive on time for your shifts and notify your
                coordinator as early as possible if you are running late.
              </li>
              <li>
                <strong>Behave respectfully.</strong> Treat all staff, volunteers, shoppers, and
                community members with dignity and kindness at all times.
              </li>
              <li>
                Act in the best interests of Lighthouse Care and the people we serve.
              </li>
              <li>
                Follow the reasonable instructions of Lighthouse Care staff and coordinators.
              </li>
              <li>
                Represent Lighthouse Care in a positive and professional manner, both in person and
                online.
              </li>
            </ul>
          </section>

          {/* 3. Code of Conduct */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. Code of Conduct</h2>
            <p>All Lighthouse Care volunteers must:</p>
            <ul className="mt-3 space-y-2 list-disc list-inside">
              <li>
                Treat every person — regardless of background, age, gender, religion, disability, or
                any other characteristic — with dignity and respect.
              </li>
              <li>
                Refrain from any form of discrimination, harassment, bullying, or intimidation.
              </li>
              <li>
                Use appropriate language at all times. Offensive, derogatory, or abusive language is
                not acceptable.
              </li>
              <li>
                Not attend a shift under the influence of alcohol or illicit substances.
              </li>
              <li>
                Not accept gifts, tips, or other benefits from community members or shoppers in
                exchange for services.
              </li>
              <li>
                Disclose any conflicts of interest to a coordinator immediately.
              </li>
            </ul>
            <p className="mt-3">
              Breaches of the Code of Conduct may result in suspension or removal from the volunteer
              programme.
            </p>
          </section>

          {/* 4. Confidentiality */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. Confidentiality</h2>
            <p>
              During your time as a Lighthouse Care volunteer, you may have access to personal
              information about community members, shoppers, or other volunteers. You must:
            </p>
            <ul className="mt-3 space-y-2 list-disc list-inside">
              <li>
                Keep all such information strictly confidential.
              </li>
              <li>
                Not share, discuss, or disclose personal information about any community member,
                shopper, or volunteer outside of your Lighthouse Care duties.
              </li>
              <li>
                Not take photographs, recordings, or copies of any confidential information.
              </li>
            </ul>
            <p className="mt-3">
              This obligation continues after your volunteering concludes.
            </p>
          </section>

          {/* 5. Safety */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">5. Safety</h2>
            <p>The safety of our volunteers, staff, and community members is our top priority.</p>
            <ul className="mt-3 space-y-2 list-disc list-inside">
              <li>
                Follow all Workplace Health &amp; Safety (WHS) guidelines and safe work practices
                as directed by Lighthouse Care staff.
              </li>
              <li>
                Use personal protective equipment (PPE) where required.
              </li>
              <li>
                Report any safety hazard, incident, near-miss, or injury to a coordinator
                immediately — do not wait until the end of your shift.
              </li>
              <li>
                Do not perform any task that you are not trained or authorised to perform.
              </li>
              <li>
                Follow emergency procedures as directed by staff.
              </li>
            </ul>
            <p className="mt-3">
              Lighthouse Care maintains public liability insurance. However, this does not replace your
              personal responsibility to act safely.
            </p>
          </section>

          {/* 6. Sign-In/Sign-Out Requirements */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">6. Sign-In / Sign-Out Requirements</h2>
            <p>
              All volunteers are required to sign in at the start of each shift and sign out at the
              end. This is essential for:
            </p>
            <ul className="mt-3 space-y-2 list-disc list-inside">
              <li>Safety — knowing who is on site at all times</li>
              <li>Record-keeping and reporting</li>
              <li>Insurance purposes</li>
            </ul>
            <p className="mt-3">
              Failure to sign in or out may affect your volunteer record and insurance cover for that
              shift.
            </p>
          </section>

          {/* 7. Cancellation Policy */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">7. Cancellation Policy</h2>
            <p>
              We understand that life happens. If you cannot attend a rostered shift, please:
            </p>
            <ul className="mt-3 space-y-2 list-disc list-inside">
              <li>
                Notify your coordinator as soon as possible — preferably at least{' '}
                <strong>24 hours in advance</strong>.
              </li>
              <li>
                Cancel or update your shift via the volunteer portal where available.
              </li>
              <li>
                If cancelling last-minute due to illness or emergency, contact your coordinator
                directly by phone or message.
              </li>
            </ul>
            <p className="mt-3">
              Repeated unexplained absences may result in a review of your volunteer status.
            </p>
          </section>

          {/* 8. Social Media Policy */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">8. Social Media Policy</h2>
            <p>When posting about your volunteering on social media:</p>
            <ul className="mt-3 space-y-2 list-disc list-inside">
              <li>
                Do not post photographs or videos of community members, shoppers, or their families
                without their explicit written consent.
              </li>
              <li>
                Do not share personal details, stories, or circumstances of individuals we serve —
                even with their name removed.
              </li>
              <li>
                Do not post content that could embarrass or bring Lighthouse Care into disrepute.
              </li>
              <li>
                If in doubt, speak with a coordinator before posting.
              </li>
            </ul>
            <p className="mt-3">
              We love it when volunteers share their positive experiences — just please do so with
              dignity and discretion.
            </p>
          </section>

          {/* 9. Amendments */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">9. Amendments</h2>
            <p>
              Lighthouse Care may update these Terms &amp; Conditions from time to time. We will notify
              active volunteers of any material changes via email. Continued participation as a
              volunteer following notification of changes constitutes acceptance of the updated terms.
            </p>
          </section>

          {/* 10. Governing Law */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">10. Governing Law</h2>
            <p>
              These Terms &amp; Conditions are governed by the laws of the State of Queensland,
              Australia. Any disputes will be subject to the jurisdiction of the courts of Queensland.
            </p>
          </section>

          {/* Questions */}
          <div className="rounded-xl bg-orange-50 border border-orange-100 p-6 text-sm text-orange-800">
            <p className="font-semibold text-base mb-2">Questions?</p>
            <p>
              If you have any questions about these terms, please speak with your volunteer coordinator
              or contact the Lighthouse Care team.
            </p>
            <p className="mt-3 text-orange-600">
              Lighthouse Care &mdash; Logan, South East Queensland &mdash; ABN 87 637 110 948
            </p>
          </div>

          {/* Back to signup */}
          <p className="text-sm text-gray-500">
            Ready to join?{' '}
            <Link href="/volunteer/apply" className="text-orange-500 font-medium hover:underline">
              Sign up as a volunteer
            </Link>
            {' '}or review our{' '}
            <Link href="/privacy" className="text-orange-500 font-medium hover:underline">
              Privacy Policy
            </Link>
            .
          </p>

        </div>
      </div>
    </div>
  )
}
