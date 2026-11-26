"use client";

import { LicenseList } from "@/components/workspace";

export default function Page() {
  return (
    <div>
      <h1 className="text-4xl">Licenses</h1>
      <p className="mt-2 text-sm text-muted">Active, expired, and historical agreements. A later edit to your general rules does not change these.</p>
      <LicenseList />
    </div>
  );
}
