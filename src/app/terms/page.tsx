import Link from "next/link";
import { Zap, ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { SUPPORT_EMAIL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Terms of Service — VibeDash",
  description: "VibeDash terms of service. Read our terms and conditions for using the platform.",
};

export default function TermsOfServicePage() {
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
        <h1 className="text-3xl font-bold sm:text-4xl">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: February 28, 2026</p>

        <div className="mt-10 space-y-8 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p className="mt-3">
              By accessing or using VibeDash (&quot;the Service&quot;), you agree to be bound by these Terms of
              Service. If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">2. Description of Service</h2>
            <p className="mt-3">
              VibeDash is a project management dashboard designed for developers (&quot;vibe coders&quot;). The
              Service provides tools for tracking project phases, GitHub integration, AI-powered insights,
              marketing campaign management, and revenue analytics.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">3. User Accounts</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>You must provide accurate and complete information when creating an account.</li>
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You must notify us immediately of any unauthorized use of your account.</li>
              <li>You must be at least 13 years old to use the Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">4. Acceptable Use</h2>
            <p className="mt-3">You agree not to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Use the Service for any unlawful purpose or in violation of any applicable laws.</li>
              <li>Attempt to gain unauthorized access to any part of the Service or its systems.</li>
              <li>Interfere with or disrupt the integrity or performance of the Service.</li>
              <li>Upload or transmit malicious code, viruses, or harmful data.</li>
              <li>Use the Service to harass, abuse, or harm others.</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service.</li>
              <li>Use automated tools to scrape or collect data from the Service without permission.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">5. Intellectual Property</h2>
            <p className="mt-3">
              The Service, including its design, code, features, and branding, is owned by VibeDash and protected
              by intellectual property laws. You retain ownership of any content you create or upload to the
              Service. By using the Service, you grant us a limited license to store, process, and display your
              content as necessary to provide the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">6. Third-Party Integrations</h2>
            <p className="mt-3">
              The Service integrates with third-party platforms such as GitHub and Google Analytics. Your use of
              these integrations is subject to the respective third-party terms of service. We are not responsible
              for the availability, accuracy, or practices of third-party services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">7. Subscription & Payments</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Some features of the Service require a paid subscription.</li>
              <li>Subscription fees are billed in advance on a monthly or annual basis.</li>
              <li>You may cancel your subscription at any time. Cancellation takes effect at the end of the current billing period.</li>
              <li>We reserve the right to change pricing with 30 days&apos; notice.</li>
              <li>Refunds are handled on a case-by-case basis at our discretion.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">8. AI-Powered Features</h2>
            <p className="mt-3">
              VibeDash includes AI-powered features such as project insights and recommendations. These features
              are provided &quot;as is&quot; and should not be considered professional advice. AI-generated
              content may not always be accurate, and you should use your own judgment when making decisions based
              on AI suggestions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">9. Limitation of Liability</h2>
            <p className="mt-3">
              To the fullest extent permitted by law, VibeDash shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages, including but not limited to loss of profits, data,
              or business opportunities, arising out of or related to your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">10. Disclaimer of Warranties</h2>
            <p className="mt-3">
              The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any
              kind, whether express or implied. We do not guarantee that the Service will be uninterrupted,
              error-free, or secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">11. Termination</h2>
            <p className="mt-3">
              We may suspend or terminate your access to the Service at any time, with or without cause, and
              with or without notice. Upon termination, your right to use the Service ceases immediately. You
              may request export of your data prior to account deletion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">12. Changes to These Terms</h2>
            <p className="mt-3">
              We reserve the right to modify these Terms of Service at any time. We will notify users of
              material changes by posting the updated terms on this page and updating the &quot;Last updated&quot;
              date. Continued use of the Service after changes constitutes acceptance of the revised terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">13. Governing Law</h2>
            <p className="mt-3">
              These Terms of Service are governed by and construed in accordance with applicable laws. Any
              disputes arising from these terms or the Service shall be resolved through binding arbitration
              or in the courts of competent jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">14. Contact Us</h2>
            <p className="mt-3">
              If you have any questions about these Terms of Service, please contact us at{" "}
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
