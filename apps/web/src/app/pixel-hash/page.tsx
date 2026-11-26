"use client";

import { useState } from "react";
import { ErrorText } from "@/components/dashboard";
import { PageIntro, SiteFooter, SiteHeader } from "@/components/shell";
import { ApiError, api } from "@/lib/api";
import { useCopy } from "@/lib/locale";

type HashResult = {
  mediaType: string;
  fileHash: string;
  perceptualHash: string | null;
};

export default function PixelHashPage() {
  const t = useCopy();
  const [result, setResult] = useState<HashResult | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-16">
        <PageIntro eyebrow={t.hashTool.eyebrow} title={t.hashTool.title} lede={t.hashTool.lede} />
        <form
          className="mt-8 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            setResult(null);
            setPending(true);
            try {
              const body = new FormData(event.currentTarget);
              setResult(await api<HashResult>("tools/photo-hash", { method: "POST", body }));
            } catch (caught) {
              setError(caught instanceof ApiError ? caught.message : t.hashTool.failed);
            } finally {
              setPending(false);
            }
          }}
        >
          <label className="block text-sm">{t.hashTool.choose}
            <input className="mt-1 block" name="file" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" required />
          </label>
          <button className="rounded-full bg-accent px-4 py-2 text-sm text-white" type="submit" disabled={pending}>{t.hashTool.submit}</button>
        </form>
        {error && <div className="mt-4"><ErrorText>{error}</ErrorText></div>}
        {result && (
          <div className="mt-8 space-y-4">
            <div>
              <p className="text-sm font-semibold">{t.hashTool.pixel}</p>
              <p className="mt-1 text-sm text-muted">{t.hashTool.pixelNote}</p>
              <p className="mt-2 break-all font-mono text-sm">{result.perceptualHash ?? t.hashTool.webp}</p>
            </div>
            <div>
              <p className="text-sm font-semibold">{t.hashTool.file}</p>
              <p className="mt-1 text-sm text-muted">{t.hashTool.fileNote}</p>
              <p className="mt-2 break-all font-mono text-sm">{result.fileHash}</p>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
