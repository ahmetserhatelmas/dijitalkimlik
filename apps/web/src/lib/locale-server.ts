import { copy, isLocale, type Copy, type Locale } from "@suret/shared";
import { cookies } from "next/headers";

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get("suret_locale")?.value;
  return isLocale(value) ? value : "tr";
}

export async function getCopy(): Promise<Copy> {
  return copy(await getLocale());
}
