import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="mb-8">
        <Link href="/" className="text-sm text-purple-700 hover:underline">← Back to YorkPulse</Link>
      </div>

      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-gray-400 text-sm mb-10">Last updated: March 2026</p>

      <div className="space-y-8 text-gray-700 leading-relaxed">

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">1. Information We Collect</h2>
          <p className="mb-3">When you use YorkPulse, we collect:</p>
          <ul className="list-disc list-inside space-y-2 text-gray-500">
            <li><span className="text-gray-700">Account information</span> — your York email address and display name</li>
            <li><span className="text-gray-700">Profile information</span> — program, bio, and avatar you choose to provide</li>
            <li><span className="text-gray-700">Content you post</span> — marketplace listings, Vault posts, Side Quest requests, messages, and gigs</li>
            <li><span className="text-gray-700">Usage data</span> — pages visited, features used, and approximate activity timestamps</li>
            <li><span className="text-gray-700">Location data</span> — only when you voluntarily add a location to a Side Quest post</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">2. How We Use Your Information</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-500">
            <li>To verify your York University affiliation via email OTP</li>
            <li>To display your profile and content to other verified users</li>
            <li>To enable platform features such as messaging, marketplace, and Side Quests</li>
            <li>To moderate content and enforce our Terms of Service</li>
            <li>To send platform-related notifications (no marketing emails)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">3. Anonymity in The Vault</h2>
          <p>Posts marked as anonymous in The Vault are displayed without your name or profile to other users. However, your user ID is stored internally in our database and may be accessed by platform administrators in cases of serious policy violations, credible threats of harm, or legal obligations. We do not sell or share this information with third parties.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">4. Data Sharing</h2>
          <p className="mb-3">We do not sell your personal data. We share data only with:</p>
          <ul className="list-disc list-inside space-y-2 text-gray-500">
            <li><span className="text-gray-700">Supabase</span> — our database and authentication provider</li>
            <li><span className="text-gray-700">Resend</span> — used to send OTP verification emails</li>
            <li><span className="text-gray-700">Vercel</span> — our frontend hosting provider</li>
            <li><span className="text-gray-700">Law enforcement</span> — only when legally required</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">5. Data Retention</h2>
          <p>Your data is retained for as long as your account is active. When you delete your account, your profile and personally identifiable information are removed. Some anonymized activity data may be retained for platform analytics.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">6. Your Rights</h2>
          <p className="mb-3">You have the right to:</p>
          <ul className="list-disc list-inside space-y-2 text-gray-500">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your account and associated data</li>
            <li>Withdraw consent at any time by deleting your account</li>
          </ul>
          <p className="mt-3">To exercise these rights, email us at <a href="mailto:yorkpulse.app@gmail.com" className="text-purple-700 hover:underline">yorkpulse.app@gmail.com</a>.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">7. Security</h2>
          <p>We use industry-standard security practices including encrypted connections (HTTPS), hashed authentication tokens, and row-level security on our database. No system is completely secure — please use a unique email and report any suspicious activity immediately.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">8. Children's Privacy</h2>
          <p>YorkPulse is not intended for users under 17. As a university platform, all users are expected to be of post-secondary age.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">9. Changes to This Policy</h2>
          <p>We may update this Privacy Policy as the platform evolves. We will notify users of significant changes via the platform. Continued use after changes constitutes acceptance.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">10. Contact</h2>
          <p>Privacy questions or requests: <a href="mailto:yorkpulse.app@gmail.com" className="text-purple-700 hover:underline">yorkpulse.app@gmail.com</a></p>
        </section>

      </div>

      <div className="mt-12 pt-8 border-t border-gray-200 text-sm text-gray-400">
        <Link href="/terms" className="text-purple-700 hover:underline">Terms of Service</Link>
      </div>
    </div>
  );
}
