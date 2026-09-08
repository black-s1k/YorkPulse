import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="mb-8">
        <Link href="/" className="text-sm text-purple-700 hover:underline">← Back to YorkPulse</Link>
      </div>

      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-gray-400 text-sm mb-10">Last updated: March 2026</p>

      <div className="space-y-8 text-gray-700 leading-relaxed">

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">1. Acceptance of Terms</h2>
          <p>By accessing or using YorkPulse, you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform. YorkPulse is exclusively available to verified York University students, faculty, and staff.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">2. Eligibility</h2>
          <p>You must hold a valid <span className="text-white font-medium">@yorku.ca</span> or <span className="text-white font-medium">@my.yorku.ca</span> email address to register. By signing up, you confirm that you are a current member of the York University community. Accounts found to be fraudulent will be permanently banned.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">3. User Conduct</h2>
          <p className="mb-3">You agree not to use YorkPulse to:</p>
          <ul className="list-disc list-inside space-y-2 text-gray-500">
            <li>Post false, misleading, or fraudulent content</li>
            <li>Harass, threaten, or abuse other users</li>
            <li>Share personal information of others without consent</li>
            <li>Conduct illegal transactions or activities</li>
            <li>Attempt to circumvent platform security or anonymity features</li>
            <li>Spam, advertise, or solicit users outside of designated modules</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">4. Marketplace</h2>
          <p>YorkPulse is not a party to any transaction between buyers and sellers. We do not guarantee the quality, safety, or legality of items listed. All transactions are conducted at your own risk. Users are encouraged to meet in safe, public locations on campus.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">5. The Vault (Anonymous Forum)</h2>
          <p>While posts in The Vault may appear anonymous to other users, YorkPulse retains the ability to identify users in cases of serious misconduct, threats of harm, or legal requirements. Anonymity is a feature, not a shield for harmful behaviour.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">6. Content Ownership</h2>
          <p>You retain ownership of content you post. By posting, you grant YorkPulse a non-exclusive, royalty-free licence to display and distribute that content within the platform. You may delete your content at any time.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">7. Termination</h2>
          <p>We reserve the right to suspend or permanently ban accounts that violate these terms, without prior notice. You may delete your account at any time from your profile settings.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">8. Disclaimer</h2>
          <p>YorkPulse is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the platform, including but not limited to marketplace transactions, side quest meetups, or content posted by other users.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">9. Changes to Terms</h2>
          <p>We may update these terms from time to time. Continued use of YorkPulse after changes are posted constitutes acceptance of the new terms.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">10. Contact</h2>
          <p>For questions about these terms, contact us at <a href="mailto:yorkpulse.app@gmail.com" className="text-purple-700 hover:underline">yorkpulse.app@gmail.com</a>.</p>
        </section>

      </div>

      <div className="mt-12 pt-8 border-t border-gray-200 text-sm text-gray-400">
        <Link href="/privacy" className="text-purple-700 hover:underline">Privacy Policy</Link>
      </div>
    </div>
  );
}
