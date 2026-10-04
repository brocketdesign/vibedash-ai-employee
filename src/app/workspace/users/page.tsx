"use client";

import { UserDataHub } from "@/components/dashboard/user-data-hub";

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">User Data Hub</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your projects and analyze user metrics powered by AI-generated dashboards.
        </p>
      </div>
      <UserDataHub />
    </div>
  );
}
