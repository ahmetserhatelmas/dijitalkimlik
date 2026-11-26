"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCopy } from "@/lib/locale";

export function VerifyForm({ licenseId, initialHash }: { licenseId: string; initialHash: string }) {
  const router = useRouter();
  const t = useCopy();
  const [hash, setHash] = useState(initialHash);
  return (
    <form
      className="mt-6 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        router.push(`/verify/${licenseId}?agreementHash=${encodeURIComponent(hash.trim())}`);
      }}
    >
      <label className="block text-sm">
        {t.verify.hash}
        <input className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 font-mono text-xs" value={hash} onChange={(event) => setHash(event.target.value)} required />
      </label>
      <button className="rounded-full bg-teal px-5 py-2 text-sm text-white" type="submit">{t.verify.compare}</button>
    </form>
  );
}
