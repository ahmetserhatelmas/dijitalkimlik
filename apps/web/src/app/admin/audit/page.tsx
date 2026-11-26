"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useCopy } from "@/lib/locale";

export default function Page() {
  const [rows, setRows] = useState<Array<{ id: string; action: string; entryHash: string; createdAt: string }>>([]);
  const t = useCopy();
  const [error, setError] = useState("");
  useEffect(() => {
    api<typeof rows>("admin/audit-logs").then(setRows).catch((caught) => setError(caught instanceof Error ? caught.message : t.admin.auditFailed));
  }, []);
  return (
    <div>
      <h1 className="text-4xl">{t.admin.auditTitle}</h1>
      <p className="mt-2 text-sm text-muted">{t.admin.auditLede}</p>
      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      <ul className="mt-6 space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-line bg-card p-3 text-sm">
            <div>{row.action}</div>
            <div className="mt-1 break-all font-mono text-xs text-muted">{row.entryHash}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
