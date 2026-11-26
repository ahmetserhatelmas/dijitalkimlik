export type PaymentEvent = {
  eventId: string;
  providerRef: string;
  status: "succeeded" | "failed" | "cancelled";
  amountMinor: number;
};

export type InitiatedCheckout = {
  providerRef: string;
  checkoutUrl: string | null;
  providerPayload: unknown;
};

export interface PaymentProvider {
  readonly name: "sandbox" | "iyzico";
  initiate(input: {
    paymentId: string;
    agreementId: string;
    amountMinor: number;
    currency: string;
    buyerEmail: string;
  }): Promise<InitiatedCheckout>;
  parseWebhook(input: { headers: HeadersLike; rawBody: string; nowMs?: number }): PaymentEvent;
  refund(input: { providerRef: string; amountMinor: number }): Promise<{ providerRefundRef: string }>;
}

export type HeadersLike = Record<string, string | string[] | undefined>;

export function headerValue(headers: HeadersLike, name: string): string {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
