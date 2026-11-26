import Link from "next/link";
import { term } from "@suret/shared";
import { SiteFooter, SiteHeader } from "@/components/shell";
import { apiOrigin } from "@/lib/api";
import { getCopy, getLocale } from "@/lib/locale-server";
import { VerifyForm } from "./form";

type ChainRecordView = {
  chainId: number | null;
  contractAddress: string | null;
  txHash: string | null;
  licenseKey: string;
  agreementHash: string;
  ruleSnapshotHash: string;
  assetReference: string;
  projectReference: string;
  status: string;
  confirmedAt: string | null;
};

type Verification = {
  agreementId: string;
  documentMatches: boolean | null;
  chainMatches: boolean | null;
  onChainVerified: boolean | null;
  licenseStatus: string;
  txHash: string | null;
  record: ChainRecordView | null;
  explanation: string;
};

export const dynamic = "force-dynamic";

export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ licenseId: string }>;
  searchParams: Promise<{ agreementHash?: string }>;
}) {
  const { licenseId } = await params;
  const { agreementHash } = await searchParams;
  const t = await getCopy();
  const locale = await getLocale();
  const query = agreementHash ? `?agreementHash=${encodeURIComponent(agreementHash)}` : "";
  let result: Verification | null = null;
  let error = "";
  const response = await fetch(
    `${apiOrigin()}/api/v1/verification/${licenseId}${query}`,
    { cache: "no-store", headers: { "accept-language": locale } },
  ).catch(() => null);
  if (!response) error = t.verify.unavailable;
  else if (!response.ok) error = t.verify.failed;
  else result = ((await response.json()) as { data: Verification }).data;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-xl px-5 py-16">
        <h1 className="text-4xl">{t.verify.title}</h1>
        <p className="mt-3 text-muted">{t.verify.lede}</p>
        {result?.record && (
          <section className="mt-8 space-y-2 text-sm">
            <h2 className="text-xl">{t.verify.localTitle}</h2>
            <p className="text-muted">{t.verify.localLede}</p>
            <div className="break-all">{t.verify.network}: {result.record.chainId ?? t.verify.none}</div>
            <div className="break-all">{t.verify.contract}: {result.record.contractAddress ?? t.verify.none}</div>
            <div className="break-all">{t.verify.transaction}: {result.record.txHash ?? t.verify.none}</div>
            <div className="break-all">{t.verify.licenseKey}: {result.record.licenseKey}</div>
            <div className="break-all">{t.verify.agreementHash}: {result.record.agreementHash}</div>
            <div className="break-all">{t.verify.ruleHash}: {result.record.ruleSnapshotHash}</div>
            <div className="break-all">{t.verify.assetHash}: {result.record.assetReference}</div>
            <div className="break-all">{t.verify.projectHash}: {result.record.projectReference}</div>
            <Link className="inline-block pt-2 underline" href={`/agreements/${result.agreementId}`}>{t.verify.openAgreement}</Link>
          </section>
        )}
        <VerifyForm licenseId={licenseId} initialHash={agreementHash ?? ""} />
        {error && <p className="mt-4 text-sm text-danger" role="alert">{error}</p>}
        {result && agreementHash && (
          <dl className="mt-6 space-y-2 text-sm">
            <div>{t.verify.document}: {result.documentMatches ? t.common.yes : t.common.no}</div>
            <div>{t.verify.recorded}: {result.chainMatches === null ? t.verify.none : result.chainMatches ? t.common.yes : t.common.no}</div>
            <div>{t.verify.onChain}: {result.onChainVerified === null ? t.verify.none : result.onChainVerified ? t.common.yes : t.common.no}</div>
            <div>{t.verify.status}: {term(locale, "statuses", result.licenseStatus)}</div>
            <div className="break-all">{t.verify.transaction}: {result.txHash ?? t.verify.none}</div>
            <p className="text-muted">{t.verify.explanation}</p>
          </dl>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
