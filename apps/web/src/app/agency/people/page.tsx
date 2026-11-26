"use client";

import { useEffect, useState } from "react";
import { term } from "@suret/shared";
import { api } from "@/lib/api";
import { useCopy, useLocale } from "@/lib/locale";

export default function Page() {
  const t = useCopy();
  const locale = useLocale();
  const [rows, setRows] = useState<Array<{ id: string; profileId: string; scopes: string[]; status: string }>>([]);
  useEffect(() => {
    api<typeof rows>("representations").then(setRows).catch(() => setRows([]));
  }, []);
  return (
    <div>
      <h1 className="text-4xl">{t.agencyPage.representation}</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">{t.agencyPage.representationLede}</p>
      <ul className="mt-6 space-y-2">
        {rows.map((row) => <li key={row.id} className="rounded-xl border border-line bg-card p-3 text-sm">{term(locale, "statuses", row.status)}: {row.scopes.map((scope) => t.agencyPage.scopes[scope as keyof typeof t.agencyPage.scopes] ?? scope).join(", ") || t.agencyPage.noScopes}</li>)}
      </ul>
      {rows.length === 0 && <p className="mt-4 text-muted">{t.agencyPage.empty}</p>}
    </div>
  );
}
