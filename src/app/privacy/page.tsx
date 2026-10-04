import Link from "next/link";
import { Zap, ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { SUPPORT_EMAIL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Privacy Policy — VibeDash",
  description: "VibeDash privacy policy. Learn how we collect, use, and protect your personal information.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <nav className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/25">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold">VibeDash</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-4 pt-32 pb-20 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold sm:text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: March 4, 2026</p>

        <div className="mt-10 space-y-8 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. Introduction</h2>
            <p className="mt-3">
              Welcome to VibeDash. We respect your privacy and are committed to protecting your personal data.
              This privacy policy explains how we collect, use, disclose, and safeguard your information when
              you use our platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">2. Information We Collect</h2>
            <p className="mt-3">We may collect the following types of information:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                <strong className="text-foreground">Account Information:</strong> Name, email address, and
                authentication credentials when you create an account.
              </li>
              <li>
                <strong className="text-foreground">Project Data:</strong> Information about your projects,
                including project names, descriptions, phases, and related metadata you input into VibeDash.
              </li>
              <li>
                <strong className="text-foreground">Third-Party Integrations:</strong> Data from connected
                services such as GitHub repositories and Google Analytics, which you explicitly authorize.
              </li>
              <li>
                <strong className="text-foreground">Usage Data:</strong> Information about how you interact with
                our platform, including pages visited, features used, and session duration.
              </li>
              <li>
                <strong className="text-foreground">Device Information:</strong> Browser type, operating system,
                IP address, and device identifiers.
              </li>
            </ul>
          </section>

          {/* ── Google User Data Section ── */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">3. Google User Data — Accessed, Used, Stored &amp; Shared</h2>
            <p className="mt-3">
              VibeDash integrates with Google Analytics via the Google APIs. This section specifically addresses
              how we handle data received from Google APIs in compliance with the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-500 hover:text-violet-400 underline"
              >
                Google API Services User Data Policy
              </a>, including the Limited Use requirements.
            </p>

            <h3 className="mt-5 text-lg font-semibold text-foreground">3.1 Data Accessed</h3>
            <p className="mt-2">
              When you connect a Google Analytics property to VibeDash, we request the{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-sm text-foreground">analytics.readonly</code>{" "}
              OAuth scope. This grants us <strong className="text-foreground">read-only</strong> access to the
              following Google Analytics 4 data for the property you select:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                <strong className="text-foreground">Active Users:</strong> Monthly active users (last 30 days)
                and yearly active users (last 365 days).
              </li>
              <li>
                <strong className="text-foreground">Daily Visitor Counts:</strong> A day-by-day breakdown of
                active users over the last 30 days.
              </li>
              <li>
                <strong className="text-foreground">Top Pages:</strong> The top 10 pages by pageviews over the
                last 30 days (page paths and view counts only).
              </li>
              <li>
                <strong className="text-foreground">Account &amp; Property Metadata:</strong> A list of GA4
                property names and IDs accessible to your Google account, so you can choose which property to
                link.
              </li>
            </ul>
            <p className="mt-3">
              We do <strong className="text-foreground">not</strong> access personally identifiable information
              of your website visitors, demographic reports, remarketing audiences, or any data outside the
              read-only analytics scope listed above.
            </p>

            <h3 className="mt-5 text-lg font-semibold text-foreground">3.2 Data Usage</h3>
            <p className="mt-2">
              Google Analytics data retrieved through the Google APIs is used solely to:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Display analytics dashboards and traffic charts within your VibeDash project.</li>
              <li>Provide AI-powered insights and recommendations about your project&apos;s traffic trends.</li>
              <li>Include summary metrics (e.g., monthly visitors) in optional email reports you enable.</li>
            </ul>
            <p className="mt-3">
              We do <strong className="text-foreground">not</strong> use Google user data for advertising,
              marketing profiling, or any purpose unrelated to providing and improving VibeDash&apos;s core
              functionality for you.
            </p>

            <h3 className="mt-5 text-lg font-semibold text-foreground">3.3 Data Sharing</h3>
            <p className="mt-2">
              We do <strong className="text-foreground">not</strong> sell, rent, or share Google user data with
              any third parties, except in the following limited circumstances:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                <strong className="text-foreground">Infrastructure Providers:</strong> Google Analytics data may
                pass through our hosting provider (Vercel) and database provider (MongoDB Atlas) solely for
                the purpose of operating the VibeDash service. These providers act as data processors under
                contractual obligations to protect your data.
              </li>
              <li>
                <strong className="text-foreground">AI Processing:</strong> Aggregated, non-identifiable
                analytics metrics (e.g., visitor counts) may be sent to our AI service provider to generate
                project insights. No raw Google user tokens or personally identifiable information are shared.
              </li>
              <li>
                <strong className="text-foreground">Legal Obligations:</strong> When required by law, valid
                legal process, or to protect our rights.
              </li>
            </ul>
            <p className="mt-3">
              Google user data is never shared with third parties for purposes unrelated to providing or
              improving VibeDash.
            </p>

            <h3 className="mt-5 text-lg font-semibold text-foreground">3.4 Data Storage &amp; Protection</h3>
            <p className="mt-2">
              OAuth tokens (access tokens and refresh tokens) obtained through the Google authorization flow
              are stored securely in our MongoDB Atlas database, which is hosted in a SOC 2–compliant
              environment with encryption at rest (AES-256) and encryption in transit (TLS 1.2+). Access to
              stored tokens is restricted to authenticated, per-user, per-project lookups — no user can
              access another user&apos;s Google data.
            </p>
            <p className="mt-3">
              Cached analytics data (visitor counts, top pages) is stored alongside your project record in
              the same database with the same security controls. All communication between VibeDash and
              Google APIs occurs over HTTPS.
            </p>

            <h3 className="mt-5 text-lg font-semibold text-foreground">3.5 Data Retention &amp; Deletion</h3>
            <p className="mt-2">
              We retain Google Analytics tokens and cached analytics data for as long as your Google Analytics
              connection remains active within VibeDash. You can disconnect Google Analytics from any project
              at any time through the VibeDash dashboard, which immediately deletes the stored OAuth tokens
              and cached analytics data for that project.
            </p>
            <p className="mt-3">
              If you delete your VibeDash account, all associated Google Analytics tokens and cached data are
              permanently deleted. You may also revoke VibeDash&apos;s access at any time from your{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-500 hover:text-violet-400 underline"
              >
                Google Account permissions page
              </a>.
            </p>
            <p className="mt-3">
              To request deletion of your data, contact us at{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-violet-500 hover:text-violet-400 underline">
                {SUPPORT_EMAIL}
              </a>{" "}
              and we will process your request within 30 days.
            </p>
          </section>
          {/* ── End Google User Data Section ── */}

          <section>
            <h2 className="text-xl font-semibold text-foreground">4. How We Use Your Information</h2>
            <p className="mt-3">We use the information we collect to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Provide, operate, and maintain the VibeDash platform.</li>
              <li>Personalize your experience and deliver AI-powered insights.</li>
              <li>Process transactions and manage your subscription.</li>
              <li>Send you service-related communications, such as daily summaries and alerts.</li>
              <li>Improve our platform, develop new features, and fix bugs.</li>
              <li>Ensure security and prevent fraud.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">5. Data Sharing &amp; Disclosure</h2>
            <p className="mt-3">
              We do not sell your personal data. We may share your information only in the following circumstances:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                <strong className="text-foreground">Service Providers:</strong> With trusted third-party vendors
                who assist us in operating our platform (e.g., hosting, analytics, payment processing).
              </li>
              <li>
                <strong className="text-foreground">Legal Compliance:</strong> When required by law or in response
                to valid legal processes.
              </li>
              <li>
                <strong className="text-foreground">Business Transfers:</strong> In connection with a merger,
                acquisition, or sale of assets.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">6. Data Security</h2>
            <p className="mt-3">
              We implement industry-standard security measures to protect your data, including encryption in
              transit (TLS 1.2+) and at rest (AES-256), secure authentication via Clerk, and regular security
              audits. However, no method of transmission over the Internet is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">7. Data Retention</h2>
            <p className="mt-3">
              We retain your personal data for as long as your account is active or as needed to provide you
              services. You may request deletion of your data at any time by contacting us at{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-violet-500 hover:text-violet-400 underline">
                {SUPPORT_EMAIL}
              </a>. We will process deletion requests within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">8. Your Rights</h2>
            <p className="mt-3">Depending on your location, you may have the right to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request deletion of your data.</li>
              <li>Object to or restrict processing of your data.</li>
              <li>Data portability — receive your data in a structured, machine-readable format.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">9. Cookies</h2>
            <p className="mt-3">
              We use essential cookies to maintain your session and preferences. We may also use analytics
              cookies to understand usage patterns. You can manage cookie preferences through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">10. Third-Party Services</h2>
            <p className="mt-3">
              VibeDash integrates with third-party services such as GitHub and Google Analytics. These services
              have their own privacy policies, and we encourage you to review them. We only access data you
              explicitly authorize through OAuth or similar mechanisms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">11. Changes to This Policy</h2>
            <p className="mt-3">
              We may update this privacy policy from time to time. We will notify you of any material changes by
              posting the new policy on this page and updating the &quot;Last updated&quot; date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">12. Contact Us</h2>
            <p className="mt-3">
              If you have any questions about this privacy policy or wish to exercise your data rights, please
              contact us at{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-violet-500 hover:text-violet-400 underline">
                {SUPPORT_EMAIL}
              </a>.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold">VibeDash</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Terms of Service
            </Link>
            <p className="text-xs text-muted-foreground">
              © 2026 VibeDash. Built with ❤️ by vibe coders.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
