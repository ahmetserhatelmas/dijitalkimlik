import { verifySignedPayload } from "@suret/shared";
import { AppError } from "../errors.js";
import { headerValue, type PaymentProvider } from "./types.js";

export class SandboxPaymentProvider implements PaymentProvider {
  readonly name = "sandbox" as const;

  constructor(
    private readonly secret: string,
    private readonly apiPublicUrl: string,
  ) {}

  async initiate(input: { paymentId: string; agreementId: string; amountMinor: number; currency: string; buyerEmail: string }) {
    return {
      providerRef: `sandbox_${input.paymentId}`,
      checkoutUrl: `${this.apiPublicUrl}/api/v1/payments/${input.paymentId}/sandbox`,
      providerPayload: {
        mode: "fake_balance",
        notice: "Fake balance. The server debits play money. No card is charged, and payment alone does not activate the license.",
        buyerEmail: input.buyerEmail,
        amountMinor: input.amountMinor,
        currency: input.currency,
        agreementId: input.agreementId,
      },
    };
  }

  parseWebhook(input: { headers: Record<string, string | string[] | undefined>; rawBody: string; nowMs?: number }) {
    const timestamp = headerValue(input.headers, "x-suret-timestamp");
    const signature = headerValue(input.headers, "x-suret-signature");
    const verified = verifySignedPayload({
      secret: this.secret,
      timestamp,
      rawBody: input.rawBody,
      signature,
      nowMs: input.nowMs,
    });
    if (!verified.ok) throw new AppError(401, "INVALID_WEBHOOK", verified.reason);
    const body = JSON.parse(input.rawBody) as {
      eventId?: string;
      providerRef?: string;
      status?: "succeeded" | "failed" | "cancelled";
      amountMinor?: number;
    };
    if (!body.eventId || !body.providerRef || !body.status || typeof body.amountMinor !== "number") {
      throw new AppError(400, "INVALID_WEBHOOK", "Sandbox webhook body is incomplete.");
    }
    return {
      eventId: body.eventId,
      providerRef: body.providerRef,
      status: body.status,
      amountMinor: body.amountMinor,
    };
  }

  async refund(input: { providerRef: string; amountMinor: number }) {
    return { providerRefundRef: `sandbox_refund_${input.providerRef}_${input.amountMinor}` };
  }
}
