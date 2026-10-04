import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "VibeDash API Documentation",
  description:
    "Complete reference for the VibeDash REST API. Manage projects, pipelines, reviews, and more.",
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider defaultTheme="dark">
      <div className="min-h-screen bg-background">{children}</div>
    </ThemeProvider>
  );
}
