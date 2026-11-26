"use client";

import { Dashboard } from "@/components/dashboard";

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <Dashboard>{children}</Dashboard>;
}
