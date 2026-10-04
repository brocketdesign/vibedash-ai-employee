import { currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";

/**
 * Get or create the current user in MongoDB, synced from Clerk.
 * Call this from server components or API routes.
 */
export async function getOrSyncUser() {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const { db } = await connectToDatabase();

  const email =
    clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId
    )?.emailAddress ||
    clerkUser.emailAddresses[0]?.emailAddress ||
    "";

  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    "User";

  const userData = {
    clerkId: clerkUser.id,
    email,
    name,
    avatar: clerkUser.imageUrl || "",
    githubConnected:
      clerkUser.externalAccounts?.some(
        (a) => a.provider === "oauth_github"
      ) ?? false,
    updatedAt: new Date().toISOString(),
  };

  const result = await db.collection("users").findOneAndUpdate(
    { clerkId: clerkUser.id },
    {
      $set: userData,
      $setOnInsert: {
        plan: "free",
        onboardingCompleted: false,
        createdAt: new Date().toISOString(),
      },
    },
    { upsert: true, returnDocument: "after" }
  );

  return result;
}
