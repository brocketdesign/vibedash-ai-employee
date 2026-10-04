"use client";

import { SignUp } from "@clerk/nextjs";
import { Zap } from "lucide-react";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="relative flex flex-col items-center gap-8">
        {/* Branding */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/25">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              VibeDash
            </h1>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Vibe Coding Manager
            </p>
          </div>
        </div>

        {/* Clerk Sign Up */}
        <SignUp
          appearance={{
            elements: {
              rootBox: "w-full max-w-md",
              cardBox: "w-full shadow-none",
              card: "w-full bg-card border border-border rounded-2xl shadow-2xl shadow-black/20 p-0",
              headerTitle: "text-xl",
              formButtonPrimary: "rounded-xl h-11",
              formFieldInput: "h-11 rounded-xl",
              socialButtonsBlockButton: "rounded-xl h-11",
              dividerRow: "my-4",
            },
          }}
          forceRedirectUrl="/dashboard"
          signInUrl="/login"
        />
      </div>
    </div>
  );
}
