import { sha256Hex, signPayload, type PaymentRecord } from "@suret/shared";
import type { Actor } from "../actor.js";
import { isAdmin } from "../actor.js";
import { AppError, forbidden, notFound } from "../errors.js";
import { newId, nowIso } from "../ids.js";
import type { PaymentProvider } from "../payments/types.js";
import type { AppRepository } from "../repos/types.js";
import type { LicenseService } from "./licensing.js";

export class PaymentService {
  constructor(
    private readonly repo: AppRepository,
    private readonly provider: PaymentProvider,
    private readonly licenses: LicenseService,
    private readonly webhookSecret: string,
  ) {}

  async initiate(actor: Actor, agreementId: string, idempotencyKey: string) {
    const agreement = await this.repo.getAgreement(agreementId);
    if (!agreement) throw notFound("Agreement not found.");
    if (actor.userId !== agreement.document.licenseeProfileId) throw forbidden("Only the licensee can pay for this agreement.");
    if (!agreement.paymentRequired) throw new AppError(409, "PAYMENT_NOT_REQUIRED", "This agreement does not require a payment.");
    if (agreement.status !== "payment_pending") {
      throw new AppError(409, "PAYMENT_NOT_DUE", "Payment opens after both parties have consented and signed.");
    }
    const existing = await this.repo.findPaymentByIdempotency(agreement.id, idempotencyKey);
    if (existing) {
      const checkout = await this.provider.initiate({
        paymentId: existing.id,
        agreementId: agreement.id,
        amountMinor: existing.amountMinor,
        currency: existing.currency,
        buyerEmail: actor.email,
      });
      return { payment: existing, checkout, idempotent: true };
    }
    const paymentId = newId();
    const checkout = await this.provider.initiate({
      paymentId,
      agreementId: agreement.id,
      amountMinor: agreement.amountMinor,
      currency: agreement.currency,
      buyerEmail: actor.email,
    });
    const timestamp = nowIso();
    const payment: PaymentRecord = {
      id: paymentId,
      agreementId: agreement.id,
      provider: this.provider.name,
      providerRef: checkout.providerRef,
      amountMinor: agreement.amountMinor,
      currency: agreement.currency,
      status: "pending",
      idempotencyKey,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.repo.insertPayment(payment);
    return { payment, checkout, idempotent: false };
  }

  async applyWebhook(headers: Record<string, string | string[] | undefined>, rawBody: string, nowMs?: number) {
    const event = this.provider.parseWebhook({ headers, rawBody, nowMs });
    return this.applyEvent(event);
  }

  async applyEvent(event: { eventId: string; providerRef: string; status: "succeeded" | "failed" | "cancelled"; amountMinor: number }) {
    return this.repo.transaction(async (repo) => {
      const claimed = await repo.claimWebhookEvent(event.eventId, this.provider.name, sha256Hex(event.eventId), nowIso());
      if (!claimed) return { duplicate: true as const };
      const payment = await repo.getPaymentByProviderRef(this.provider.name, event.providerRef);
      if (!payment) throw notFound("Payment not found for this provider reference.");
      if (payment.amountMinor !== event.amountMinor) {
        throw new AppError(409, "AMOUNT_MISMATCH", "The provider amount does not match the agreement.");
      }
      if (payment.status === "succeeded" || payment.status === "refunded") return { duplicate: true as const, payment };
      payment.status = event.status === "succeeded" ? "succeeded" : event.status === "cancelled" ? "cancelled" : "failed";
      payment.updatedAt = nowIso();
      await repo.updatePayment(payment);
      if (payment.status === "succeeded") await this.licenses.advanceAfterPayment(repo, payment.agreementId);
      const agreement = await repo.getAgreement(payment.agreementId);
      return { duplicate: false as const, payment, licenseStatus: agreement?.status ?? null };
    });
  }

  async wallet(userId: string) {
    return {
      balanceMinor: await this.repo.getWalletBalance(userId),
      currency: "TRY" as const,
      simulated: true,
    };
  }

  async simulateSandbox(actor: Actor, paymentId: string) {
    if (this.provider.name !== "sandbox") throw new AppError(404, "NOT_FOUND", "Sandbox simulation is not available.");
    const payment = await this.repo.getPayment(paymentId);
    if (!payment) throw notFound("Payment not found.");
    const agreement = await this.repo.getAgreement(payment.agreementId);
    if (!agreement) throw notFound("Agreement not found.");
    if (actor.userId !== agreement.document.licenseeProfileId && !isAdmin(actor)) throw forbidden();
    const payerId = agreement.document.licenseeProfileId;
    if (payment.status === "succeeded") {
      return {
        duplicate: true as const,
        payment,
        licenseStatus: agreement.status,
        walletBalanceMinor: await this.repo.getWalletBalance(payerId),
      };
    }
    const balance = await this.repo.getWalletBalance(payerId);
    if (balance < payment.amountMinor) {
      throw new AppError(402, "INSUFFICIENT_FUNDS", "The fake balance does not cover this agreement.");
    }
    await this.repo.adjustWallet(payerId, -payment.amountMinor);
    const rawBody = JSON.stringify({
      eventId: `sandbox_${payment.id}`,
      providerRef: payment.providerRef,
      status: "succeeded",
      amountMinor: payment.amountMinor,
    });
    const timestamp = String(Date.now());
    const signature = signPayload(this.webhookSecret, timestamp, rawBody);
    try {
      const result = await this.applyWebhook({ "x-suret-timestamp": timestamp, "x-suret-signature": signature }, rawBody);
      if (result.duplicate) await this.repo.adjustWallet(payerId, payment.amountMinor);
      return { ...result, walletBalanceMinor: await this.repo.getWalletBalance(payerId) };
    } catch (error) {
      await this.repo.adjustWallet(payerId, payment.amountMinor);
      throw error;
    }
  }

  async refund(actor: Actor, paymentId: string) {
    const payment = await this.repo.getPayment(paymentId);
    if (!payment) throw notFound("Payment not found.");
    const agreement = await this.repo.getAgreement(payment.agreementId);
    if (!agreement) throw notFound("Agreement not found.");
    const party = actor.userId === agreement.document.licensorProfileId || actor.userId === agreement.document.licenseeProfileId;
    if (!party && !isAdmin(actor)) throw forbidden();
    if (payment.status !== "succeeded") throw new AppError(409, "REFUND_UNAVAILABLE", "Only a confirmed payment can be refunded.");
    payment.status = "refund_pending";
    payment.updatedAt = nowIso();
    await this.repo.updatePayment(payment);
    if (agreement.status === "active" || agreement.status === "recording" || agreement.status === "payment_pending") {
      await this.repo.updateAgreementStatus(agreement.id, { status: "refund_pending", updatedAt: nowIso(), activatedAt: agreement.activatedAt });
    }
    const result = await this.provider.refund({ providerRef: payment.providerRef, amountMinor: payment.amountMinor });
    if (this.provider.name === "sandbox") await this.repo.adjustWallet(agreement.document.licenseeProfileId, payment.amountMinor);
    payment.status = "refunded";
    payment.updatedAt = nowIso();
    await this.repo.updatePayment(payment);
    const refreshed = await this.repo.getAgreement(agreement.id);
    if (refreshed?.status === "refund_pending") {
      await this.repo.updateAgreementStatus(refreshed.id, { status: "refunded", updatedAt: nowIso(), activatedAt: refreshed.activatedAt });
    }
    return { payment, providerRefundRef: result.providerRefundRef };
  }

  async list(actor: Actor): Promise<PaymentRecord[]> {
    const payments = await this.repo.listPayments();
    if (isAdmin(actor)) return payments;
    const agreements = await this.repo.listAgreements();
    const visible = new Set(
      agreements
        .filter((item) => item.document.licensorProfileId === actor.userId || item.document.licenseeProfileId === actor.userId)
        .map((item) => item.id),
    );
    return payments.filter((item) => visible.has(item.agreementId));
  }
}
