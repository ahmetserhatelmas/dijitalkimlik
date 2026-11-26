"use client";

import { Dashboard } from "@/components/dashboard";

export default function ProducerLayout({ children }: { children: React.ReactNode }) {
  return <Dashboard>{children}</Dashboard>;
}
