"use client";

import { createContext, useContext, ReactNode } from "react";

const DemoContext = createContext(false);

export function DemoProvider({
  isDemo,
  children,
}: {
  isDemo: boolean;
  children: ReactNode;
}) {
  return <DemoContext.Provider value={isDemo}>{children}</DemoContext.Provider>;
}

export function useIsDemo() {
  return useContext(DemoContext);
}
