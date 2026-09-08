import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="mb-8">
        <Link href="/" className="text-sm text-primary hover:underline">← Back to YorkPulse</Link>
      </div>

      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-gray-400 text-sm mb-10">Last updated: September 2026</p>

      <div className="space-y-8 text-gray-700 leading-relaxed">

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Information We Collect</h2>
          <p className="mb-3">When you use YorkPulse, we collect:</p>
          <ul className="list-disc list-inside space-y-2 text-gray-500">
            <li><span className="text-gray-700">Account information</span> — your York email address and display name</li>
            <li><span className="text-gray-700">Profile information</span> — program, bio, and avatar you choose to provide</li>
            <li><span className="text-gray-700">Content you post</span> — marketplace listings, Vault posts, Side Quest requests, messages, and gigs</li>
            <li><span className="text-gray-700">Usage data</span> — pages visited, features used, and approximate activity timestamps</li>
            <li><span className="text-gray-700">Location data</span> — only when you voluntarily add a location to a Side Quest post</li>
            <li><span className="text-gray-700">Activity and session data</span> — only for the optional categories described in Section 4, and only if you turn them on</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">2. How We Use Your Information</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-500">
            <li>To verify your York University affiliation via email OTP</li>
            <li>To display your profile and content to other verified users</li>
            <li>To enable platform features such as messaging, marketplace, and Side Quests</li>
            <li>To moderate content and enforce our Terms of Service</li>
            <li>To send platform-related notifications (no marketing emails)</li>
            <li>If you opt in, to understand how the platform is used and improve it (see Section 4)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">3. Anonymity in The Vault</h2>
          <p>Posts marked as anonymous in The Vault are displayed without your name or profile to other users. However, your user ID is stored internally in our database and may be accessed by platform administrators in cases of serious policy violations, credible threats of harm, or legal obligations. We do not sell or share this information with third parties.</p>
          <p className="mt-3">The Vault is included in the optional activity-tracking categories described in Section 4 like every other feature on the platform, if you&apos;ve opted into them. Your posts remain anonymous to other users either way — activity tracking never reveals your identity to anyone besides platform administrators, and under the same limited circumstances described above.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Activity Tracking &amp; Analytics (Optional)</h2>
          <p className="mb-3">
            Beyond the basic security measures every account uses by default (like rate-limiting to prevent abuse — this is not optional and isn&apos;t tied to the categories below), YorkPulse offers two additional, entirely optional tracking categories. Both are <strong>off unless you turn them on</strong>, during onboarding or anytime from your Profile page, and you can turn either off independently at any time.
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-500 mb-3">
            <li><span className="text-gray-700">Product analytics</span> — page visits, feature usage, and session-level statistics (like time spent and days active). We never record the content of what you type, post, or send.</li>
            <li><span className="text-gray-700">Session replay</span> — a video-like recording of your on-screen interactions (clicks, scrolling, mouse movement), used to understand and fix confusing parts of the app. Text you type into any input, and the content of messages and posts as displayed on screen, is automatically masked and never captured in these recordings.</li>
          </ul>
          <p className="mb-3">
            If you opt into either category, that data is stored in our database and in Amazon Web Services (AWS) infrastructure located in the United States. This means it may become subject to lawful access requests under U.S. law (such as the CLOUD Act) in addition to Canadian law. Raw activity/session data is retained for up to 180 days (90 days for session-replay data specifically) and then automatically deleted; a record of your consent choices is kept for as long as your account exists, so we can show you exactly what you agreed to and when.
          </p>
          <p>
            Deleting your account deletes this data along with everything else described in Section 6. This section applies uniformly across every feature, including The Vault (see Section 3).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Data Sharing</h2>
          <p className="mb-3">We do not sell your personal data. We share data only with:</p>
          <ul className="list-disc list-inside space-y-2 text-gray-500">
            <li><span className="text-gray-700">Supabase</span> — our database and authentication provider</li>
            <li><span className="text-gray-700">Amazon Web Services (AWS)</span> — hosts our backend server and API, and (only if you&apos;ve opted in) the activity-tracking data described in Section 4</li>
            <li><span className="text-gray-700">Resend</span> — used to send OTP verification emails</li>
            <li><span className="text-gray-700">Vercel</span> — our frontend hosting provider</li>
            <li><span className="text-gray-700">Law enforcement</span> — only when legally required</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Data Retention</h2>
          <p>Your data is retained for as long as your account is active. When you delete your account, your profile and personally identifiable information are removed, including any activity-tracking data described in Section 4. Some anonymized activity data may be retained for platform analytics.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Your Rights</h2>
          <p className="mb-3">You have the right to:</p>
          <ul className="list-disc list-inside space-y-2 text-gray-500">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your account and associated data</li>
            <li>Withdraw consent at any time by deleting your account</li>
            <li>View or withdraw your activity-tracking consent independently, at any time, from your Profile page — without deleting your account</li>
          </ul>
          <p className="mt-3">To exercise these rights, email us at <a href="mailto:yorkpulse.app@gmail.com" className="text-primary hover:underline">yorkpulse.app@gmail.com</a>.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Security</h2>
          <p>We use industry-standard security practices including encrypted connections (HTTPS), hashed authentication tokens, and row-level security on our database. No system is completely secure — please use a unique email and report any suspicious activity immediately.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Children's Privacy</h2>
          <p>YorkPulse is not intended for users under 17. As a university platform, all users are expected to be of post-secondary age.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Changes to This Policy</h2>
          <p>We may update this Privacy Policy as the platform evolves. We will notify users of significant changes via the platform. Continued use after changes constitutes acceptance.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">11. Contact</h2>
          <p>Privacy questions or requests: <a href="mailto:yorkpulse.app@gmail.com" className="text-primary hover:underline">yorkpulse.app@gmail.com</a></p>
        </section>

      </div>

      <div className="mt-12 pt-8 border-t border-gray-200 text-sm text-gray-400">
        <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
      </div>
    </div>
  );
}
