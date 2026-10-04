import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { connectToDatabase } from "@/lib/mongodb";
import { auth } from "@clerk/nextjs/server";
import { DemoProvider } from "@/lib/demo-context";
import { TrialGate } from "@/components/dashboard/trial-gate";

async function checkOnboarding() {
  const { userId } = await auth();
  
  if (!userId) {
    return { needsOnboarding: false }; // Let middleware handle auth
  }

  const { db } = await connectToDatabase();
  
  // Atomically find-or-create the user document.
  // Using findOneAndUpdate + upsert avoids race conditions with the
  // Clerk webhook and the onboarding POST handler.
  const user = await db.collection("users").findOneAndUpdate(
    { clerkId: userId },
    {
      $setOnInsert: {
        email: "",
        name: "User",
        plan: "free",
        githubConnected: false,
        onboardingCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
    { upsert: true, returnDocument: "after", projection: { onboardingCompleted: 1 } }
  );

  if (user?.onboardingCompleted !== true) {
    console.log(`[Dashboard] User ${userId} needs onboarding (onboardingCompleted=${user?.onboardingCompleted})`);
    return { needsOnboarding: true };
  }

  return { needsOnboarding: false };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  const cookieStore = await cookies();
  const demoCookie = cookieStore.get("demo_mode")?.value === "true";

  // Authenticated users are NEVER in demo mode, even if the cookie lingers
  const isDemo = !userId && demoCookie;

  if (!isDemo) {
    const { needsOnboarding } = await checkOnboarding();
    if (needsOnboarding) {
      redirect("/onboarding");
    }
  }

  return (
    <ThemeProvider defaultTheme="dark">
      <DemoProvider isDemo={isDemo}>
        <div className="min-h-screen bg-background overflow-x-hidden">
          <Sidebar />
          <div className="lg:pl-64">
            <Header />
            <main className="px-4 py-6 sm:px-6 lg:px-8 overflow-x-hidden">
              <TrialGate>{children}</TrialGate>
            </main>
          </div>
        </div>
      </DemoProvider>
    </ThemeProvider>
  );
}
