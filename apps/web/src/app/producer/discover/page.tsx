"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { DiscoverRequest } from "@/components/workspace";
import { useCopy } from "@/lib/locale";

function Discover() {
  const params = useSearchParams();
  return <DiscoverRequest assetId={params.get("asset") ?? ""} />;
}

function Loading() {
  const t = useCopy();
  return <p className="text-muted">{t.common.loading}</p>;
}

export default function Page() {
  return <Suspense fallback={<Loading />}><Discover /></Suspense>;
}
