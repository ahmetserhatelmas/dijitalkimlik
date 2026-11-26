"use client";

import { Dashboard } from "@/components/dashboard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <Dashboard>{children}</Dashboard>;
}
