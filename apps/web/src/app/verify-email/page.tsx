"use client";

import { useState } from "react";
import { Dashboard, ErrorText, Notice } from "@/components/dashboard";
import { api } from "@/lib/api";
import { useCopy } from "@/lib/locale";

export default function VerifyEmailPage() {
  const t = useCopy();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return (
    <Dashboard>
      <h1 className="text-4xl">{t.email.title}</h1>
      <p className="mt-3 max-w-xl text-muted">{t.email.lede}</p>
      <button
        className="mt-6 rounded-full bg-teal px-5 py-2 text-sm text-white"
        onClick={async () => {
          setError("");
          try {
            await api("auth/verify-email", { method: "POST" });
            setMessage(t.email.done);
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : t.email.failed);
          }
        }}
      >{t.email.button}</button>
      {message && <div className="mt-4"><Notice>{message}</Notice></div>}
      {error && <div className="mt-4"><ErrorText>{error}</ErrorText></div>}
    </Dashboard>
  );
}
