import { createHmac, randomBytes } from "node:crypto";
import { AppError } from "../errors.js";
import type { PaymentEvent, PaymentProvider } from "./types.js";

type IyzicoOptions = {
  apiKey: string;
  secretKey: string;
  baseUrl: string;
  callbackUrl: string;
};

export class IyzicoPaymentProvider implements PaymentProvider {
  readonly name = "iyzico" as const;

  constructor(private readonly options: IyzicoOptions) {}

  async initiate(input: { paymentId: string; agreementId: string; amountMinor: number; currency: string; buyerEmail: string }) {
    const price = (input.amountMinor / 100).toFixed(2);
    const body = {
      locale: "tr",
      conversationId: input.paymentId,
      price,
      paidPrice: price,
      currency: input.currency === "TRY" ? "TRY" : input.currency,
      basketId: input.agreementId,
      paymentGroup: "PRODUCT",
      callbackUrl: this.options.callbackUrl,
      buyer: {
        id: input.paymentId,
        name: "Suret",
        surname: "Licensee",
        email: input.buyerEmail,
        identityNumber: "00000000000",
        registrationAddress: "Not collected",
        city: "Istanbul",
        country: "Turkey",
      },
      billingAddress: { contactName: "Suret Licensee", city: "Istanbul", country: "Turkey", address: "Not collected" },
      basketItems: [
        {
          id: input.agreementId,
          name: "Likeness license",
          category1: "License",
          itemType: "VIRTUAL",
          price,
        },
      ],
    };
    const path = "/payment/iyzipos/checkoutform/initialize/auth/ecom";
    const payload = await this.request<{ token?: string; paymentPageUrl?: string; status?: string; errorMessage?: string }>(path, body);
    if (payload.status !== "success" || !payload.token) {
      throw new AppError(502, "PAYMENT_PROVIDER_ERROR", payload.errorMessage ?? "iyzico did not start the checkout.");
    }
    return {
      providerRef: payload.token,
      checkoutUrl: payload.paymentPageUrl ?? null,
      providerPayload: { mode: "iyzico", token: payload.token },
    };
  }

  parseWebhook(): PaymentEvent {
    throw new AppError(400, "WEBHOOK_RETRIEVAL_REQUIRED", "iyzico callbacks must be confirmed with a server-side retrieval.");
  }

  async retrieve(token: string): Promise<PaymentEvent> {
    const path = "/payment/iyzipos/checkoutform/auth/ecom/detail";
    const payload = await this.request<{
      status?: string;
      paymentStatus?: string;
      paymentId?: string;
      paidPrice?: string;
      conversationId?: string;
      errorMessage?: string;
    }>(path, { locale: "tr", token });
    if (payload.status !== "success") {
      throw new AppError(502, "PAYMENT_PROVIDER_ERROR", payload.errorMessage ?? "iyzico did not confirm the payment.");
    }
    const amountMinor = Math.round(Number(payload.paidPrice ?? "0") * 100);
    const succeeded = payload.paymentStatus === "SUCCESS";
    return {
      eventId: `iyzico_${payload.paymentId ?? token}`,
      providerRef: token,
      status: succeeded ? "succeeded" : "failed",
      amountMinor,
    };
  }

  async refund(input: { providerRef: string; amountMinor: number }) {
    const path = "/payment/refund";
    const payload = await this.request<{ status?: string; paymentId?: string; errorMessage?: string }>(path, {
      locale: "tr",
      paymentTransactionId: input.providerRef,
      price: (input.amountMinor / 100).toFixed(2),
      currency: "TRY",
    });
    if (payload.status !== "success") throw new AppError(502, "PAYMENT_PROVIDER_ERROR", payload.errorMessage ?? "iyzico refund failed.");
    return { providerRefundRef: payload.paymentId ?? `iyzico_refund_${input.providerRef}` };
  }

  private async request<T>(uri: string, body: unknown): Promise<T> {
    const raw = JSON.stringify(body);
    const response = await fetch(`${this.options.baseUrl}${uri}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: authorizationHeader(this.options.apiKey, this.options.secretKey, uri, raw),
      },
      body: raw,
    });
    if (!response.ok) throw new AppError(502, "PAYMENT_PROVIDER_ERROR", `iyzico responded with HTTP ${response.status}.`);
    return (await response.json()) as T;
  }
}

export function authorizationHeader(apiKey: string, secretKey: string, uri: string, rawBody: string): string {
  const randomKey = randomBytes(8).toString("hex");
  const signature = createHmac("sha256", secretKey).update(`${randomKey}${uri}${rawBody}`).digest("hex");
  const encoded = Buffer.from(`apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`).toString("base64");
  return `IYZWSv2 ${encoded}`;
}
