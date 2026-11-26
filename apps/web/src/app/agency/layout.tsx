"use client";

import { Dashboard } from "@/components/dashboard";

export default function AgencyLayout({ children }: { children: React.ReactNode }) {
  return <Dashboard>{children}</Dashboard>;
}
