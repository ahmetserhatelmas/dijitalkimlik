import { SiteFooter, SiteHeader } from "@/components/shell";

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
