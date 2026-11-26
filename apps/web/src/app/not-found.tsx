import Link from "next/link";
import { getCopy } from "@/lib/locale-server";

export default async function NotFound() {
  const t = await getCopy();
  return (
    <main className="mx-auto max-w-lg px-5 py-24">
      <h1 className="text-4xl">{t.notFound.title}</h1>
      <Link className="mt-4 inline-block underline" href="/">{t.notFound.back}</Link>
    </main>
  );
}
