import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** The employee product's display face — editorial, not app-like. */
const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "VibeDash — AI That Runs Your Company While You Sleep",
  description:
    "Hire an AI employee for $20/month. It works a night shift every night — researching, building, shipping, posting and selling — and leaves a report for you in the morning.",
};

/**
 * `next build` prerenders pages, and Clerk will not render without a
 * publishable key. A production build with no key set (a fresh clone, CI) gets
 * a well-formed placeholder so it can finish; signing in still needs a real
 * key. Development is untouched, so Clerk's own missing-key handling applies.
 */
const clerkPublishableKey =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  (process.env.NODE_ENV === "production"
    ? "pk_test_Y2xlcmsuZXhhbXBsZS5jb20k" // base64("clerk.example.com$"), not a real key
    : undefined);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#7c3aed",
          colorTextOnPrimaryBackground: "#ffffff",
          colorBackground: "#1a1a1a",
          colorInputBackground: "#262626",
          colorInputText: "#fafafa",
          colorText: "#fafafa",
          colorTextSecondary: "#a3a3a3",
          colorDanger: "#ef4444",
          colorSuccess: "#22c55e",
          borderRadius: "0.75rem",
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        },
        elements: {
          formButtonPrimary:
            "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all text-white font-semibold",
          card: "bg-card border border-border shadow-xl",
          headerTitle: "text-foreground font-bold",
          headerSubtitle: "text-muted-foreground",
          socialButtonsBlockButton:
            "border-border bg-muted hover:bg-accent text-foreground transition-colors",
          socialButtonsBlockButtonText: "text-foreground font-medium",
          formFieldLabel: "text-foreground text-sm font-medium",
          formFieldInput:
            "rounded-xl border-border bg-muted text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500",
          footerActionLink:
            "text-violet-500 hover:text-violet-400 font-medium",
          identityPreviewEditButton: "text-violet-500 hover:text-violet-400",
          formFieldAction: "text-violet-500 hover:text-violet-400",
          dividerLine: "bg-border",
          dividerText: "text-muted-foreground",
          footer: "hidden",
          internal: "hidden",
        },
      }}
    >
      <html lang="en" className="dark" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased`}
        >
          {children}
          <Toaster richColors position="bottom-right" />
        </body>
      </html>
    </ClerkProvider>
  );
}
