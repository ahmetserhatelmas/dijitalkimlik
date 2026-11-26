"use client";

import { useParams } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { AgreementDesk } from "@/components/workspace";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <Dashboard><AgreementDesk id={params.id} /></Dashboard>;
}
