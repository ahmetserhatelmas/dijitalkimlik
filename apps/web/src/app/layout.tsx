import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { LocaleProvider } from "@/lib/locale";
import { getCopy, getLocale } from "@/lib/locale-server";
import "./globals.css";

const sans = Figtree({ subsets: ["latin", "latin-ext"], variable: "--font-sans" });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getCopy();
  return { title: t.meta.title, description: t.meta.description };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className={`${sans.variable} paper antialiased`}>
        <LocaleProvider initial={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
